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

/** A-SPICE requirement layer, read off the compose anchor (CR-GC-317). */
export type ReqLevel = 'system' | 'functional' | 'derived';

/**
 * Which layer(s) a REQ sits on, derived from its compose ANCHOR (CR-GC-317):
 * `SYS -compose-> REQ` is a system requirement (A-SPICE SYS.2), `UC -compose-> REQ` a
 * functional one (SWE.1), `REQ -compose-> REQ` a derived one. The separation an assessor
 * looks for is already in the graph — it was just never rendered.
 *
 * Position, not attribute — same call as `levelsOfTest` (CR-GC-240) and for the same
 * reason: real nodes almost never carry a level attribute, so an attribute-based read
 * degenerates to "everything unassigned" on a fully modelled graph. The anchor is always
 * there.
 *
 * A REQ anchored under both a SYS and a UC carries BOTH levels. Collapsing that to one
 * winner would invent a precision the model does not have.
 */
export function reqLevels(
  reqUid: string,
  idx: Map<string, GraphNode>,
  compose: { rev: Map<string, string[]> },
): Set<ReqLevel> {
  const levels = new Set<ReqLevel>();
  for (const parent of compose.rev.get(reqUid) ?? []) {
    const type = idx.get(parent)?.type;
    if (type === 'SYS') levels.add('system');
    else if (type === 'UC') levels.add('functional');
    else if (type === 'REQ') levels.add('derived');
  }
  return levels;
}

/** One FUNC↔FUNC interface and the tests that actually cover it (CR-GC-317). */
export interface RolledUpConnection {
  /** Producer FUNC uid. */
  from: string;
  /** Consumer FUNC uid. */
  to: string;
  /** The FLOW they exchange. */
  via: string;
  /** FCHAINs declaring this pair as one integration scope. */
  chains: string[];
  /** TEST uids covering the connection through the full chain. */
  tests: string[];
}

/**
 * Every FUNC→FLOW→FUNC connection with the TESTs that cover it, rolled up over the
 * four-hop chain `TEST -verify-> REQ <-satisfy- FCHAIN -compose-> FUNC` (CR-GC-317).
 *
 * That walk is what an assessor otherwise does by hand to answer "which test covers this
 * interface?". GVE already renders such hidden links rolled up; the deterministic views
 * did not.
 *
 * Only pairs sharing an FCHAIN are reported. Co-adjacency at a shared FLOW is not a
 * declared interface — deriving connections from it manufactures P·C pairs per hub FLOW
 * and taxes reuse (the R-21 defect, CR-GC-315). The FCHAIN is the declared scope.
 *
 * Deterministic: results sorted by (from, to, via), uid lists sorted within.
 */
export function rolledUpCoverage(
  graph: Graph,
  idx: Map<string, GraphNode>,
  io: { fwd: Map<string, string[]>; rev: Map<string, string[]> },
  compose: { fwd: Map<string, string[]>; rev: Map<string, string[]> },
  satisfy: { fwd: Map<string, string[]>; rev: Map<string, string[]> },
  verify: { rev: Map<string, string[]> },
): RolledUpConnection[] {
  const isFunc = (uid: string): boolean => idx.get(uid)?.type === 'FUNC';
  // FCHAIN → its FUNCs, and the reverse lookup a pair needs.
  const chainFuncs = new Map<string, Set<string>>();
  for (const n of graph.nodes) {
    if (n.type !== 'FCHAIN') continue;
    chainFuncs.set(n.uid, new Set((compose.fwd.get(n.uid) ?? []).filter(isFunc)));
  }

  const out: RolledUpConnection[] = [];
  for (const n of graph.nodes) {
    if (n.type !== 'FLOW') continue;
    const producers = (io.rev.get(n.uid) ?? []).filter(isFunc);
    const consumers = (io.fwd.get(n.uid) ?? []).filter(isFunc);
    for (const from of producers) {
      for (const to of consumers) {
        if (from === to) continue;
        const chains = [...chainFuncs.entries()]
          .filter(([, funcs]) => funcs.has(from) && funcs.has(to))
          .map(([uid]) => uid)
          .sort((a, b) => a.localeCompare(b));
        if (chains.length === 0) continue;
        const tests = new Set<string>();
        for (const chain of chains) {
          for (const reqUid of satisfy.fwd.get(chain) ?? []) {
            for (const t of verify.rev.get(reqUid) ?? []) tests.add(t);
          }
        }
        out.push({
          from,
          to,
          via: n.uid,
          chains,
          tests: [...tests].sort((a, b) => a.localeCompare(b)),
        });
      }
    }
  }
  return out.sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.via.localeCompare(b.via),
  );
}

/** Recorded outcome of a TEST run, or '' when none was recorded (VR-01). */
export function testResult(n: GraphNode): string {
  return String(n.attributes['testResult'] ?? '');
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

