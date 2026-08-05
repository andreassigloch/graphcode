/**
 * TEST-gve-autostart — maybeStartGve guards (mcp-server.ts).
 *
 * The elected host auto-starts the GVE dashboard by default; these tests pin
 * the guards that keep that safe: opt-out env, test-runner suppression,
 * already-running detection via a REACHABLE docs/views/dashboard.url, and the
 * spawn command shape (GRAPHCODE_GVE_BIN override, --repo appended). All
 * spawn/fetch effects are injected — no real viewer, no network.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gve-autostart-'));
    calls = [];
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

  it('a REACHABLE dashboard.url means already-serving — no second spawn', async () => {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    const child = await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      fetchImpl: (async () => ({ ok: true })) as unknown as typeof fetch,
    });
    expect(child).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('a STALE dashboard.url (probe fails) falls through to a fresh spawn', async () => {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:1/\n');
    await maybeStartGve(repo, {
      env: {},
      spawnImpl: fakeSpawn(calls),
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(calls).toHaveLength(1);
  });

  it('default command is npx -y @sigloch/graph-view-edit --repo <root>', async () => {
    await maybeStartGve(repo, { env: {}, spawnImpl: fakeSpawn(calls) });
    expect(calls).toEqual([
      { bin: 'npx', args: ['-y', '@sigloch/graph-view-edit', '--repo', repo] },
    ]);
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
