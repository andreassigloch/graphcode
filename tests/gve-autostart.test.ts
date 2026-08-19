/**
 * TEST-gve-autostart — maybeStartGve guards (mcp-server.ts).
 *
 * The elected host auto-starts the GVE dashboard by default; these tests pin
 * the guards that keep that safe: opt-out env, test-runner suppression,
 * already-running detection via a REACHABLE docs/views/dashboard.url, and the
 * spawn command shape (installed entry vs. GRAPHCODE_GVE_BIN override, --repo
 * appended). All spawn/fetch/resolve effects are injected — no real viewer, no
 * network, no dependency on where node_modules happens to sit.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { spawn, ChildProcess } from 'node:child_process';
import { maybeStartGve } from '../src/mcp-server.js';

type SpawnCall = { bin: string; args: string[] };

function fakeSpawn(calls: SpawnCall[]): typeof spawn {
  return ((bin: string, args: string[]) => {
    calls.push({ bin, args });
    return { pid: undefined, on: () => undefined, kill: () => undefined } as unknown as ChildProcess;
  }) as unknown as typeof spawn;
}

describe('TEST-gve-autostart', () => {
  let repo: string;
  let calls: SpawnCall[];
  let probed: string[];

  /** Stand-in for the installed viewer entry — the real path depends on the install layout. */
  const resolveGve = () => '/opt/node_modules/@sigloch/graph-view-edit/bin/gve.mjs';

  /** A dashboard.url probe answering for `repoRoot` — records the URL actually hit. */
  function probe(answer: { ok: boolean; repoRoot: unknown }): typeof fetch {
    return (async (url: URL | string) => {
      probed.push(String(url));
      return { ok: answer.ok, json: async () => ({ member: 'irrelevant', repoRoot: answer.repoRoot }) };
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gve-autostart-'));
    calls = [];
    probed = [];
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('GRAPHCODE_NO_GVE=1 skips the spawn (config opt-out)', async () => {
    const child = await maybeStartGve(repo, { env: { GRAPHCODE_NO_GVE: '1' }, spawnImpl: fakeSpawn(calls) });
    expect(child).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('never spawns under a test/CI runner (VITEST / CI env)', async () => {
    for (const env of [{ VITEST: 'true' }, { CI: 'true' }]) {
      expect(await maybeStartGve(repo, { env, spawnImpl: fakeSpawn(calls) })).toBeNull();
    }
    expect(calls).toHaveLength(0);
  });

  it('a dashboard.url serving THIS repo means already-serving — no second spawn', async () => {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    const child = await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      fetchImpl: probe({ ok: true, repoRoot: realpathSync(repo) }),
    });
    expect(child).toBeNull();
    expect(calls).toHaveLength(0);
    expect(probed).toEqual(['http://localhost:4317/api/dashboard']);
  });

  it('a symlinked repo path still reads as THIS repo (physical comparison)', async () => {
    // macOS hands out /var/folders/… paths whose physical form is /private/var/…;
    // the viewer reports the physical one, the caller may hold either.
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    const child = await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      fetchImpl: probe({ ok: true, repoRoot: repo }),
    });
    expect(child).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('a dashboard.url answered by ANOTHER repo spawns this repo own viewer', async () => {
    // The default GVE port is the same for every repo (4317) — a stale URL is
    // routinely answered by a foreign viewer that bumped onto that port.
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      resolveGve,
      fetchImpl: probe({ ok: true, repoRoot: '/somewhere/else' }),
    });
    expect(calls).toEqual([
      {
        bin: process.execPath,
        args: ['/opt/node_modules/@sigloch/graph-view-edit/bin/gve.mjs', '--repo', repo],
      },
    ]);
  });

  it('an instance without repoRoot is unidentifiable — spawn (pre-CR-GVE-237 viewer, non-GVE server)', async () => {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    for (const answer of [{ ok: true, repoRoot: undefined }, { ok: false, repoRoot: undefined }]) {
      calls.length = 0;
      await maybeStartGve(repo, { env: {}, spawnImpl: fakeSpawn(calls), fetchImpl: probe(answer) });
      expect(calls).toHaveLength(1);
    }
  });

  it('a STALE dashboard.url (probe fails) falls through to a fresh spawn', async () => {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:1/\n');
    await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      resolveGve,
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(calls).toHaveLength(1);
  });

  it('starts the INSTALLED viewer with this node — no npx, no second download (CR-GC-369)', async () => {
    await maybeStartGve(repo, { env: {}, spawnImpl: fakeSpawn(calls), resolveGve });
    expect(calls).toEqual([
      {
        bin: process.execPath,
        args: ['/opt/node_modules/@sigloch/graph-view-edit/bin/gve.mjs', '--repo', repo],
      },
    ]);
  });

  it('resolves the viewer entry from the real dependency tree', async () => {
    await maybeStartGve(repo, { env: {}, spawnImpl: fakeSpawn(calls) });
    expect(calls).toHaveLength(1);
    expect(calls[0].bin).toBe(process.execPath);
    expect(calls[0].args[0]).toMatch(/graph-view-edit[/\\]bin[/\\]gve\.mjs$/);
  });

  it('an unresolvable viewer warns and serves without a dashboard — the gate stays up', async () => {
    const child = await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      resolveGve: () => {
        throw new Error('MODULE_NOT_FOUND');
      },
    });
    expect(child).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('GRAPHCODE_GVE_BIN overrides the launch command (space-split)', async () => {
    await maybeStartGve(repo, {
      env: { GRAPHCODE_GVE_BIN: 'node /opt/gve/bin/gve.mjs' },
      spawnImpl: fakeSpawn(calls),
    });
    expect(calls).toEqual([
      { bin: 'node', args: ['/opt/gve/bin/gve.mjs', '--repo', repo] },
    ]);
  });
});
