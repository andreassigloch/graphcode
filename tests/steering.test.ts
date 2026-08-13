/**
 * TEST-steering (CR-223 / ST-5): graph_next_step condenses violations into one action.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { nextStep } from '../src/steering.js';

function node(uid: string, type: string, name: string, description = '', attributes: Record<string, unknown> = {}): GraphNode {
  return { uid, type, name, description, attributes };
}
function edge(sourceId: string, edgeType: string, targetId: string): GraphEdge {
  return { sourceId, targetId, edgeType, attributes: {} };
}

/** Graph that is reasonably complete EXCEPT module allocation (FUNCs unallocated, MODs empty). */
function allocDeficientGraph(): Graph {
  const nodes: GraphNode[] = [
    node('Customer.AC.001', 'ACTOR', 'Customer'),
    node('PlaceOrder.UC.001', 'UC', 'Place Order', 'The customer shall place an order within 2 seconds via the app'),
    node('OrderReq.RQ.001', 'REQ', 'Order Requirement', 'The system shall persist the order within 500 ms', { kinds: ['functional'] }),
    node('OrderReq.RQ.002', 'REQ', 'Precond', 'The customer shall be authenticated before ordering', { kinds: ['precondition'] }),
    node('OrderReq.RQ.003', 'REQ', 'Postcond', 'The system shall confirm the order after persistence', { kinds: ['postcondition'] }),
    node('OrderChain.FC.001', 'FCHAIN', 'Order Chain'),
    node('Validate.FN.001', 'FUNC', 'Validate Order'),
    node('Persist.FN.002', 'FUNC', 'Persist Order'),
    node('OrderData.FL.001', 'FLOW', 'Order Data'),
    node('OrderTest.TS.001', 'TEST', 'Order Test', '', { testResult: 'passed' }),
    node('Backend.MD.001', 'MOD', 'Backend'),
    node('Frontend.MD.002', 'MOD', 'Frontend'),
  ];
  const edges: GraphEdge[] = [
    edge('Customer.AC.001', 'io', 'PlaceOrder.UC.001'),
    edge('PlaceOrder.UC.001', 'compose', 'OrderReq.RQ.001'),
    edge('PlaceOrder.UC.001', 'compose', 'OrderReq.RQ.002'),
    edge('PlaceOrder.UC.001', 'compose', 'OrderReq.RQ.003'),
    edge('PlaceOrder.UC.001', 'compose', 'OrderChain.FC.001'),
    edge('OrderChain.FC.001', 'compose', 'Validate.FN.001'),
    edge('OrderChain.FC.001', 'compose', 'Persist.FN.002'),
    edge('Validate.FN.001', 'satisfy', 'OrderReq.RQ.001'),
    edge('Persist.FN.002', 'satisfy', 'OrderReq.RQ.001'),
    edge('OrderTest.TS.001', 'verify', 'OrderReq.RQ.001'),
    edge('Validate.FN.001', 'io', 'OrderData.FL.001'),
    edge('OrderData.FL.001', 'io', 'Persist.FN.002'),
    // NO allocate FUNC->MOD  → R-22 x2 (FUNC unallocated), R-23 x2 (MOD empty)
  ];
  return { nodes, edges };
}

describe('TEST-steering: graph_next_step', () => {
  it('returns a well-formed result with normalized guidance weights', () => {
    const r = nextStep(allocDeficientGraph(), DEFAULT_METRIC_POLICY);
    expect(r).toHaveProperty('blocking');
    expect(r).toHaveProperty('nextStep');
    expect(Array.isArray(r.advisory)).toBe(true);
    expect(Array.isArray(r.blocking.ruleIds)).toBe(true);
    const sum = Object.values(r.weights).reduce((a, b) => a + (b as number), 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('condenses to the highest-deficit actionable dimension (unallocated FUNCs → alloc)', () => {
    // This graph has two unallocated FUNCs and two empty MODs: alloc scores 4/6 = 0.333,
    // below ver's 3/8 = 0.625, so alloc is the step. The blocking count is unaffected —
    // R-01 x2 (the unverified precond/postcond REQs) are errors either way.
    const r = nextStep(allocDeficientGraph(), DEFAULT_METRIC_POLICY);
    expect(r.blocking.errors).toBe(2); // R-01 x2 (precond/postcond REQs unverified)
    expect(r.nextStep).not.toBeNull();
    expect(r.nextStep!.dimension).toBe('alloc');
    expect(r.nextStep!.clears).toEqual(expect.arrayContaining(['R-22 x2', 'R-23 x2']));
    expect(r.nextStep!.action).toMatch(/alloc|modul/i);
  });

  // ---------------------------------------------------------------------
  // CR-GC-324: nextStep must read the SAME Graph→OntologyGraph mapping as the
  // snapshot path. While it built its own og via `JSON.parse(exportGraphJson())`,
  // the flat export encoding hid `attributes.*` and every attribute-reading rule
  // (R-19 testRef, R-20/R-26 realRef, VR-01 testResult) fired against bound nodes.
  // ---------------------------------------------------------------------
  /** Fixture whose TEST/FUNC carry testRef / realRef / testResult in the bag. */
  function boundBindingsGraph(): Graph {
    const g = allocDeficientGraph();
    const test = g.nodes.find((n) => n.uid === 'OrderTest.TS.001')!;
    test.attributes = { testResult: 'passed', testRef: { file: 'tests/order.test.ts', tool: 'vitest' } };
    for (const uid of ['Validate.FN.001', 'Persist.FN.002']) {
      const fn = g.nodes.find((n) => n.uid === uid)!;
      fn.attributes = { realRef: { file: 'src/order.ts', symbol: uid.split('.')[0] } };
    }
    return g;
  }

  it('sees attribute-carried bindings — no phantom R-19/R-20/R-26/VR-01 findings', () => {
    const r = nextStep(boundBindingsGraph(), DEFAULT_METRIC_POLICY);
    const fired = new Set([...r.blocking.ruleIds, ...r.advisory.map((a) => a.rule_id), ...(r.nextStep?.clears ?? []).map((c) => c.split(' ')[0])]);
    for (const ruleId of ['R-19', 'R-20', 'R-26', 'VR-01']) {
      expect(fired.has(ruleId), `${ruleId} fired although the binding is present`).toBe(false);
    }
  });

  it('still reports a MISSING binding (the fix does not blind the rules)', () => {
    // Same fixture, bindings stripped again → the very same rules must fire.
    const r = nextStep(allocDeficientGraph(), DEFAULT_METRIC_POLICY);
    const fired = new Set([...r.blocking.ruleIds, ...r.advisory.map((a) => a.rule_id), ...(r.nextStep?.clears ?? []).map((c) => c.split(' ')[0])]);
    expect(fired.has('R-19') || fired.has('R-20')).toBe(true);
  });

  it('keeps the unverified REQs (R-01) as blocking errors outside the chosen dimension', () => {
    // Until contracts CR-228 D, R-22/R-23 were unmapped in RULE_TO_DIMENSION and fell
    // through to `advisory`. They are mapped to `alloc` now, so the advisory list holds
    // what is left over — the non-error findings of the other dimensions.
    const r = nextStep(allocDeficientGraph(), DEFAULT_METRIC_POLICY);
    expect(r.blocking.ruleIds).toContain('R-01');
    const advisoryIds = r.advisory.map((a) => a.rule_id);
    expect(advisoryIds).not.toContain('R-22');
    expect(advisoryIds).not.toContain('R-23');
    expect(advisoryIds.length).toBeGreaterThan(0);
  });
});
