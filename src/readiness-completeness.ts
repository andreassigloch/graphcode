/**
 * readiness-completeness.ts — the COMPLETENESS dimension of readiness (CR-GC-250,
 * split out of readiness.ts by CR-GC-260).
 *
 * Its own module because it answers a different question than the rest of readiness:
 * compliance/gates ask "does any element violate a rule", completeness asks "is the
 * structural chain covered at all" — the absence case rules cannot see (0 FCHAIN → a
 * per-element warning rule fires 0 times and the gate reads green).
 *
 * BROWSER-SAFE — no `node:*` import may enter this file: the panels layer builds on it.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph } from '@sigloch/graph-api-core';

// Completeness dimension (CR-GC-250) — structural chain coverage, orthogonal to
// violation severity. Closes the graph-view-edit false-green (irr-3e4e26c
// A2/A12/A13): the chain-completeness V3_RULES are warning-severity AND
// per-element, so they never fire on ABSENT elements (0 FCHAIN → R-15 fires 0×).
// Coverage iterates the DRIVING population instead, so absence counts against
// the gate. Reads the meta-model's own `1..*` cardinalities — no new rule, no
// severity change, no @sigloch/contracts bump.
// ---------------------------------------------------------------------------

export type CGraph = Pick<Graph, 'nodes' | 'edges'>;
export type CNode = Graph['nodes'][number];

/** A gate's structural completeness over its driving population. */
export interface GateCompleteness {
  /** Source elements whose chain leg is complete. */
  covered: number;
  /** Total source elements evaluated across the gate's legs (the denominator). */
  total: number;
  /** Per-leg misses as `"<leg>: <uid>"` — the on-click drill-down detail. */
  missing: string[];
}

/** Neutral completeness for gates that carry no chain slice (impl gates). */
export const NEUTRAL_COMPLETENESS: GateCompleteness = { covered: 0, total: 0, missing: [] };

/**
 * One completeness leg: every node of `sourceType` (the driving population)
 * must satisfy `holds`, else it is a `missing` source for the owning gate.
 * Cardinality legs use the id `"<SRC>→<TGT>"` so the drift test can match them
 * against the meta-model's `1..*` patterns.
 */
export interface CompletenessLeg {
  id: string;
  sourceType: string;
  holds: (node: CNode, graph: CGraph, byId: Map<string, CNode>) => boolean;
}

export const typeOf = (byId: Map<string, CNode>, id: string): string | undefined => byId.get(id)?.type;

/** True iff `src` has ≥1 out-edge of `edgeType` to a node of `targetType`. */
export function hasOutTo(g: CGraph, byId: Map<string, CNode>, src: string, edgeType: string, targetType: string): boolean {
  return g.edges.some((e) => e.sourceId === src && e.edgeType === edgeType && typeOf(byId, e.targetId) === targetType);
}

export const refFile = (ref: unknown): string | undefined => (ref as { file?: string } | null | undefined)?.file;
export const hasTestRef = (n: CNode): boolean => !!refFile(n.attributes?.testRef);
export const hasCodeRef = (n: CNode): boolean => !!refFile(n.attributes?.realRef);
/** A leaf FUNC has no `compose→FUNC` children (parents are realized by children — meta-model §28). */
export const isLeafFunc = (n: CNode, g: CGraph, byId: Map<string, CNode>): boolean => !hasOutTo(g, byId, n.uid, 'compose', 'FUNC');

/**
 * A FCHAIN is actor-bounded iff its function set has a trigger AND a consumer:
 * `ACTOR —io→ FLOW —io→ FUNC∈chain` (entry) and `FUNC∈chain —io→ FLOW —io→ ACTOR`
 * (exit). Catches the "hollow chain" — functions with no who-triggers / who-consumes.
 */
