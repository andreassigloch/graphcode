/**
 * focus-set.ts — die Fokusmenge: welche Funde die Steuerung ueberhaupt zeigt (CR-GC-593/594/598).
 *
 * Bis CR-GC-598 stand die Filterung in `generate.ts`, und `blockingErrors` kam ungefiltert aus dem
 * 74-Regel-Steuerungsstrom. Folge im Rewind-Lauf opus5-12: die Probe meldete "blockingErrors 0 → 8"
 * fuer S/O/D-Attribute — das waren FM-03-Fehler, die am Gate nicht blocken (`gating: false`) und
 * abnehmbar sind. Der Agent liess FM-01 deshalb offen. Zwei Definitionen derselben Frage.
 *
 * Jetzt eine, im Kernel, damit Schritt (generate), Probe (steeringDelta) und Bericht sie teilen:
 *   1. nur Regeln, die das GATE auswertet (SE_DESCRIPTOR.rules);
 *   2. keine info-Regeln;
 *   3. Praesenz von Code (R-19/20/26/27/32) nur, wenn ueberhaupt etwas gebunden ist;
 *   4. keine abgenommenen Funde der abnehmbaren Klasse (acceptedFindings, CR-SM-349/CR-GC-594);
 *   5. seit CR-GC-600 aus der Eigentuemer-Spalte (contracts `taskOf`, CR-SM-350) statt aus vier
 *      Sonderlisten: der Kern sieht Kern-Regeln und die Eintrittspunkte der Tasks; ein Task sieht sein
 *      detailliertes Regelset (FMEA: FM-01..03, Bauplan: MS- und CR-R-Regeln, Realisierung: Praesenzregeln).
 * Dazu ND-01/02: das Gate wertet Beinahe-Duplikate nie aus, CR-GC-287 hat sie aber ausdruecklich in den
 * Fokus gelegt (der Snapshot injiziert die Aehnlichkeit) — CR-GC-593 hatte das still zurueckgedreht.
 * `blockingErrors` = Fehler-Funde der Fokusmenge (ohne abgenommene). NICHT "blockt am Gate": das tun nur
 * R-01/R-08/IO-02/R-18/R-29, und deren Funde koennen im gespeicherten Graphen gar nicht stehen.
 *
 * @author andreas@siglochconsulting
 */
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  acceptedRuleIds,
  taskOf,
  TASK_ENTRY,
  type OntologyGraph,
  type RuleViolation,
  type RuleTask,
} from '@sigloch/contracts/se';

/**
 * Was je Task abnehmbar ist (CR-GC-594/600) — nur, was IN DIESEM TASK im Modell nicht erfuellbar ist.
 * Im Kern sind das die Eintrittspunkte der Tasks ("dieses Artefakt ist im schlanken Umfang nicht
 * noetig"); innerhalb eines Tasks die Regeln, die Code, einen Testlauf oder eine Entscheidung des
 * Auftraggebers brauchen. Architekturregeln stehen nirgends darin — heute darf sie niemand abnehmen.
 */
export const ABNEHMBAR_JE_TASK: Readonly<Record<RuleTask, readonly string[]>> = {
  kern: Object.values(TASK_ENTRY).filter((e): e is string => e !== null),
  conops: ['CL-01'],
  trade: [],
  irr: [],
  fmea: ['FM-03'],
  plan: ['MS-01', 'CR-R01'],
  anforderungsqualitaet: [],
  realisierung: ['R-19', 'R-20', 'R-26', 'R-32'],
};

/** Die abnehmbaren Regeln eines Tasks als Menge. */
export function abnehmbar(task: RuleTask = 'kern'): ReadonlySet<string> {
  return new Set(ABNEHMBAR_JE_TASK[task]);
}

const GATE_RULES = new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
/** CR-GC-287: vom Gate nie ausgewertet, von der Steuerung bewusst im Kern gezeigt. */
const STEERING_ONLY_KERN: ReadonlySet<string> = new Set(['ND-01', 'ND-02']);

/**
 * Die Fokusmenge eines Graphen fuer einen Task (CR-GC-600/601). Kern: Kern-Regeln des Gate-Katalogs
 * (dazu ND) — Task-Regeln sieht er nicht, nur deren Eintrittspunkte (AF-*, selbst Kern-Regeln).
 * Task: genau die Regeln des Tasks, als WARNUNG (Entscheidung 2026-09-22: detailliert, nicht
 * blockierend). In beiden Faellen ohne info und ohne abgenommene Funde.
 */
export function focusViolations(og: OntologyGraph, violations: readonly RuleViolation[], task: RuleTask = 'kern'): RuleViolation[] {
  const byId = new Map(og.elements.map((e) => [e.id, e]));
  const sys = og.elements.find((e) => e.type === 'SYS');
  const ab = abnehmbar(task);
  const imTask = (id: string): boolean =>
    task === 'kern' ? taskOf(id) === 'kern' && (GATE_RULES.has(id) || STEERING_ONLY_KERN.has(id)) : taskOf(id) === task;
  return violations
    .filter((v) => {
      if (v.severity === 'info' || !imTask(v.rule_id)) return false;
      const traeger = byId.get(v.element_id) ?? sys;
      return !(traeger && ab.has(v.rule_id) && acceptedRuleIds(traeger).has(v.rule_id));
    })
    .map((v) => (task !== 'kern' && v.severity === 'error' ? { ...v, severity: 'warning' as const } : v));
}

/** Fehler-Funde der Fokusmenge — abgenommene zaehlen nicht (Rewind opus5-12: 0 → 8 durch FM-03). */
export function blockingOf(focus: readonly RuleViolation[]): number {
  return focus.filter((v) => v.severity === 'error').length;
}
