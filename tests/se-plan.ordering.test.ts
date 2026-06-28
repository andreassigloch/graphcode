/**
 * TEST-se-plan-ordering (CR-GC-209) — the graph-derived implementation-plan order.
 *
 * Skill-agnostic: pins the topological derivation against a seeded graph, not the
 * prompt text. A `depends-on` chain must order so every prerequisite precedes its
 * dependent; an intentional forward dependency must be REPORTED (not silently
 * ordered); a cycle must be reported and its nodes left out of the order.
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { deriveImplPlan } from '../src/se-plan.js';

const node = (uid: string) => ({ uid, type: 'MS', name: uid, description: '', attributes: {} });
const dep = (from: string, to: string) => ({
  // `from depends-on to` — to is the prerequisite.
  sourceId: from,
  targetId: to,
  edgeType: 'relation',
  attributes: { label: 'depends-on' },
});

describe('TEST-se-plan-ordering (CR-GC-209): graph-derived plan order', () => {
  it('orders a depends-on chain so every prerequisite precedes its dependent', () => {
    // MS-2 depends-on MS-1, MS-3 depends-on MS-2  +  forward anomaly: MS-1 depends-on MS-4.
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-1', 'MS-2', 'MS-3', 'MS-4'].map(node),
      edges: [dep('MS-2', 'MS-1'), dep('MS-3', 'MS-2'), dep('MS-1', 'MS-4')],
    };
    const plan = deriveImplPlan(graph);
    const pos = (u: string) => plan.order.indexOf(u);

    // Every depends-on edge respected: target before source.
    for (const e of graph.edges) {
      expect(pos(e.targetId)).toBeGreaterThanOrEqual(0);
      expect(pos(e.targetId)).toBeLessThan(pos(e.sourceId));
    }
    // The forward anomaly (MS-1 depends on higher-numbered MS-4) is the prerequisite —
    // so MS-4 lands first despite its id; the plan does not follow naive id order.
    expect(plan.order[0]).toBe('MS-4');
    expect(plan.cycles).toEqual([]);
  });

  it('REPORTS a forward dependency (lower id depends on higher id), not silently', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-1', 'MS-2', 'MS-3', 'MS-4'].map(node),
      edges: [dep('MS-2', 'MS-1'), dep('MS-3', 'MS-2'), dep('MS-1', 'MS-4')],
    };
    const plan = deriveImplPlan(graph);
    expect(plan.forwardViolations).toContainEqual({ from: 'MS-1', to: 'MS-4' });
    // The clean backward deps (MS-2→MS-1, MS-3→MS-2) are NOT flagged.
    expect(plan.forwardViolations).toHaveLength(1);
  });

  it('reports a cycle and refuses to silently order its nodes', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-5', 'MS-6', 'MS-7'].map(node),
      edges: [dep('MS-5', 'MS-6'), dep('MS-6', 'MS-5'), dep('MS-7', 'MS-6')],
    };
    const plan = deriveImplPlan(graph);
    expect(plan.cycles.length).toBeGreaterThan(0);
    expect(plan.cycles[0]).toEqual(expect.arrayContaining(['MS-5', 'MS-6']));
    // Cyclic nodes are not in the order (not vacuously "ordered").
    expect(plan.order).not.toContain('MS-5');
    expect(plan.order).not.toContain('MS-6');
  });

  it('ignores non-depends-on relation edges (CR→MS assignment is not a dependency)', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['CR-a', 'MS-1'].map(node),
      edges: [{ sourceId: 'CR-a', targetId: 'MS-1', edgeType: 'relation', attributes: {} }],
    };
    const plan = deriveImplPlan(graph);
    // No depends-on edges → empty plan, nothing to order, no false cycle.
    expect(plan.order).toEqual([]);
    expect(plan.cycles).toEqual([]);
    expect(plan.forwardViolations).toEqual([]);
  });
});
