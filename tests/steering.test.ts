/**
 * TEST-steering (CR-223 / ST-5): graph_next_step condenses violations into one action.
 */
import { describe, it, expect } from 'vitest';
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
    const r = nextStep(allocDeficientGraph());
    expect(r).toHaveProperty('blocking');
    expect(r).toHaveProperty('nextStep');
    expect(Array.isArray(r.advisory)).toBe(true);
    expect(Array.isArray(r.blocking.ruleIds)).toBe(true);
    const sum = Object.values(r.weights).reduce((a, b) => a + (b as number), 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it('condenses to the highest-deficit actionable dimension (unverified REQs → ver)', () => {
    const r = nextStep(allocDeficientGraph());
    expect(r.blocking.errors).toBe(2); // R-01 x2 (precond/postcond REQs unverified)
    expect(r.nextStep).not.toBeNull();
    expect(r.nextStep!.dimension).toBe('ver');
    expect(r.nextStep!.clears).toContain('R-01 x2');
    expect(r.nextStep!.action).toMatch(/verif/i);
  });

  it('lists unallocated FUNC / empty MOD findings (R-22/R-23) as advisories', () => {
    // NOTE: R-22/R-23 are unmapped in RULE_TO_DIMENSION (stale readiness mapping,
    // pre-existing), so they surface as advisories rather than in a dimension.
    const advisoryIds = nextStep(allocDeficientGraph()).advisory.map((a) => a.rule_id);
    expect(advisoryIds).toContain('R-22');
    expect(advisoryIds).toContain('R-23');
  });
});
