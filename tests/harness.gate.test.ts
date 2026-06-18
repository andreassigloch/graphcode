/**
 * TEST-mutate-gate — the acceptance test for FCHAIN-apply-gate.
 *
 * Real disk Kuzu (temp dir per test, never :memory:). Asserts:
 *   (a) a valid add-node/add-edge set applies and PERSISTS (survives reload);
 *   (b) mutate() returns a violations array;
 *   (c) an error-severity V3 rule (R-01: REQ without verify) BLOCKS the apply —
 *       success:false, tier:block, nothing persisted.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-mutate-gate: FCHAIN-apply-gate', () => {
  let tmp: string;
  let kuzuPath: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-gate-'));
    kuzuPath = join(tmp, 'kuzu'); // DISK path — never :memory:
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) applies a valid REQ+TEST+verify set and persists it', async () => {
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-001', type: 'REQ', name: 'Login works', description: 'user can log in', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-001', type: 'TEST', name: 'Login test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-001', targetId: 'REQ-001', edgeType: 'verify', attributes: {} } },
    ];
    const result = await harness.mutate(commands);

    expect(result.success).toBe(true);
    // No error-severity violation → applied. Tier is auto-apply (clean) or
    // suggest (warnings present), but never block on a successful apply.
    expect(result.tier).not.toBe('block');
    expect(['auto-apply', 'suggest']).toContain(result.tier);
    expect(result.appliedCommands).toBe(3);
    expect(result.mutations).toBe(3);
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.violations.some((v) => v.severity === 'error')).toBe(false);

    // PERSISTENCE: reload from disk Kuzu into a fresh harness.
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    const g = harness2.getGraph();
    expect(g.nodes.find((n) => n.uid === 'REQ-001')).toBeDefined();
    expect(g.nodes.find((n) => n.uid === 'TEST-001')).toBeDefined();
    expect(g.edges.find((e) => e.sourceId === 'TEST-001' && e.targetId === 'REQ-001' && e.edgeType === 'verify')).toBeDefined();
    // rebind so afterEach closes the live handle
    harness = harness2;
  });

  it('(b) mutate returns a violations array', async () => {
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-arr', type: 'REQ', name: 'arr', attributes: {} } },
    ]);
    expect(result.violations).toBeInstanceOf(Array);
  });

  it('(c) BLOCKS on an error-severity rule (R-01: REQ without verify)', async () => {
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-unverified', type: 'REQ', name: 'no test', description: 'orphan req', attributes: {} } },
    ]);

    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.mutations).toBe(0);
    const r01 = result.violations.find((v) => v.ruleId === 'R-01');
    expect(r01).toBeDefined();
    expect(r01?.severity).toBe('error');
    expect(r01?.elementId).toBe('REQ-unverified');

    // NOT persisted: a fresh reload from disk must not contain the node.
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    expect(harness2.getGraph().nodes.find((n) => n.uid === 'REQ-unverified')).toBeUndefined();
    harness = harness2;
  });

  it('evaluateRules() is standalone and does not mutate the graph', async () => {
    const before = harness.getGraph().nodes.length;
    const violations = harness.evaluateRules();
    expect(violations).toBeInstanceOf(Array);
    expect(harness.getGraph().nodes.length).toBe(before);
  });
});
