/**
 * helpers/format-e.ts — was ein Format-E-Text SAGT, fuer Zusicherungen in Tests.
 *
 * Dieser Helfer LIEST NICHT SELBST (CR-GC-632). Er ruft `formatEToCommands` — denselben und
 * einzigen Leser, den `graph_mutate` und `bootstrap` fahren — und filtert dessen Kommandos in
 * die Form, in der eine Zusicherung sie braucht. Die erste Fassung (CR-GC-631) parste selbst
 * und bildete die Operationen selbst ab; das waren zwei Leser desselben Textes, und der eine
 * davon waren die Tests. Eine auseinanderlaufende Auslegung haette dann niemand bemerkt.
 *
 * @author andreas@siglochconsulting
 */

import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { formatEToCommands } from '../../src/surface/format-e-commands.js';

/** Kein Bestand: der Text muss jeden Knoten selbst deklarieren (der Normalfall im Test). */
const LEER: Graph = { nodes: [], edges: [] };

/**
 * Die Knoten, die der Text ANLEGT — als das, was daraus im Speicher wuerde.
 * `bestand` typisiert uids, die der Text nicht deklariert (CR-GC-310).
 */
export function knotenAus(text: string, bestand: Graph = LEER): GraphNode[] {
  return formatEToCommands(bestand, text)
    .commands.filter((c) => c.op === 'add-node')
    .map((c) => (c as Extract<typeof c, { op: 'add-node' }>).node as GraphNode);
}

/** Die Kanten, die der Text ANLEGT — Fan-out bereits aufgefaltet (der Parser tut das). */
export function kantenAus(text: string, bestand: Graph = LEER): GraphEdge[] {
  return formatEToCommands(bestand, text)
    .commands.filter((c) => c.op === 'add-edge')
    .map((c) => (c as Extract<typeof c, { op: 'add-edge' }>).edge as GraphEdge);
}
