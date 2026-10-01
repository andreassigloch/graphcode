/**
 * task-artifact.ts — woran der Executor erkennt, dass eine Analyse STATTGEFUNDEN hat (CR-GC-724).
 *
 * Bis hierher schloss ein Stempel am SYS den Task (`analysisFreshness.<id>`), und den Stempel setzte,
 * wer wollte. Gemessen im lokalen AgentDiary-Lauf local-1 (2026-09-30): fünf Stempel in einem Zug,
 * kein Artefakt, „Task fmea fertig“. Auf dem Executor-Weg setzt deshalb der CODE den Stempel — und
 * nur, wenn im Graphen steht, was die Analyse hinterlässt. Das Modell bekommt den Stempel nie zu
 * sehen (Datenschäden gehören in den Code, nicht in den Prompt).
 *
 * Eine „Einheit“ ist das kleinste vollständige Stück des Artefakts:
 *   fmea    — eine Risiko-REQ mit Gegenmaßnahme (compose) und einem Erfüller (satisfy)
 *   plan    — ein Meilenstein, dem mindestens ein CR zugeordnet ist
 *   trade   — ein CR mit einer `decides`-Kante
 *   conops  — eine nicht-funktionale REQ am System            (nur NEUE zählen, s. u.)
 *   irr     — ein CR je offener Annahme                       (nur NEUE zählen, s. u.)
 * Für conops und irr trägt der Graph kein Merkmal, das eine Betriebsanforderung oder eine Annahme
 * von gewöhnlicher Kern-Arbeit unterscheidet — dort zählt, was WÄHREND des Tasks entstand.
 *
 * Rein: liest eine neutrale Graph-Form, damit Rundenprompt (OntologyGraph) und Executor (Registry)
 * dieselbe Rechnung benutzen.
 *
 * @author andreas@siglochconsulting
 */
import { normalizeReqKinds } from '@sigloch/contracts/se';

/** Die Tasks, die ein Artefakt mit Stempel hinterlassen. */
export const ANALYSE_TASKS = ['conops', 'trade', 'irr', 'fmea', 'plan'] as const;
export type AnalyseTask = (typeof ANALYSE_TASKS)[number];

export const istAnalyseTask = (task: string | undefined): task is AnalyseTask =>
  (ANALYSE_TASKS as readonly string[]).includes(task ?? '');

/** Der Schlüssel des Stempels unter `SYS.attributes.analysisFreshness` — er weicht vom Task-Namen ab. */
export const STEMPEL_ID: Readonly<Record<AnalyseTask, string>> = {
  conops: 'conops',
  trade: 'trade',
  irr: 'assumption-review',
  fmea: 'fmea',
  plan: 'implplan',
};

/** Bei diesen Tasks zählt nur, was während des Tasks entstand. */
export const NUR_NEUE: ReadonlySet<AnalyseTask> = new Set(['conops', 'irr']);

/** Tasks, deren Stempel die entstandenen CRs nennt (TR-01, IR-01 lesen `crRefs`). */
const MIT_CR_REFS: ReadonlySet<AnalyseTask> = new Set(['trade', 'irr']);

export interface TaskKnoten {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}
export interface TaskKante {
  source: string;
  type: string;
  target: string;
  label?: string;
}
export interface TaskGraph {
  nodes: readonly TaskKnoten[];
  edges: readonly TaskKante[];
}

function sicht(g: TaskGraph): { typ: Map<string, string>; attr: Map<string, Record<string, unknown>> } {
  return {
    typ: new Map(g.nodes.map((n) => [n.id, n.type])),
    attr: new Map(g.nodes.map((n) => [n.id, n.attributes ?? {}])),
  };
}

/** Die vollständigen Einheiten des Artefakts, die der Graph trägt (uids, sortiert). */
export function artefakte(task: AnalyseTask, g: TaskGraph): string[] {
  const { typ, attr } = sicht(g);
  const rolle = (id: string): unknown => attr.get(id)?.role;
  const hat = (pred: (e: TaskKante) => boolean): boolean => g.edges.some(pred);
  const ids = g.nodes
    .filter((n): boolean => {
      switch (task) {
        case 'fmea':
          return (
            n.type === 'REQ' &&
            rolle(n.id) === 'risk' &&
            hat((e) => e.type === 'compose' && e.source === n.id && rolle(e.target) === 'mitigation') &&
            hat((e) => e.type === 'satisfy' && e.target === n.id)
          );
        case 'plan':
          return n.type === 'MS' && hat((e) => e.type === 'relation' && e.target === n.id && typ.get(e.source) === 'CR');
        case 'trade':
          return n.type === 'CR' && hat((e) => e.type === 'relation' && e.source === n.id && e.label === 'decides');
        case 'irr':
          return n.type === 'CR';
        case 'conops':
          return (
            n.type === 'REQ' &&
            normalizeReqKinds(n.attributes?.kinds).includes('non-functional') &&
            hat((e) => (e.type === 'compose' || e.type === 'satisfy') && e.target === n.id && typ.get(e.source) === 'SYS')
          );
      }
    })
    .map((n) => n.id);
  return ids.sort();
}

