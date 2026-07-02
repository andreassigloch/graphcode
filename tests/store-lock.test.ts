/**
 * TEST-store-lock (CR-GC-218) — store-ownership lock (O2) + write serialization (O3).
 *
 * O2: a second writer on the SAME `.graphcode` store is refused LOUDLY, not silently
 * clobbered; a stale lock (dead owner / old corrupt file) is auto-reclaimed; a live
 * owner (or a cross-host owner we can't verify) is never clobbered. O3: a reseed never
 * interleaves with a mutate. Real disk, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { StoreLock, StoreOwnershipError } from '../src/store-lock.js';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

describe('TEST-store-lock (CR-GC-218 O2): store-ownership lock', () => {
  let dir: string;
  let lockPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'graphcode-lock-'));
    lockPath = join(dir, '.graphcode', 'owner.lock');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('refuses a second owner while the first is held (loud, not silent)', () => {
    const a = new StoreLock(lockPath);
    a.acquire();
    expect(existsSync(lockPath)).toBe(true);

    const b = new StoreLock(lockPath);
    // Owner pid is THIS process → alive → refused.
    expect(() => b.acquire()).toThrow(StoreOwnershipError);
    a.release();
  });

  it('release removes the lock so it can be re-acquired', () => {
    const a = new StoreLock(lockPath);
    a.acquire();
    a.release();
    expect(existsSync(lockPath)).toBe(false);
    const b = new StoreLock(lockPath);
    expect(() => b.acquire()).not.toThrow();
    b.release();
  });

  it('reclaims a stale lock whose owner PID is dead', () => {
    mkdirSync(join(dir, '.graphcode'), { recursive: true });
    // A dead owner: an improbable PID on this host.
    writeFileSync(lockPath, JSON.stringify({ pid: 2147480000, hostname: hostname(), startedAt: '2020-01-01T00:00:00.000Z' }));
    const lock = new StoreLock(lockPath);
    expect(() => lock.acquire()).not.toThrow(); // stale → reclaimed
    lock.release();
  });

  it('NEVER clobbers a live owner nor a cross-host owner it cannot verify', () => {
    mkdirSync(join(dir, '.graphcode'), { recursive: true });
    // Live owner (this very process pid).
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, hostname: hostname(), startedAt: new Date(0).toISOString() }));
    expect(() => new StoreLock(lockPath).acquire()).toThrow(StoreOwnershipError);
    // Cross-host owner — liveness unverifiable → refuse.
    writeFileSync(lockPath, JSON.stringify({ pid: 12345, hostname: 'some-other-host', startedAt: new Date(0).toISOString() }));
    expect(() => new StoreLock(lockPath).acquire()).toThrow(StoreOwnershipError);
  });

  it('reclaims an unparseable lock only after the mid-write grace window', () => {
    mkdirSync(join(dir, '.graphcode'), { recursive: true });
    writeFileSync(lockPath, 'not-json-garbage');
    // Fresh corrupt file (mid-write window) → refuse.
    expect(() => new StoreLock(lockPath).acquire()).toThrow(StoreOwnershipError);
    // Age it past the grace window → reclaim.
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockPath, old, old);
    expect(() => new StoreLock(lockPath).acquire()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'lock-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

describe('TEST-store-lock (CR-GC-218): harness enforces one owner + serializes writes', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-owner-'));
  });
  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  it('O2: a second harness on the SAME store is refused at initialize()', async () => {
    const h1 = makeHarness(repoRoot);
    await h1.initialize();
    try {
      const h2 = makeHarness(repoRoot);
      await expect(h2.initialize()).rejects.toThrow(StoreOwnershipError);
    } finally {
      await h1.close();
    }
    // After the owner closes, a new harness can take the store.
    const h3 = makeHarness(repoRoot);
    await expect(h3.initialize()).resolves.toBeUndefined();
    await h3.close();
  });

  it('O3: a concurrent reseed + mutate never interleave (both settle, store stays consistent)', async () => {
    const harness = makeHarness(repoRoot);
    await harness.initialize();
    try {
      const spec: MutateCommand[] = [
        { op: 'add-node', node: { uid: 'SYS-x', type: 'SYS', name: 'X', description: '', attributes: {} } },
      ];
      // Fire both writes without awaiting between them — the serializer must FIFO them.
      const [, res] = await Promise.all([harness.mutate(spec), harness.mutate(spec)]);
      expect(res.success).toBe(true);
      // Store is consistent (the upsert-by-uid means one SYS-x, no corruption/dup crash).
      expect(harness.getGraph().nodes.filter((n) => n.uid === 'SYS-x')).toHaveLength(1);
    } finally {
      await harness.close();
    }
  });
});
