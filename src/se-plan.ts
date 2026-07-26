/**
 * se-plan — graph-derived implementation-plan ordering (CR-GC-209).
 *
 * The testable core behind the generative `se-plan` skill: derive a build order
 * from the model's `depends-on` dependency DAG (a `relation` edge whose
 * `attributes.label === 'depends-on'`, e.g. MS→MS milestone dependencies). The
 * skill (`.claude/skills/se-plan.md`) reasons over the graph and writes the
 * MS/CR/relation nodes through the gate; THIS function is the deterministic
 * ordering spec the test pins (and the eventual core of an out-of-scope
 * server-side `graph_plan` tool). It is NOT a parallel renderer — `se-view:implplan`
 * RENDERS an existing plan; this DERIVES the order.
 *
 * A plan must (a) respect every `depends-on` (a prerequisite precedes its
 * dependent), (b) refuse to silently order a cycle, and (c) surface a
 * "forward dependency" — a lower-numbered item that depends on a higher-numbered
 * one, where naive id-order would violate the dependency.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphEdge } from '@sigloch/graph-api-core';

export interface ImplPlanResult {
  /** Topo-sorted uids — every `depends-on` respected (prerequisite before dependent). */
  order: string[];
  /** Dependency cycles (each a uid list) — unorderable, must be broken before building. */
  cycles: string[][];
  /**
   * `depends-on` edges where a lower-numbered item depends on a higher-numbered one
   * (the forward-dependency anomaly: building in id-order would violate the dependency).
   */
  forwardViolations: Array<{ from: string; to: string }>;
}

const DEPENDS_ON = 'depends-on';

/** A `depends-on` dependency edge: `relation` + `label: 'depends-on'`, or the bare edgeType. */
function isDependsOn(e: GraphEdge): boolean {
  return (
    e.edgeType === DEPENDS_ON ||
    (e.edgeType === 'relation' && (e.attributes as { label?: string })?.label === DEPENDS_ON)
  );
}

/** The last run of digits in a uid (`CR-GC-209` → 209), for forward-dependency detection. */
function idNum(uid: string): number | null {
  const m = uid.match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : null;
}

/**
 * Derive the build order from the graph's `depends-on` DAG. `source depends-on target`
 * means target is the prerequisite (target precedes source). Deterministic: the
 * zero-indegree frontier is drained in uid order, so a given graph always yields the
 * same plan.
 */
export function deriveImplPlan(graph: Pick<Graph, 'nodes' | 'edges'>): ImplPlanResult {
  const deps = graph.edges.filter(isDependsOn);

  const involved = new Set<string>();
  for (const e of deps) {
    involved.add(e.sourceId);
    involved.add(e.targetId);
  }

  // Edge target → source (prerequisite points at its dependents); indegree on dependents.
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const uid of involved) {
    adj.set(uid, []);
    indeg.set(uid, 0);
  }
  for (const e of deps) {
    adj.get(e.targetId)!.push(e.sourceId);
    indeg.set(e.sourceId, (indeg.get(e.sourceId) ?? 0) + 1);
  }

  // Kahn topological sort, deterministic frontier order.
  const order: string[] = [];
  const frontier = [...involved].filter((u) => indeg.get(u) === 0).sort();
  while (frontier.length) {
    const u = frontier.shift()!;
    order.push(u);
    for (const v of [...(adj.get(u) ?? [])].sort()) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if (indeg.get(v) === 0) {
        frontier.push(v);
        frontier.sort();
      }
    }
  }

  // Anything never emitted sits in a cycle — reported, never silently ordered.
  const emitted = new Set(order);
  const cyclic = [...involved].filter((u) => !emitted.has(u)).sort();
  const cycles = cyclic.length ? [cyclic] : [];

  // Forward dependency: source depends-on a higher-numbered target.
  const forwardViolations = deps
    .filter((e) => {
      const a = idNum(e.sourceId);
      const b = idNum(e.targetId);
      return a !== null && b !== null && a < b;
    })
    .map((e) => ({ from: e.sourceId, to: e.targetId }))
    .sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to));

  return { order, cycles, forwardViolations };
}
