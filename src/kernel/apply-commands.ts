/**
 * apply-commands.ts — ein Mutations-Batch auf einem KANDIDATEN-Graphen (CR-GC-503).
 *
 * Reine Funktion: sie bekommt eine Kopie, wendet die Kommandos an und liefert den
 * Kandidaten samt Persistenz-Delta. Den Arbeitszustand beruehrt sie nicht — ob der
 * Kandidat uebernommen wird, entscheidet das Gate, und schreiben darf ihn nur der
 * GraphStore. Bis CR-GC-503 aenderte GraphCodeHarness `this.graph` in place und rollte
 * bei einem Block per Snapshot zurueck.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { updateEdge, mergeNodes } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';
import type { GraphDelta } from './graph-store.js';

/** Kopie, auf der ein Batch laufen darf, ohne das Original zu veraendern. */
export function cloneGraph(g: Graph): Graph {
  return {
    nodes: g.nodes.map((n) => ({ ...n, attributes: { ...n.attributes } })),
    edges: g.edges.map((e) => ({ ...e, attributes: { ...e.attributes } })),
  };
}

/** Edges by their store identity (source|type|target) — first occurrence wins. */
function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.sourceId}|${e.edgeType}|${e.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Apply commands to `candidate`; return the resulting graph and the persistence delta. */
export function applyCommands(candidate: Graph, commands: MutateCommand[]): { graph: Graph; delta: GraphDelta } {
  let graph = candidate;
  const delta: GraphDelta = { upsertNodes: [], deleteNodes: [], upsertEdges: [], deleteEdges: [] };
  for (const cmd of commands) {
    switch (cmd.op) {
      case 'add-node':
      case 'update-node': {
        const existingIdx = graph.nodes.findIndex((n) => n.uid === cmd.node.uid);
        const base = existingIdx >= 0 ? graph.nodes[existingIdx] : undefined;
        const node: GraphNode = {
          uid: cmd.node.uid,
          type: cmd.node.type ?? base?.type ?? 'REQ',
          name: cmd.node.name ?? base?.name ?? cmd.node.uid,
          description: cmd.node.description ?? base?.description ?? '',
          attributes: { ...(base?.attributes ?? {}), ...(cmd.node.attributes ?? {}) },
        };
        if (existingIdx >= 0) graph.nodes[existingIdx] = node;
        else graph.nodes.push(node);
        delta.upsertNodes.push(node);
        break;
      }
      case 'delete-node': {
        graph.nodes = graph.nodes.filter((n) => n.uid !== cmd.uid);
        // Drop edges incident to the removed node.
        const orphaned = graph.edges.filter((e) => e.sourceId === cmd.uid || e.targetId === cmd.uid);
        graph.edges = graph.edges.filter((e) => e.sourceId !== cmd.uid && e.targetId !== cmd.uid);
        delta.deleteNodes.push(cmd.uid);
        for (const e of orphaned) {
          delta.deleteEdges.push({ sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType });
        }
        break;
      }
      case 'add-edge': {
        const edge: GraphEdge = {
          sourceId: cmd.edge.sourceId,
          targetId: cmd.edge.targetId,
          edgeType: cmd.edge.edgeType,
          attributes: cmd.edge.attributes ?? {},
        };
        const exists = graph.edges.some(
          (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.edgeType === edge.edgeType,
        );
        if (!exists) graph.edges.push(edge);
        delta.upsertEdges.push(edge);
        break;
      }
      case 'delete-edge': {
        const key = cmd.edge;
        graph.edges = graph.edges.filter(
          (e) => !(e.sourceId === key.sourceId && e.targetId === key.targetId && e.edgeType === key.edgeType),
        );
        delta.deleteEdges.push(key);
        break;
      }
      // CR-GC-238: type-change / flip / attribute-patch as ONE semantic op —
      // the audit entry stays `update-edge`, distinguishable from delete+add.
      // Rewiring semantics live once in graph-api-core (CR-198); this function
      // only turns the result into a persistence delta.
      case 'update-edge': {
        const key = cmd.edge;
        let result: ReturnType<typeof updateEdge>;
        try {
          result = updateEdge(graph, key, cmd.set);
        } catch {
          break; // unknown edge → no-op (mutations: 0), same as delete-edge
        }
        graph = result.graph;
        // Attribute-only patch keeps the edge identity — a delete of the old key
        // would remove the just-upserted edge from the store (persist runs upserts
        // before deletes), so only push the delete when the identity changed.
        const { removed, added } = result;
        const identityChanged =
          added.sourceId !== removed.sourceId || added.targetId !== removed.targetId || added.edgeType !== removed.edgeType;
        if (identityChanged) delta.deleteEdges.push({ sourceId: removed.sourceId, targetId: removed.targetId, edgeType: removed.edgeType });
        delta.upsertEdges.push(added);
        break;
      }
      // CR-GC-238: target absorbs source — incident edges rewired, source deleted.
      // An illegal result (R-18 pair, R-08 missing target) blocks via delta rules.
      case 'merge-nodes': {
        const { sourceUid, targetUid } = cmd;
        let result: ReturnType<typeof mergeNodes>;
        try {
          result = mergeNodes(graph, sourceUid, targetUid);
        } catch {
          break; // same uid or unknown source → no-op
        }
        // graph-api-core's mergeNodes dedupes a rewired edge only against what it has
        // ALREADY collected, so ordering decides: if the source's edge precedes the
        // target's identical one, the pre-existing edge is appended unchecked and the
        // graph carries the same (source, type, target) twice. Kuzu keys on that triple
        // and silently keeps one — the in-memory graph then claims an edge the store
        // does not have (CR-GC-384; upstream fix belongs in graph-api-core).
        graph = { nodes: result.graph.nodes, edges: dedupeEdges(result.graph.edges) };
        for (const e of result.removedEdges) {
          delta.deleteEdges.push({ sourceId: e.sourceId, targetId: e.targetId, edgeType: e.edgeType });
        }
        delta.upsertEdges.push(...dedupeEdges(result.addedEdges));
        delta.deleteNodes.push(result.removedNode);
        break;
      }
    }
  }
  return { graph, delta };
}
