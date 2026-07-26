/**
 * views/helpers.ts — deterministic graph-projection helpers for the Markdown views
 * (MOD-docs / FUNC-render-views, split out of exporter-views.ts by CR-GC-260).
 *
 * DETERMINISM (the core requirement): nodes/edges are iterated in a STABLE order
 * sorted by uid (and, for traces, by source/type/target). No `Date`, no
 * `Math.random`, no unordered Map/Set iteration reaches the output — every Map is
 * read back through a sorted key list. Same graph → byte-identical bytes.
 *
 * The lower-level primitives (generatedHeader / byUid / cell) stay in exporter.ts —
 * one renderer, no parallel paths. These are the graph-shaped ones every view needs.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphNode } from '@sigloch/graph-api-core';
import { byUid } from '../exporter.js';

export function nodesOfType(graph: Graph, type: string): GraphNode[] {
  return graph.nodes.filter((n) => n.type === type).sort(byUid);
}

/** uid → node lookup (for name/attr resolution). */
export function nodeIndex(graph: Graph): Map<string, GraphNode> {
  const m = new Map<string, GraphNode>();
  for (const n of graph.nodes) m.set(n.uid, n);
  return m;
}

/**
 * Index `edgeType` edges as source → sorted targets[] and target → sorted
 * sources[]. Values are sorted, so any later iteration over them is stable.
 */
export function adjacency(graph: Graph, edgeType: string): {
  fwd: Map<string, string[]>; // source → targets
  rev: Map<string, string[]>; // target → sources
} {
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string): void => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };
  for (const e of graph.edges) {
    if (e.edgeType !== edgeType) continue;
    push(fwd, e.sourceId, e.targetId);
    push(rev, e.targetId, e.sourceId);
  }
  for (const arr of fwd.values()) arr.sort((a, b) => a.localeCompare(b));
  for (const arr of rev.values()) arr.sort((a, b) => a.localeCompare(b));
  return { fwd, rev };
}

/** REQ.kinds → string[]; tolerant of missing / non-array. */
export function reqKinds(n: GraphNode): string[] {
  const k = n.attributes['kinds'];
  return Array.isArray(k) ? k.map(String) : [];
}

/**
 * TEST level from nested testRef.level, falling back to a top-level `level` attr.
 * Descriptive test-inventory metadata only (CR-GC-240) — the pyramid classification
 * in renderTestConcept uses levelsOfTest() (graph position), not this attribute.
 */
export function testLevel(n: GraphNode): string {
  const ref = n.attributes['testRef'] as { level?: unknown } | null | undefined;
  if (ref && typeof ref === 'object' && typeof ref.level === 'string') return ref.level;
  const top = n.attributes['level'];
  return typeof top === 'string' ? top : '';
}

/**
 * Pyramid level(s) of a TEST, derived from the graph POSITION of the REQ(s) it
 * verifies (CR-GC-240) — a real TEST node almost never carries testRef.level, so
 * an attribute-based classification degenerates to all-unleveled even when every
 * REQ is verified. A test verifying a SYS-composed REQ is System/e2e; a UC-composed
 * REQ is Use-Case/integration; a FUNC-satisfied REQ is Function/unit; an
 * FCHAIN-satisfied REQ is also integration (the chain wires FUNC↔FUNC, so its
 * test is an interface/integration test — CR for R-21). A test inherits every
 * level of every REQ it verifies (multi-assignment allowed).
 */
export function levelsOfTest(
  t: GraphNode,
  idx: Map<string, GraphNode>,
  verify: { fwd: Map<string, string[]> },
  compose: { rev: Map<string, string[]> },
  satisfy: { rev: Map<string, string[]> },
): Set<'e2e' | 'integration' | 'unit'> {
  const levels = new Set<'e2e' | 'integration' | 'unit'>();
  for (const reqUid of verify.fwd.get(t.uid) ?? []) {
    for (const parent of compose.rev.get(reqUid) ?? []) {
      const type = idx.get(parent)?.type;
      if (type === 'SYS') levels.add('e2e');
      else if (type === 'UC') levels.add('integration');
    }
    for (const satisfier of satisfy.rev.get(reqUid) ?? []) {
      const st = idx.get(satisfier)?.type;
      if (st === 'FUNC') levels.add('unit');
      else if (st === 'FCHAIN') levels.add('integration');
    }
  }
  return levels;
}

export function status(n: GraphNode): string {
  return String(n.attributes['status'] ?? '');
}

/** A code-spanned uid, or `—` when absent. */
export function ref(uid: string | undefined): string {
  return uid ? `\`${uid}\`` : '—';
}

/** Join a sorted uid list as code spans, or `—`. */
export function refList(uids: string[] | undefined): string {
  if (!uids || uids.length === 0) return '—';
  return uids.map((u) => `\`${u}\``).join(' · ');
}
/**
 * Deterministic topological order of milestones by the depends-on relation
 * (dependency before dependent). Ties and cycles fall back to uid order. Pure.
 */
export function topoOrderMilestones(graph: Graph, milestones: GraphNode[]): GraphNode[] {
  const ids = new Set(milestones.map((m) => m.uid));
  // depends-on: source depends-on target → target must come first.
  const deps = new Map<string, Set<string>>(); // node → its prerequisites
  for (const m of milestones) deps.set(m.uid, new Set());
  for (const e of graph.edges) {
    if (e.attributes['label'] !== 'depends-on') continue;
    if (!ids.has(e.sourceId) || !ids.has(e.targetId)) continue;
    deps.get(e.sourceId)!.add(e.targetId);
  }
  const remaining = milestones.map((m) => m.uid).sort((a, b) => a.localeCompare(b));
  const placed = new Set<string>();
  const order: string[] = [];
  // Kahn-style with uid tiebreak; bounded by node count to avoid infinite loop on a cycle.
  for (let guard = 0; guard < milestones.length && remaining.length > placed.size; guard++) {
    let progressed = false;
    for (const uid of remaining) {
      if (placed.has(uid)) continue;
      const prereqs = deps.get(uid)!;
      if ([...prereqs].every((p) => placed.has(p) || !ids.has(p))) {
        order.push(uid);
        placed.add(uid);
        progressed = true;
      }
    }
    if (!progressed) break; // cycle — emit the rest in uid order below.
  }
  for (const uid of remaining) if (!placed.has(uid)) order.push(uid);
  const idx = nodeIndex(graph);
  return order.map((uid) => idx.get(uid)!).filter(Boolean);
}

