/**
 * CR-SM-309: IO-02 ("a FLOW has exactly ONE producer", error) carries gate power.
 *
 * Before, graph-api-core gated only R-/RD-/MT-: IO-02 was evaluated and counted in
 * readiness, but a batch that put a second producer on a FLOW passed the gate
 * (measured in CR-GC-511 — two scripted repairs did exactly that, `success: true`).
 * The one-FLOW-per-connection cut of CR-GC-510 was therefore reported, not enforced.
 *
 * Three cases on the same fixture: the violation is refused, and the two legal shapes
 * next to it — another READER, and the IO-02 fix itself (own FLOW, shared SCHEMA) —
 * still pass, so the block is IO-02 and not collateral.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';

const addEdge = (sourceId: string, edgeType: string, targetId: string) =>
  ({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: {} } }) as unknown as MutateCommand;

describe('CR-SM-309: IO-02 blocks at the Apply-Gate', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-io02-gate-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(ARCH_FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const hasEdge = (s: string, t: string) => harness.getGraph().edges.some((e) => e.sourceId === s && e.targetId === t && e.edgeType === 'io');

  it('a second producer on an existing FLOW is refused, and IO-02 is the reason', async () => {
    // FLOW-document is already sent by ACTOR-operator.
    const res = await harness.mutate([addEdge('ACTOR-auditor', 'io', 'FLOW-document')]);
    expect(res.success).toBe(false);
    const blocking = (res.violations ?? []).filter((v) => v.severity === 'error').map((v) => v.ruleId);
    expect(blocking).toEqual(['IO-02']);
    expect(hasEdge('ACTOR-auditor', 'FLOW-document'), 'a refused batch must not reach the store').toBe(false);
  });

  it('another READER is not a producer — passes', async () => {
    const res = await harness.mutate([addEdge('FLOW-result', 'io', 'ACTOR-auditor')]);
    expect(res.success).toBe(true);
    expect(harness.evaluateRules().filter((v) => v.ruleId === 'IO-02')).toEqual([]);
  });

  it("the IO-02 fix — the new source gets its own FLOW, the SCHEMA is shared — passes", async () => {
    const res = await harness.mutate([
      { op: 'add-node', node: { uid: 'FLOW-review-request', type: 'FLOW', name: 'review request', description: 'The result the auditor hands back into the review chain.', attributes: {} } } as unknown as MutateCommand,
      addEdge('ACTOR-auditor', 'io', 'FLOW-review-request'),
      addEdge('FLOW-review-request', 'io', 'FUNC-render'),
      { op: 'add-edge', edge: { sourceId: 'FLOW-review-request', targetId: 'SCHEMA-result', edgeType: 'relation', attributes: {} } } as unknown as MutateCommand,
    ]);
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(harness.evaluateRules().filter((v) => v.ruleId === 'IO-02')).toEqual([]);
  });
});
