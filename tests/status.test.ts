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
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-19T09:12:03.000Z' });
    writeUrl('http://localhost:4318/');
    const s = await collectStatus(repo, {
      fetchImpl: probe({ repoRoot: repo }),
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
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
    expect(formatStatus(s)).toContain('verwaist');
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

  it('meldet ohne Lock einen nicht laufenden Host mit genau einer nächsten Aktion', async () => {
    const s = await collectStatus(repo, { fetchImpl: unreachable });
    expect(s.host).toEqual({ state: 'none' });
    expect(formatStatus(s)).toContain('.mcp.json');
  });

  it('nennt den Member-Namen aus der package.json des Repos', async () => {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@acme/auth-service' }));
    const s = await collectStatus(repo, { fetchImpl: unreachable });
    expect(s.member).toBe('auth-service');
    expect(formatStatus(s)).toContain('auth-service');
  });
});