export function fchainActorBounded(fchain: CNode, g: CGraph, byId: Map<string, CNode>): boolean {
  const funcs = new Set(
    g.edges.filter((e) => e.sourceId === fchain.uid && e.edgeType === 'compose' && typeOf(byId, e.targetId) === 'FUNC').map((e) => e.targetId),
  );
  if (funcs.size === 0) return false;
  const io = g.edges.filter((e) => e.edgeType === 'io');
  const entry = io.some(
    (e) => funcs.has(e.targetId) && typeOf(byId, e.sourceId) === 'FLOW' &&
      io.some((a) => a.targetId === e.sourceId && typeOf(byId, a.sourceId) === 'ACTOR'),
  );
  const exit = io.some(
    (e) => funcs.has(e.sourceId) && typeOf(byId, e.targetId) === 'FLOW' &&
      io.some((a) => a.sourceId === e.targetId && typeOf(byId, a.targetId) === 'ACTOR'),
  );
  return entry && exit;
}

/**
 * Phase-gate → chain legs that must be complete AT THAT PHASE. `concept:true`
 * stays valid through CDR (spec allows unbound tests/funcs); only TRR demands
 * real bindings. The `1..*` cardinality legs (SYS→UC, UC→FCHAIN, UC→REQ,
 * FCHAIN→FUNC) are drift-locked against the meta-model by TEST-readiness-completeness.
 */
export const COMPLETENESS_SLICES: Record<string, CompletenessLeg[]> = {
  // Behavioral spine exists: system has use cases, every UC derives a chain AND requirements.
  SRR: [
    { id: 'SYS→UC', sourceType: 'SYS', holds: (n, g, b) => hasOutTo(g, b, n.uid, 'compose', 'UC') },
    { id: 'UC→FCHAIN', sourceType: 'UC', holds: (n, g, b) => hasOutTo(g, b, n.uid, 'compose', 'FCHAIN') },
    { id: 'UC→REQ', sourceType: 'UC', holds: (n, g, b) => hasOutTo(g, b, n.uid, 'compose', 'REQ') },
  ],
  // Functional architecture: every chain has functions AND is actor-bounded (trigger + consumer).
  PDR: [
    { id: 'FCHAIN→FUNC', sourceType: 'FCHAIN', holds: (n, g, b) => hasOutTo(g, b, n.uid, 'compose', 'FUNC') },
    { id: 'FCHAIN-actor-bounded', sourceType: 'FCHAIN', holds: (n, g, b) => fchainActorBounded(n, g, b) },
  ],
  // Interfaces carry a data contract: every FLOW has a SCHEMA (CR-GC-106 schema-before-code).
  CDR: [
    { id: 'FLOW→SCHEMA', sourceType: 'FLOW', holds: (n, g, b) => hasOutTo(g, b, n.uid, 'relation', 'SCHEMA') },
  ],
  // Binding: tests are runnable and leaf functions carry code — concept no longer counts here.
  TRR: [
    { id: 'TEST.testRef', sourceType: 'TEST', holds: (n) => hasTestRef(n) },
    { id: 'FUNC.realRef', sourceType: 'FUNC', holds: (n, g, b) => !isLeafFunc(n, g, b) || hasCodeRef(n) },
  ],
};

/**
 * Score one phase gate's structural completeness over its driving population.
 * `total === 0` (no source elements to cover) → vacuously complete (ratio 1).
 */
export function scoreCompleteness(gateId: string, graph: CGraph): GateCompleteness {
  const legs = COMPLETENESS_SLICES[gateId] ?? [];
  const byId = new Map<string, CNode>(graph.nodes.map((n) => [n.uid, n]));
  let covered = 0;
  let total = 0;
  const missing: string[] = [];
  for (const leg of legs) {
    for (const node of graph.nodes) {
      if (node.type !== leg.sourceType) continue;
      total += 1;
      if (leg.holds(node, graph, byId)) covered += 1;
      else missing.push(`${leg.id}: ${node.uid}`);
    }
  }
  return { covered, total, missing };
}
