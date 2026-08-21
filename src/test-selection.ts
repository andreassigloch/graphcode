/**
 * FUNC-resolve-tests-from-code — the code→REQ→TEST resolution, as a pure function
 * over a loaded graph (CR-GC-381, extracted from `harness.testImpact`, CR-GC-204).
 *
 * A code changeset (MOD/FUNC) cannot reach its TESTs through plain incoming impact:
 * the chain is `TEST -verify-> REQ <-satisfy- FUNC -allocate-> MOD`, which turns
 * direction TWICE. So from a changed code node we walk the realization traces
 * DIRECTIONALLY to the spec nodes it fulfils, then collect the TESTs verifying them:
 *   - `satisfy` (out) : a MOD/FUNC/FCHAIN → the REQ/UC it fulfils   → a spec anchor
 *   - `allocate` (in) : a MOD ← the FUNC allocated to it            → expand the function
 *   - `verify`  (in)  : a spec ← the TEST that verifies it          → an impacted test
 * A REQ changeset degenerates to `verify`-dependents only.
 *
 * Why pure and why here: two consumers need the SAME semantics — the MCP tool
 * `graph_tests` (over the live Kuzu store) and the measurement instrument
 * `scripts/test-selection-audit.mjs` (over the committed snapshot, no second DB
 * handle). A second hand-written traversal in the script would be a parallel path
 * that drifts silently; this module is the single source of the edge semantics.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';

/** Result of a resolution run: the directed subgraph plus the ids it separated out. */
export interface TestImpactResult extends Graph {
  /** The realization closure: changeset ∪ the spec nodes it fulfils. */
  anchors: string[];
  /** The impacted TEST nodes (uids) — the selective test set. */
  testIds: string[];
}

/**
 * code/spec changeset → impacted TESTs over the realization traces.
 *
 * `graph` is the whole loaded graph (the caller decides where it comes from: the
 * Kuzu store or a committed snapshot). `depth` is a floor of 4 hops — code→FUNC→
 * REQ→TEST needs up to three directed turns, so a smaller caller default must not
 * cut the chain short; callers may ask for more.
 */
export function impactedTests(graph: Graph, changeSet: string[], depth = 4): TestImpactResult {
  const nodeById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.uid, n]));
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  const index = (map: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void => {
    const bucket = map.get(key);
    if (bucket) bucket.push(edge);
    else map.set(key, [edge]);
  };
  for (const e of graph.edges) {
    index(outgoing, e.sourceId, e);
    index(incoming, e.targetId, e);
  }

  const edgeMap = new Map<string, GraphEdge>();
  const anchors = new Set<string>(changeSet); // realization closure (changeset + specs it fulfils)
  const testIds = new Set<string>();
  const visited = new Set<string>();
  const maxHops = Math.max(depth, 4);

  let frontier = [...changeSet];
  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const cur of frontier) {
      if (visited.has(cur)) continue;
      visited.add(cur);
      // The 1-hop neighbourhood of `cur`, classified by trace semantics — the same
      // filtering `graph_expand` does when it prunes by edge type.
      for (const e of [...(outgoing.get(cur) ?? []), ...(incoming.get(cur) ?? [])]) {
        edgeMap.set(`${e.sourceId}|${e.edgeType}|${e.targetId}`, e);
        if (e.edgeType === 'verify' && e.targetId === cur) {
          testIds.add(e.sourceId); // TEST → cur (cur is a verified anchor)
        } else if (e.edgeType === 'satisfy' && e.sourceId === cur && !anchors.has(e.targetId)) {
          anchors.add(e.targetId); // cur → spec
          next.push(e.targetId);
        } else if (e.edgeType === 'allocate' && e.targetId === cur && !anchors.has(e.sourceId)) {
          anchors.add(e.sourceId); // MOD ← FUNC
          next.push(e.sourceId);
        }
      }
    }
    frontier = next;
  }

  // Assemble the directed subgraph: realization anchors ∪ impacted TESTs, with the
  // edges that run BETWEEN kept nodes (a dangling edge would claim a node the caller
  // never receives).
  const keep = new Set<string>([...anchors, ...testIds]);
  const nodes = [...keep].map((id) => nodeById.get(id)).filter((n): n is GraphNode => n !== undefined);
  const edges = [...edgeMap.values()].filter((e) => keep.has(e.sourceId) && keep.has(e.targetId));
  return { nodes, edges, anchors: [...anchors], testIds: [...testIds] };
}
