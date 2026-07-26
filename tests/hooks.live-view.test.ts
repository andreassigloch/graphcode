/**
 * TEST-live-view — REQ-mutation-emits-event acceptance test.
 *
 * Verifies that every mutation emits exactly ONE live-update event with correct
 * domains, so the dashboard can update without a reload.
 *
 * Real disk Kuzu (temp dir per test, never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { registerEmitters, type LiveUpdateEvent } from '../src/emit.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-live-view: every mutation emits exactly ONE live-update event', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-live-view-'));
    const kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('emits exactly one event with domains including graph and readiness for a successful mutation', async () => {
    const captured: LiveUpdateEvent[] = [];
    registerEmitters(harness.getHooks(), {
      onEvent: (e) => captured.push(e),
    });

    // A valid mutation (REQ + TEST + verify satisfies R-01).
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-lv-01', type: 'REQ', name: 'Live view req', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-lv-01', type: 'TEST', name: 'Live view test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-lv-01', targetId: 'REQ-lv-01', edgeType: 'verify', attributes: {} } },
    ];

    const result = await harness.mutate(commands);
    expect(result.success).toBe(true);

    // Exactly ONE event.
    expect(captured).toHaveLength(1);

    const event = captured[0];
    expect(event.type).toBe('invalidate');
    // Must always include 'graph'.
    expect(event.domains).toContain('graph');
    // Must always include 'readiness'.
    expect(event.domains).toContain('readiness');
    // domains is a non-empty array.
    expect(event.domains.length).toBeGreaterThanOrEqual(2);
    // ts is a valid ISO string.
    expect(typeof event.ts).toBe('string');
    expect(new Date(event.ts).getTime()).not.toBeNaN();
  });

  it('emits exactly one event even when mutation is blocked by pre-commit hook', async () => {
    const captured: LiveUpdateEvent[] = [];
    registerEmitters(harness.getHooks(), {
      onEvent: (e) => captured.push(e),
    });

    // Register a blocking pre-commit hook.
    harness.getHooks().registerHook('pre-commit', () => ({ hookId: 'blocker', block: true, message: 'intentional block' }));

    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-blocked', type: 'REQ', name: 'Blocked req', attributes: {} } },
    ];

    const result = await harness.mutate(commands);
    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');

    // Harness still calls runPostApplyHooks on block → exactly one event.
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('invalidate');
    expect(captured[0].domains).toContain('graph');
  });

  it('emits exactly one event per mutation across two sequential mutations', async () => {
    const captured: LiveUpdateEvent[] = [];
    registerEmitters(harness.getHooks(), {
      onEvent: (e) => captured.push(e),
    });

    // First mutation — valid set.
    await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-seq-01', type: 'REQ', name: 'Seq req 1', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-seq-01', type: 'TEST', name: 'Seq test 1', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-seq-01', targetId: 'REQ-seq-01', edgeType: 'verify', attributes: {} } },
    ]);

    // Second mutation — another valid set.
    await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-seq-02', type: 'REQ', name: 'Seq req 2', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-seq-02', type: 'TEST', name: 'Seq test 2', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-seq-02', targetId: 'REQ-seq-02', edgeType: 'verify', attributes: {} } },
    ]);

    // Exactly 2 events — one per mutation, no more.
    expect(captured).toHaveLength(2);
    for (const event of captured) {
      expect(event.type).toBe('invalidate');
      expect(event.domains).toContain('graph');
    }
  });

  it('includes rules domain when violation is present', async () => {
    const captured: LiveUpdateEvent[] = [];
    registerEmitters(harness.getHooks(), {
      onEvent: (e) => captured.push(e),
    });

    // A blocked-by-rule mutation (orphan REQ triggers R-01 error).
    await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-orphan', type: 'REQ', name: 'Orphan req', description: '', attributes: {} } },
    ]);

    expect(captured).toHaveLength(1);
    // Violations are present (R-01 error) → domains includes 'rules'.
    expect(captured[0].domains).toContain('rules');
  });
});