/**
 * Was das Artefakt noch nicht abdeckt — für den Rundenprompt und als Abschlussbedingung.
 *   fmea: Wirkketten ohne Risiko (weder die Kette noch eines ihrer Glieder erfüllt eine Risiko-REQ
 *         oder deren Gegenmaßnahme)
 *   plan: Blatt-REQs ohne Bauauftrag (kein CR zeigt auf die REQ oder auf ihren Erfüller)
 * Die übrigen Tasks haben keine aus dem Graphen ableitbare Restliste.
 */
export function offen(task: AnalyseTask, g: TaskGraph): string[] {
  const { typ, attr } = sicht(g);
  if (task === 'fmea') {
    const risiko = new Set(g.nodes.filter((n) => n.type === 'REQ' && attr.get(n.id)?.role === 'risk').map((n) => n.id));
    const massnahmeVon = new Map<string, string>();
    for (const e of g.edges) if (e.type === 'compose' && risiko.has(e.source)) massnahmeVon.set(e.target, e.source);
    const trifftRisiko = (quelle: string): boolean =>
      g.edges.some((e) => e.type === 'satisfy' && e.source === quelle && (risiko.has(e.target) || massnahmeVon.has(e.target)));
    return g.nodes
      .filter((n) => n.type === 'FCHAIN')
      .filter((c) => {
        const glieder = g.edges.filter((e) => e.type === 'compose' && e.source === c.id && typ.get(e.target) === 'FUNC').map((e) => e.target);
        return !trifftRisiko(c.id) && !glieder.some(trifftRisiko);
      })
      .map((c) => c.id)
      .sort();
  }
  if (task === 'plan') {
    const elternReq = new Set(g.edges.filter((e) => e.type === 'compose' && typ.get(e.source) === 'REQ' && typ.get(e.target) === 'REQ').map((e) => e.source));
    const crZiel = new Set(g.edges.filter((e) => e.type === 'relation' && typ.get(e.source) === 'CR').map((e) => e.target));
    return g.nodes
      .filter((n) => n.type === 'REQ' && !elternReq.has(n.id))
      .filter((r) => !crZiel.has(r.id) && !g.edges.some((e) => e.type === 'satisfy' && e.target === r.id && crZiel.has(e.source)))
      .map((r) => r.id)
      .sort();
  }
  return [];
}

export interface Abschluss {
  /** Der Task gilt als durchgeführt — der Stempel darf gesetzt werden. */
  fertig: boolean;
  /** Die Einheiten, die zählen (bei NUR_NEUE: ohne den Bestand vor dem Task). */
  einheiten: string[];
  offen: string[];
}

/**
 * Das Urteil nach einer Runde. Fertig ist der Task, wenn mindestens eine Einheit steht UND entweder
 * nichts mehr offen ist oder die letzte Runde keine neue Einheit brachte (das Modell hat nichts mehr
 * zu sagen). `vorherGezaehlt` ist die Einheitenzahl nach der Runde davor; `undefined` = es lief noch
 * keine Runde, dann zählt nur ein Artefakt, dem nichts fehlt.
 */
export function abschluss(
  task: AnalyseTask,
  g: TaskGraph,
  bestandVorTask: ReadonlySet<string>,
  vorherGezaehlt: number | undefined,
): Abschluss {
  const alle = artefakte(task, g);
  const einheiten = NUR_NEUE.has(task) ? alle.filter((id) => !bestandVorTask.has(id)) : alle;
  const rest = offen(task, g);
  const erschoepft = vorherGezaehlt !== undefined && einheiten.length === vorherGezaehlt;
  return { fertig: einheiten.length > 0 && (rest.length === 0 || erschoepft), einheiten, offen: rest };
}

/**
 * Der Zug, der den Stempel setzt: das ganze `analysisFreshness`-Objekt, weil ein Attribut-Patch den
 * Wert ersetzt und nicht in ihn hinein mischt — die übrigen Stempel reisen deshalb mit.
 */
export function stempelZug(
  task: AnalyseTask,
  sysUid: string,
  bisher: Record<string, unknown>,
  graphVersion: number,
  einheiten: readonly string[],
): string {
  const stempel = MIT_CR_REFS.has(task) ? { graphVersion, crRefs: [...einheiten] } : { graphVersion };
  const wert = { ...bisher, [STEMPEL_ID[task]]: stempel };
  return `## Nodes\n### SYS\n~ ${sysUid}\n@analysisFreshness ${JSON.stringify(wert)}\n`;
}
