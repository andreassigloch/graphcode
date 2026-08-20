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
import { collectStatus, formatStatus, statusIsHealthy } from '../src/status.js';

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

  /** Die Startzeile, die `init`/`upgrade` schreiben — optional mit fester Version. */
  function writeMcpConfig(spec: string | null, command = 'npx'): void {
    const args = command === 'npx' ? ['-y', spec ?? '@sigloch/graphcode', 'mcp'] : ['dist/cli.js', 'mcp'];
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
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-19T09:12:03.000Z', version: '0.16.0' });
    writeUrl('http://localhost:4318/');
    const s = await collectStatus(repo, {
      fetchImpl: probe({ repoRoot: repo }),
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
    });
    expect(s.host).toMatchObject({ state: 'running', pid: 4242 });
    expect(s.dashboard).toEqual({ state: 'running', url: 'http://localhost:4318/' });
    expect(probed).toEqual(['http://localhost:4318/api/dashboard']);
    expect(statusIsHealthy(s)).toBe(true);
    expect(formatStatus(s)).toContain('http://localhost:4318/');
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
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.16.0' });
    writeRepoInstall('0.16.0');
    const s = await collectStatus(repo, {
      fetchImpl: unreachable,
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      cliVersion: '0.16.0',
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

  it('nennt die festgenagelte Version aus .mcp.json (CR-GC-378)', async () => {
    writeMcpConfig('@sigloch/graphcode@0.17.0');
    writeRepoInstall('0.17.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version).toMatchObject({ pin: '0.17.0', state: 'ok' });
    expect(formatStatus(s)).toContain('Pin 0.17.0');
  });

  it('behandelt eine npx-Startzeile OHNE Pin als Drift — was sie startet, ist nicht lesbar', async () => {
    writeMcpConfig(null);
    writeRepoInstall('0.17.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version.pin).toBe('—');
    expect(s.version.state).toBe('drift');
    expect(s.version.action).toBe('graphcode upgrade');
  });

  it('meldet einen Pin, der hinter dem Install liegt — die Session bootet den alten Build', async () => {
    writeMcpConfig('@sigloch/graphcode@0.13.2');
    writeRepoInstall('0.17.0');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version.state).toBe('drift');
    expect(formatStatus(s)).toContain('Pin 0.13.2');
  });

  it('fällt über eine fremde Startzeile kein Pin-Urteil (graphcodes eigenes Repo startet node dist/cli.js)', async () => {
    writeMcpConfig(null, 'node');
    const s = await collectStatus(repo, { fetchImpl: unreachable, cliVersion: '0.17.0' });
    expect(s.version.pin).toBeUndefined();
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
});
