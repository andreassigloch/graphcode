/**
 * work-order.ts — der Arbeitsauftrag aus dem Modell-Delta (CR-GC-490).
 *
 * Wandert eine `allocate`-Kante, war bis hierher NIEMAND zuständig zu sagen, welche Datei
 * mitwandern muss. Das Gate prüft den Graphen, der Build prüft den Code; die Brücke dazwischen
 * war der Mensch, der sich erinnert. Die vierte Kante Modell → Code fehlte ganz
 * (`sigloch-modules/docs/project/optimierungsring.md` §7).
 *
 * Die Ableitung ist klein und vollständig aus vorhandenen Daten möglich:
 *
 *     FUNC X -realRef-> Datei F   ∧   FUNC X -allocate-> MOD A   ⇒   F gehört zu A
 *
 * **Das Ergebnis ist eine LISTE, kein Refactoring.** Datei verschieben, Imports nachziehen,
 * Symbol umbenennen kann der Coding-Agent bereits; eine Operator-Bibliothek hier wäre ein
 * zweiter Pfad zu einer vorhandenen Fähigkeit und würde altern, während er besser wird.
 * graphcode liefert **Spezifikation und Verdict**, der Agent sind die Hände (§9.1).
 *
 * Was hier NICHT entsteht: die Drift-Meldung „Import steht quer". Die gibt es als **RC-05**, aus
 * `conformanceEvaluation` — sie hier nachzurechnen wäre eine zweite Definition derselben Frage.
 * Dieser Auftrag sagt genau das, was RC-05 nicht sagen kann: *welche Datei wegen des
 * Modell-Zugs wandern muss*, bevor irgendein Import quersteht.
 *
 * @author andreas@siglochconsulting
 */
import { RealRefSchema } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';

type CGraph = Pick<Graph, 'nodes' | 'edges'>;

/** Eine Datei, die dem Modell-Zug folgen muss. `null` heißt „keinem Modul zugeordnet". */
export interface FileMove {
  readonly file: string;
  readonly funcId: string;
  readonly fromMod: string | null;
  readonly toMod: string | null;
}

/** Eine FUNC, deren Zuordnung sich bewegt hat, ohne dass eine Datei ableitbar wäre. */
export interface BlindFunc {
  readonly funcId: string;
  readonly reason: string;
}

export interface WorkOrder {
  /** Was zu tun ist — je Zeile eine Datei, ein Von und ein Nach. */
  readonly moves: readonly FileMove[];
  /**
   * Was NICHT ableitbar war. Pflichtfeld, nicht Kür: eine leere `moves`-Liste bei 30 blinden
   * FUNCs wäre dieselbe Fail-open-Lüge wie das Sammel-Token aus CR-GC-489. Ohne Bindung gibt
   * es keinen Auftrag — und genau das muss dastehen.
   */
  readonly blind: readonly BlindFunc[];
}

/** FUNC-uid → MOD-uid über die direkte `allocate`-Kante (`0..1` je FUNC). */
function allocationOf(graph: CGraph): Map<string, string> {
  const typeOf = new Map(graph.nodes.map((n) => [n.uid, n.type]));
  const out = new Map<string, string>();
  for (const e of graph.edges) {
    if (e.edgeType !== 'allocate') continue;
    if (typeOf.get(e.sourceId) !== 'FUNC' || typeOf.get(e.targetId) !== 'MOD') continue;
    out.set(e.sourceId, e.targetId);
  }
  return out;
}

/** Die gebundene Datei einer FUNC — `undefined`, wenn sie keine trägt oder der Ref kaputt ist. */
function boundFile(graph: CGraph, funcId: string): string | undefined {
  const node = graph.nodes.find((n) => n.uid === funcId);
  const parsed = RealRefSchema.safeParse(node?.attributes?.realRef);
  return parsed.success ? parsed.data.file : undefined;
}

/**
 * Der Arbeitsauftrag zweier Graph-Stände. Rein — kein Dateisystem, kein Store.
 *
 * Ein Advisory, kein Gate: ein Zug mit zwölf offenen `moves` wird nicht blockiert. Ob Drift
 * einen CR aufhält, entscheidet der CR, nicht das Werkzeug.
 */
export function congruenceWorkOrder(before: CGraph, after: CGraph): WorkOrder {
  const was = allocationOf(before);
  const is = allocationOf(after);

  const moves: FileMove[] = [];
  const blind: BlindFunc[] = [];
  for (const funcId of [...new Set([...was.keys(), ...is.keys()])].sort()) {
    const fromMod = was.get(funcId) ?? null;
    const toMod = is.get(funcId) ?? null;
    if (fromMod === toMod) continue;
    // Der Nach-Stand ist die Wahrheit über die Bindung; fällt die FUNC ganz weg, trägt der
    // Vor-Stand sie noch — sonst verschwände ihre Datei stillschweigend aus dem Auftrag.
    const file = boundFile(after, funcId) ?? boundFile(before, funcId);
    if (file === undefined) {
      blind.push({ funcId, reason: 'kein realRef — die Datei ist nicht ableitbar' });
      continue;
    }
    moves.push({ file, funcId, fromMod, toMod });
  }
  return { moves, blind };
}
