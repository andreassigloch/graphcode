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
 *   4. keine abgenommenen Funde der abnehmbaren Klasse (acceptedFindings, CR-SM-349/CR-GC-594).
 * Dazu ND-01/02: das Gate wertet Beinahe-Duplikate nie aus, CR-GC-287 hat sie aber ausdruecklich in den
 * Fokus gelegt (der Snapshot injiziert die Aehnlichkeit) — CR-GC-593 hatte das still zurueckgedreht.
 * `blockingErrors` = Fehler-Funde der Fokusmenge (ohne abgenommene). NICHT "blockt am Gate": das tun nur
 * R-01/R-08/IO-02/R-18/R-29, und deren Funde koennen im gespeicherten Graphen gar nicht stehen.
 *
 * @author andreas@siglochconsulting
 */
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { acceptedRuleIds, type OntologyGraph, type RuleViolation } from '@sigloch/contracts/se';

/**
 * Welche Funde abnehmbar sind (Entscheidung 2026-09-22, CR-GC-594) — genau die, deren Aufloesung im
 * Modell NICHT moeglich ist: Testlauf (FM-03), Code und Bindung (R-19/R-20/R-26/R-32, CR-R01), im
 * schlanken Scope optionale Artefakte (AF-01..05), Auftraggeber-Entscheidung (MS-01, CL-01).
 * Architekturregeln stehen NICHT darin — heute darf sie niemand abnehmen.
 */
export const ABNEHMBARE_REGELN: ReadonlySet<string> = new Set([
  'FM-03', 'AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05', 'MS-01', 'CL-01',
  'R-19', 'R-20', 'R-26', 'R-32', 'CR-R01',
]);

/** Praesenzregeln fuer Code — ohne eine einzige Bindung kein Fund, sondern der Zustand. */
export const FOCUS_EXCLUDED_WHEN_UNBOUND: ReadonlySet<string> = new Set(['R-19', 'R-20', 'R-26', 'R-27', 'R-32']);

const GATE_RULES = new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
/** CR-GC-287: vom Gate nie ausgewertet, von der Steuerung bewusst gezeigt. */
const STEERING_ONLY_FOCUS: ReadonlySet<string> = new Set(['ND-01', 'ND-02']);

/** Die Fokusmenge eines Graphen — Teilmenge des Steuerungsstroms, s. Kopf. */
export function focusViolations(og: OntologyGraph, violations: readonly RuleViolation[]): RuleViolation[] {
  const gebunden = og.elements.some((e) => e.type === 'FUNC' && e.attributes?.realRef !== undefined);
  const byId = new Map(og.elements.map((e) => [e.id, e]));
  const sys = og.elements.find((e) => e.type === 'SYS');
  return violations.filter((v) => {
    if ((!GATE_RULES.has(v.rule_id) && !STEERING_ONLY_FOCUS.has(v.rule_id)) || v.severity === 'info') return false;
    if (!gebunden && FOCUS_EXCLUDED_WHEN_UNBOUND.has(v.rule_id)) return false;
    const traeger = byId.get(v.element_id) ?? sys;
    return !(traeger && ABNEHMBARE_REGELN.has(v.rule_id) && acceptedRuleIds(traeger).has(v.rule_id));
  });
}

/** Fehler-Funde der Fokusmenge — abgenommene zaehlen nicht mehr (Rewind opus5-12: 0 → 8 durch FM-03). */
export function blockingOf(focus: readonly RuleViolation[]): number {
  return focus.filter((v) => v.severity === 'error').length;
}
