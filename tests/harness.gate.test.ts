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
import { KuzuAdapter } from './helpers/store.js';
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

  it('(d) BLOCKS a structurally-invalid mutation at the gate, atomically — no partial persist (CR-GC-200)', async () => {
    // A clean member first (REQ verified by TEST).
    const ok = await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-struct', type: 'REQ', name: 'r', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-struct', type: 'TEST', name: 't', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-struct', targetId: 'REQ-struct', edgeType: 'verify', attributes: {} } },
    ]);
    expect(ok.success).toBe(true);

    // verify runs TEST->REQ, so REQ->verify->TEST is an unsupported TRACE_PATTERNS
    // pair: rejected AT THE GATE via the ENGINE rule R-18 (CR-GC-205 Item 1 — pair
    // legality is no longer a separate codec.validate() call), not at Kuzu persist
    // mid-transaction. Atomic delta-block, no partial persist.
    const bad = await harness.mutate([
      { op: 'add-edge', edge: { sourceId: 'REQ-struct', targetId: 'TEST-struct', edgeType: 'verify', attributes: {} } },
    ]);
    expect(bad.success).toBe(false);
    expect(bad.tier).toBe('block');
    expect(bad.mutations).toBe(0);
    expect(bad.violations.some((v) => v.ruleId === 'R-18' && /not a valid verify pattern/.test(v.message))).toBe(true);

    // Atomic: a fresh reload from disk has the clean edge only, never the invalid one.
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    const edges = harness2.getGraph().edges;
    expect(edges.some((e) => e.sourceId === 'TEST-struct' && e.targetId === 'REQ-struct' && e.edgeType === 'verify')).toBe(true);
    expect(edges.some((e) => e.sourceId === 'REQ-struct' && e.targetId === 'TEST-struct')).toBe(false);
    harness = harness2;
  });

  // CR-GC-238: native edge ops — ONE semantic command instead of delete+add batches.
  describe('update-edge (CR-GC-238)', () => {
    it('flip:true produces the reversed edge, the old one is gone — as ONE command', async () => {
      const ok = await harness.mutate([
        { op: 'add-node', node: { uid: 'MS-a', type: 'MS', name: 'a', attributes: {} } },
        { op: 'add-node', node: { uid: 'MS-b', type: 'MS', name: 'b', attributes: {} } },
        // MS→MS relation requires label 'depends-on' (TRACE_PATTERNS); the flip keeps it.
        { op: 'add-edge', edge: { sourceId: 'MS-a', targetId: 'MS-b', edgeType: 'relation', attributes: { label: 'depends-on' } } },
      ]);
      expect(ok.success).toBe(true);

      const result = await harness.mutate([
        { op: 'update-edge', edge: { sourceId: 'MS-a', targetId: 'MS-b', edgeType: 'relation' }, set: { flip: true } },
      ]);
      expect(result.success).toBe(true);
      expect(result.appliedCommands).toBe(1); // one semantic audit entry, not delete+add
      const edges = harness.getGraph().edges;
      expect(edges.some((e) => e.sourceId === 'MS-b' && e.targetId === 'MS-a' && e.edgeType === 'relation')).toBe(true);
      expect(edges.some((e) => e.sourceId === 'MS-a' && e.targetId === 'MS-b')).toBe(false);

      // PERSISTENCE: the flip survives a disk reload.
      await harness.close();
      const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
      const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
      await harness2.initialize();
      const reloaded = harness2.getGraph().edges;
      expect(reloaded.some((e) => e.sourceId === 'MS-b' && e.targetId === 'MS-a' && e.edgeType === 'relation')).toBe(true);
      expect(reloaded.some((e) => e.sourceId === 'MS-a' && e.targetId === 'MS-b')).toBe(false);
      harness = harness2;
    });

    it('attribute-only patch keeps the edge identity and persists the merged attributes', async () => {
      const ok = await harness.mutate([
        { op: 'add-node', node: { uid: 'REQ-ue', type: 'REQ', name: 'r', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-ue', type: 'TEST', name: 't', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-ue', targetId: 'REQ-ue', edgeType: 'verify', attributes: { kept: 'yes' } } },
      ]);
      expect(ok.success).toBe(true);

      const result = await harness.mutate([
        { op: 'update-edge', edge: { sourceId: 'TEST-ue', targetId: 'REQ-ue', edgeType: 'verify' }, set: { attributes: { note: 'patched' } } },
      ]);
      expect(result.success).toBe(true);

      await harness.close();
      const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
      const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
      await harness2.initialize();
      const edge = harness2.getGraph().edges.find(
        (e) => e.sourceId === 'TEST-ue' && e.targetId === 'REQ-ue' && e.edgeType === 'verify',
      );
      expect(edge).toBeDefined();
      expect(edge?.attributes.note).toBe('patched');
      expect(edge?.attributes.kept).toBe('yes'); // patch merges, does not replace
      harness = harness2;
    });

    it('BLOCKS when the flipped edge is an illegal pair (R-18), atomically', async () => {
      const ok = await harness.mutate([
        { op: 'add-node', node: { uid: 'REQ-fl', type: 'REQ', name: 'r', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-fl', type: 'TEST', name: 't', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-fl', targetId: 'REQ-fl', edgeType: 'verify', attributes: {} } },
      ]);
      expect(ok.success).toBe(true);

      // REQ -verify-> TEST is not a TRACE_PATTERNS pair → gate blocks, original edge intact.
      const result = await harness.mutate([
        { op: 'update-edge', edge: { sourceId: 'TEST-fl', targetId: 'REQ-fl', edgeType: 'verify' }, set: { flip: true } },
      ]);
      expect(result.success).toBe(false);
      expect(result.tier).toBe('block');
      const edges = harness.getGraph().edges;
      expect(edges.some((e) => e.sourceId === 'TEST-fl' && e.targetId === 'REQ-fl' && e.edgeType === 'verify')).toBe(true);
      expect(edges.some((e) => e.sourceId === 'REQ-fl' && e.targetId === 'TEST-fl')).toBe(false);
    });

    it('is a no-op (mutations 0) on an unknown edge', async () => {
      const result = await harness.mutate([
        { op: 'update-edge', edge: { sourceId: 'NO-a', targetId: 'NO-b', edgeType: 'relation' }, set: { flip: true } },
      ]);
      expect(result.success).toBe(true);
      expect(result.mutations).toBe(0);
    });
  });

  describe('merge-nodes (CR-GC-238)', () => {
    it('rewires all incident edges of source onto target and deletes source', async () => {
      const ok = await harness.mutate([
        { op: 'add-node', node: { uid: 'REQ-keep', type: 'REQ', name: 'keep', attributes: {} } },
        { op: 'add-node', node: { uid: 'REQ-gone', type: 'REQ', name: 'gone', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-k', type: 'TEST', name: 'tk', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-g', type: 'TEST', name: 'tg', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-k', targetId: 'REQ-keep', edgeType: 'verify', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-g', targetId: 'REQ-gone', edgeType: 'verify', attributes: {} } },
      ]);
      expect(ok.success).toBe(true);

      const result = await harness.mutate([
        { op: 'merge-nodes', sourceUid: 'REQ-gone', targetUid: 'REQ-keep' },
      ]);
      expect(result.success).toBe(true);
      expect(result.appliedCommands).toBe(1); // one semantic audit entry

      // PERSISTENCE: rewire + delete survive a disk reload.
      await harness.close();
      const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
      const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
      await harness2.initialize();
      const g = harness2.getGraph();
      expect(g.nodes.some((n) => n.uid === 'REQ-gone')).toBe(false);
      expect(g.edges.some((e) => e.sourceId === 'TEST-g' && e.targetId === 'REQ-keep' && e.edgeType === 'verify')).toBe(true);
      expect(g.edges.some((e) => e.targetId === 'REQ-gone')).toBe(false);
      harness = harness2;
    });

    it('BLOCKS (tier block) when the merged result is structurally illegal', async () => {
      const ok = await harness.mutate([
        { op: 'add-node', node: { uid: 'REQ-m', type: 'REQ', name: 'r', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-m1', type: 'TEST', name: 't1', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-m2', type: 'TEST', name: 't2', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-m1', targetId: 'REQ-m', edgeType: 'verify', attributes: {} } },
      ]);
      expect(ok.success).toBe(true);

      // Absorbing REQ-m into TEST-m2 would rewire TEST-m1 -verify-> TEST-m2 (illegal pair).
      const result = await harness.mutate([
        { op: 'merge-nodes', sourceUid: 'REQ-m', targetUid: 'TEST-m2' },
      ]);
      expect(result.success).toBe(false);
      expect(result.tier).toBe('block');
      // Rollback: source node and original edge untouched.
      const g = harness.getGraph();
      expect(g.nodes.some((n) => n.uid === 'REQ-m')).toBe(true);
      expect(g.edges.some((e) => e.sourceId === 'TEST-m1' && e.targetId === 'REQ-m' && e.edgeType === 'verify')).toBe(true);
    });
  });
});
