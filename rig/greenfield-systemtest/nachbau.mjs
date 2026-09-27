/**
 * nachbau.mjs — den Graphzustand eines Laufs aus `audit.jsonl` nachbauen, Mutation für Mutation.
 * Gemeinsame Grundlage der Nachspiele (`faltung.mjs`, `verhalten.mjs`); ohne Abhängigkeit von `dist/`.
 * @author andreas@siglochconsulting
 */

/** Graph-Zustand als Maps; Kanten-Schluessel `quelle|typ|ziel`. */
export function leererGraph() {
  return { nodes: new Map(), edges: new Map() };
}

export const kante = (e) => `${e.sourceId}|${e.edgeType}|${e.targetId}`;

export function anwenden(g, c) {
  switch (c.op) {
    case 'add-node':
    case 'update-node': {
      const alt = g.nodes.get(c.node.uid) ?? {};
      g.nodes.set(c.node.uid, { ...alt, ...c.node, attributes: { ...(alt.attributes ?? {}), ...(c.node.attributes ?? {}) } });
      break;
    }
    case 'delete-node':
      g.nodes.delete(c.uid);
      for (const [k, e] of g.edges) if (e.sourceId === c.uid || e.targetId === c.uid) g.edges.delete(k);
      break;
    case 'add-edge':
      g.edges.set(kante(c.edge), c.edge);
      break;
    case 'delete-edge':
    case 'remove-edge':
      g.edges.delete(kante(c.edge));
      break;
    case 'merge-nodes':
      for (const [k, e] of [...g.edges]) {
        if (e.sourceId !== c.sourceUid && e.targetId !== c.sourceUid) continue;
        g.edges.delete(k);
        const n = { ...e, sourceId: e.sourceId === c.sourceUid ? c.targetUid : e.sourceId, targetId: e.targetId === c.sourceUid ? c.targetUid : e.targetId };
        g.edges.set(kante(n), n);
      }
      g.nodes.delete(c.sourceUid);
      break;
    default:
      break;
  }
}
