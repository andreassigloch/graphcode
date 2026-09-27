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
import { formatEToCommands } from '../../src/loop/format-e-commands.js';
import { commandsToFormatE } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';

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

/**
 * Ein programmatisch gebauter Batch als der Text, den `graph_mutate` annimmt (ITEM-2026-604).
 * Dieselbe Funktion, die die Maschinen-Konsumenten nutzen (`commandsToFormatE`, graph-api-core) —
 * kein eigener Serialisierer im Test. Den Typ geloeschter oder gepatchter Knoten ohne `type` liefert
 * `bestand` (ein Graph oder ein Harness).
 */
export function alsFormatE(commands: readonly unknown[], bestand?: Graph | { getGraph(): Graph }): string {
  const g = bestand === undefined ? LEER : 'getGraph' in bestand ? bestand.getGraph() : bestand;
  const typ = new Map(g.nodes.map((n) => [n.uid, n.type]));
  return commandsToFormatE(commands as MutateCommand[], (uid) => typ.get(uid));
}

/** `{commands, …rest}` → `{formatE, …rest}` — fuer Fixtures, die an anderer Stelle als Modellausgabe (JSON) dienen. */
export function alsEingabe<T extends { commands: readonly unknown[] }>(
  eingabe: T,
  bestand?: Graph | { getGraph(): Graph },
): Omit<T, 'commands'> & { formatE: string } {
  const { commands, ...rest } = eingabe;
  return { ...rest, formatE: alsFormatE(commands, bestand) };
}
