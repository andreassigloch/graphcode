/**
 * TEST-status — `graphcode status` (CR-GC-368).
 *
 * Pinnt die eine Eigenschaft, an der der Befund hängt: eine antwortende URL zählt
 * NUR, wenn die Instanz dieses Repo bedient. Alle Effekte sind injiziert — kein
 * Viewer, kein Netz, keine echte PID.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectStatus, formatStatus, statusIsHealthy, judgeBootDrift } from '../src/surface/status.js';
import { HOST_ENTRY } from '../src/surface/scaffold-templates.js';

describe('TEST-status', () => {
  let repo: string;
  let probed: string[];

  /** Ein Viewer, der für `repoRoot` antwortet — protokolliert die tatsächlich gerufene URL. */
  function probe(answer: { ok?: boolean; repoRoot?: unknown }): typeof fetch {
    return (async (url: URL | string) => {
      probed.push(String(url));
      return { ok: answer.ok ?? true, json: async () => ({ member: 'x', repoRoot: answer.repoRoot }) };
    }) as unknown as typeof fetch;
  }

  /** Kein Viewer erreichbar — genau das Verhalten einer stale dashboard.url. */
  const unreachable: typeof fetch = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;

  function writeUrl(url: string): void {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), `${url}\n`);
  }

  /** Der Repo-lokale Install, den `npx` aus `.mcp.json` zuerst nimmt. */
  function writeRepoInstall(version: string): void {
    const dir = join(repo, 'node_modules', '@sigloch', 'graphcode');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@sigloch/graphcode', version }));
  }

  /** Eine graphcode-Startzeile in `.mcp.json` — `init`/`upgrade` schreiben `node HOST_ENTRY mcp` (CR-GC-528). */
  function writeMcpConfig(command: string, args: string[]): void {
    writeFileSync(join(repo, '.mcp.json'), JSON.stringify({ mcpServers: { graphcode: { command, args } } }));
  }

  function writeLock(owner: object): void {
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
    writeFileSync(join(repo, '.graphcode', 'owner.lock'), JSON.stringify(owner));
  }

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), 'gc-status-')));
    probed = [];
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('meldet Host und Dashboard grün, wenn der Viewer DIESES Repo bedient', async () => {
    // CR-GC-620: „gesund" heisst seither auch „der Host ist beurteilbar" — ein Lock ohne
    // Boot-Stempel ist nicht mehr gruen, sondern unbekannt. Der Stempel gehoert deshalb ins
    // Fixture, nicht die Zusage aufgeweicht.
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-19T09:12:03.000Z', version: '0.16.0',
      boot: { codeRoot: '/p/dist', codeMtimeMs: 1_000, contracts: '10.10.0' } });
    writeUrl('http://localhost:4318/');
    const s = await collectStatus(repo, {
      fetchImpl: probe({ repoRoot: repo }),
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
      plattenStand: () => ({ codeMtimeMs: 1_000, contracts: '10.10.0' }),
    });
    expect(s.host).toMatchObject({ state: 'running', pid: 4242 });
    expect(s.dashboard).toEqual({ state: 'running', url: 'http://localhost:4318/' });
    expect(probed).toEqual(['http://localhost:4318/api/config']);
    expect(statusIsHealthy(s)).toBe(true);
    expect(formatStatus(s)).toContain('http://localhost:4318/');
  });

  // Die zweite Haelfte des gemeldeten Fehlers (CR-GC-452): der Bericht sagte
  // „Dashboard laeuft nicht", waehrend `curl` auf genau die Adresse aus
  // dashboard.url sauber antwortete. Ein Timeout gegen den rechnenden Endpunkt
  // ist von „tot" nicht unterscheidbar — der Bericht log also, ohne es zu merken.
  it('ein Viewer, dessen api/dashboard laenger braucht als das Budget, gilt trotzdem als laufend', async () => {
    writeUrl('http://localhost:4318/');
    const slowOnDashboard = (async (url: URL | string, init?: { signal?: AbortSignal }) => {
      const hit = String(url);
      probed.push(hit);
      if (hit.endsWith('/api/dashboard')) {
        await new Promise((_r, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      }
      return { ok: true, json: async () => ({ repoRoot: repo }) };
    }) as unknown as typeof fetch;

    const s = await collectStatus(repo, { fetchImpl: slowOnDashboard });

    expect(s.dashboard).toEqual({ state: 'running', url: 'http://localhost:4318/' });
    expect(probed).toEqual(['http://localhost:4318/api/config']);
  });

  it('meldet fremdes Repo statt einer falschen Adresse, wenn die Instanz ein anderes bedient', async () => {
    writeUrl('http://localhost:4317/');
    const s = await collectStatus(repo, { fetchImpl: probe({ repoRoot: '/Users/x/dev/anderes-repo' }) });
    expect(s.dashboard).toEqual({
      state: 'foreign',
      url: 'http://localhost:4317/',
      servedRepo: '/Users/x/dev/anderes-repo',
    });
    expect(statusIsHealthy(s)).toBe(false);
    expect(formatStatus(s)).toContain('/Users/x/dev/anderes-repo');
  });

  it('meldet einen Viewer ohne repoRoot-Feld (zu alt) als unbekannt, nicht als meinen', async () => {
    writeUrl('http://localhost:4317/');
    const s = await collectStatus(repo, { fetchImpl: probe({ repoRoot: undefined }) });
    expect(s.dashboard).toEqual({ state: 'unidentified', url: 'http://localhost:4317/' });
    expect(statusIsHealthy(s)).toBe(false);
    expect(formatStatus(s)).toContain('Viewer veraltet');
  });

  it('meldet einen Fehlerstatus der Probe als unbekannt', async () => {
    writeUrl('http://localhost:4317/');
    const s = await collectStatus(repo, { fetchImpl: probe({ ok: false, repoRoot: repo }) });
    expect(s.dashboard.state).toBe('unidentified');
  });

  it('vergleicht physisch: ein Symlink auf dasselbe Repo ist MEINE Instanz', async () => {
    const link = join(tmpdir(), `gc-status-link-${process.pid}`);
    rmSync(link, { force: true });
    symlinkSync(repo, link);
    try {
      writeUrl('http://localhost:4318/');
      const s = await collectStatus(link, { fetchImpl: probe({ repoRoot: repo }) });
      expect(s.dashboard.state).toBe('running');
    } finally {
      rmSync(link, { force: true });
    }
  });

  it('meldet "läuft nicht" bei stale dashboard.url — nie die tote URL', async () => {
    writeUrl('http://localhost:4318/');
    const s = await collectStatus(repo, { fetchImpl: unreachable });
    expect(s.dashboard).toEqual({ state: 'not-running' });
    expect(formatStatus(s)).not.toContain('4318');
  });

  it('meldet "läuft nicht" ohne dashboard.url und ohne Probe', async () => {
    const s = await collectStatus(repo, { fetchImpl: probe({ repoRoot: repo }) });
    expect(s.dashboard.state).toBe('not-running');
    expect(probed).toEqual([]);
  });

  it('erkennt einen verwaisten Lock als toten Host', async () => {
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-19T09:12:03.000Z' });
    const s = await collectStatus(repo, {
      fetchImpl: probe({ repoRoot: repo }),
      pidAlive: () => false,
      hostnameImpl: () => 'this-box',
    });
    expect(s.host.state).toBe('stale');
    expect(formatStatus(s)).toMatch(/verwaist; graphcode mcp/);
  });

  it('erklärt einen Lock von einem anderen Rechner nicht für tot', async () => {
    writeLock({ pid: 4242, hostname: 'other-box', startedAt: '2026-08-19T09:12:03.000Z' });
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => false,
      hostnameImpl: () => 'this-box',
    });
    expect(s.host.state).toBe('running');
  });

  it('nennt ohne Lock den ausführbaren Befehl als einzige nächste Aktion', async () => {
    const s = await collectStatus(repo, { fetchImpl: unreachable });
    expect(s.host).toEqual({ state: 'none' });
    expect(formatStatus(s)).toContain('→ graphcode mcp');
  });

  it('nennt den Member-Namen aus der package.json des Repos', async () => {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@acme/auth-service' }));
    const s = await collectStatus(repo, { fetchImpl: unreachable });
    expect(s.member).toBe('auth-service');
    expect(formatStatus(s)).toContain('auth-service');
  });

  it('meldet Versionen grün, wenn CLI, Host und Repo-Install denselben Build nennen', async () => {
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.16.0',
      boot: { codeRoot: '/p/dist', codeMtimeMs: 1_000, contracts: '10.10.0' } });
    writeRepoInstall('0.16.0');
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
      // CR-GC-620: gleiche Nummern REICHEN nicht mehr fuer gruen — der Stand muss dazupassen.
      plattenStand: () => ({ codeMtimeMs: 1_000, contracts: '10.10.0' }),
    });
    expect(s.version).toEqual({ cli: '0.16.0', host: '0.16.0', repo: '0.16.0', state: 'ok' });
    expect(formatStatus(s)).toContain('CLI 0.16.0 · Host 0.16.0 · Repo 0.16.0');
  });

  it('nennt den alten Repo-Install — das ist der Build, den die Agent-Session bootet', async () => {
    writeRepoInstall('0.13.2');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.16.0' });
    expect(s.version.state).toBe('drift');
    expect(s.version.action).toBe('graphcode upgrade');
    expect(formatStatus(s)).toContain('Repo 0.13.2');
    expect(statusIsHealthy(s)).toBe(false);
  });

  it('nennt einen Host, der auf altem Code weiterläuft — Neustart statt Installation', async () => {
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.13.2' });
    writeRepoInstall('0.16.0');
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
    });
    expect(s.version.state).toBe('drift');
    expect(s.version.action).toBe('graphcode upgrade');
  });

  it('behandelt einen Lock ohne Versions-Stempel als unbekannt, nicht als gleich', async () => {
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z' });
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
    });
    expect(s.version.state).toBe('host-unknown');
    expect(formatStatus(s)).toContain('graphcode upgrade');
  });

  it('zieht die bekannte Drift dem fehlenden Host-Stempel vor — der Repo-Install ist die Ursache', async () => {
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z' });
    writeRepoInstall('0.13.2');
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
    });
    expect(s.version.state).toBe('drift');
    expect(s.version.action).toBe('graphcode upgrade');
  });

  it('erkennt die Repo-Startzeile und urteilt nur über Install, Host und CLI (CR-GC-529)', async () => {
    writeMcpConfig('node', [HOST_ENTRY, 'mcp']);
    writeRepoInstall('0.17.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version).toMatchObject({ start: 'repo', repo: '0.17.0', state: 'ok' });
    expect(formatStatus(s)).not.toContain('Pin');
  });

  it('behandelt JEDE npx-Startzeile als Drift, gepinnt wie ungepinnt — sie bootet nicht node_modules', async () => {
    writeRepoInstall('0.17.0');
    for (const spec of ['@sigloch/graphcode@0.17.0', '@sigloch/graphcode@latest', '@sigloch/graphcode']) {
      writeMcpConfig('npx', ['-y', spec, 'mcp']);
      const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
      expect(s.version).toMatchObject({ start: 'npx', state: 'drift', action: 'graphcode upgrade' });
      expect(formatStatus(s)).toContain('Start npx');
    }
  });

  it('meldet eine Repo-Startzeile ohne Install als Drift — der Host bricht beim Start ab', async () => {
    writeMcpConfig('node', [HOST_ENTRY, 'mcp']);
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version).toMatchObject({ start: 'repo', state: 'drift', action: 'npm install' });
  });

  it('fällt über eine fremde Startzeile kein Urteil (graphcodes eigenes Repo startet node dist/cli.js)', async () => {
    writeMcpConfig('node', ['dist/cli.js', 'mcp']);
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version.start).toBeUndefined();
    expect(s.version.state).toBe('ok');
  });

  it('meldet ohne Repo-Install und ohne Host nur die eigene Version', async () => {
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.16.0' });
    expect(s.version).toEqual({ cli: '0.16.0', host: undefined, repo: undefined, state: 'ok' });
    expect(formatStatus(s)).toContain('Version     OK             CLI 0.16.0');
  });

  it('vergleicht Versionen numerisch, nicht als Text (0.9.0 < 0.10.0)', async () => {
    writeRepoInstall('0.9.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.10.0' });
    expect(s.version.state).toBe('drift');
    expect(s.version.action).toBe('graphcode upgrade');
  });

  it('empfiehlt das globale Update, wenn der Repo-Install der neuere Build ist', async () => {
    writeRepoInstall('0.16.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.15.0' });
    expect(s.version.action).toBe('graphcode upgrade --global');
  });

  /**
   * CR-GC-620 — die Paketnummer identifiziert ein Release, keinen Build.
   *
   * Gemessen am 2026-09-23: Host pid 2422 vom Vortag 19:28, `dist` gebaut 07:04 (und
   * `npm run build` macht `rm -rf dist`, der Host hielt also geloeschte Dateien) — Bericht
   * `Version OK · CLI 0.24.0 · Host 0.24.0`. Nach dem Reconnect (pid 67732, 07:32) stand
   * DIESELBE Zeile. Der Reconnect ersetzt den Prozess nachweislich; es fehlte der Anlass.
   */
  describe('Boot-Stempel (CR-GC-620)', () => {
    const BOOT = { codeRoot: '/p/dist', codeMtimeMs: 1_000, contracts: '10.10.0' };

    it('urteilt ueber Code- und contracts-Drift, und nur mit Messwerten', () => {
      expect(judgeBootDrift(BOOT, { codeMtimeMs: 1_000, contracts: '10.10.0' })).toBeNull();
      expect(judgeBootDrift(BOOT, { codeMtimeMs: 2_000, contracts: '10.10.0' }))
        .toMatch(/\/p\/dist wurde nach dem Boot/);
      expect(judgeBootDrift(BOOT, { codeMtimeMs: 1_000, contracts: '10.11.0' }))
        .toMatch(/contracts 10\.10\.0 beim Boot, 10\.11\.0 installiert/);
      // Aelterer Stand auf der Platte ist KEINE Drift: der Host ist dann der neuere.
      expect(judgeBootDrift(BOOT, { codeMtimeMs: 500, contracts: '10.10.0' })).toBeNull();
      // Kein Urteil ohne Messwert — sonst meldet jedes unlesbare Verzeichnis Drift.
      expect(judgeBootDrift(BOOT, { codeMtimeMs: 0 })).toBeNull();
      expect(judgeBootDrift(undefined, { codeMtimeMs: 9_999 })).toBeNull();
    });

    it('meldet Drift, wenn das dist des Hosts nach seinem Boot gebaut wurde', async () => {
      writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-09-22T19:28:35.000Z',
        version: '0.24.0', boot: BOOT });
      writeUrl('http://localhost:4318/');
      writeRepoInstall('0.24.0');
      writeMcpConfig('node', [HOST_ENTRY, 'mcp']);
      const s = await collectStatus(repo, {
        fetchImpl: probe({ repoRoot: repo }), pidAlive: () => true,
        hostnameImpl: () => 'this-box', cliVersion: '0.24.0',
        plattenStand: () => ({ codeMtimeMs: 2_000, contracts: '10.10.0' }),
      });
      // Alle drei Zahlen sind gleich — genau der Fall, den die alte Fassung gruen meldete.
      expect(s.version.state).toBe('drift');
      expect(s.version.action).toMatch(/reconnect/);
      expect(statusIsHealthy(s)).toBe(false);
    });

    it('meldet OK, wenn der Host mit dem jetzigen Stand gebootet hat', async () => {
      writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-09-23T05:32:10.000Z',
        version: '0.24.0', boot: BOOT });
      writeUrl('http://localhost:4318/');
      writeRepoInstall('0.24.0');
      writeMcpConfig('node', [HOST_ENTRY, 'mcp']);
      const s = await collectStatus(repo, {
        fetchImpl: probe({ repoRoot: repo }), pidAlive: () => true,
        hostnameImpl: () => 'this-box', cliVersion: '0.24.0',
        plattenStand: () => ({ codeMtimeMs: 1_000, contracts: '10.10.0' }),
      });
      // Ohne diese Zusage waere die Erkennung nur lauter, nicht richtiger.
      expect(s.version.state).toBe('ok');
      expect(statusIsHealthy(s)).toBe(true);
    });

    it('nennt einen Lock ohne Boot-Stempel unbekannt, statt ihn gruen zu melden', async () => {
      // Ein Host eines aelteren Builds. Er ist NICHT verwaist — nur nicht beurteilbar.
      writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-09-23T05:32:10.000Z', version: '0.24.0' });
      writeUrl('http://localhost:4318/');
      writeRepoInstall('0.24.0');
      writeMcpConfig('node', [HOST_ENTRY, 'mcp']);
      const s = await collectStatus(repo, {
        fetchImpl: probe({ repoRoot: repo }), pidAlive: () => true,
        hostnameImpl: () => 'this-box', cliVersion: '0.24.0',
      });
      expect(s.host.state).toBe('running');
      expect(s.version.state).toBe('host-unknown');
      expect(s.version.action).toMatch(/reconnect/);
    });
  });
});