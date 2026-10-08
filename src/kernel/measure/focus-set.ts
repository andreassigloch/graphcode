/**
 * focus-set.ts — die Fokusmenge: welche Funde die Steuerung ueberhaupt zeigt (CR-GC-593/594/598).
 *
 * Bis CR-GC-598 stand die Filterung in `generate.ts`, und `blockingErrors` kam ungefiltert aus dem
 * 74-Regel-Steuerungsstrom. Folge im Rewind-Lauf opus5-12: die Probe meldete "blockingErrors 0 → 8"
 * fuer S/O/D-Attribute — das waren FM-03-Fehler, die am Gate nicht blockten (damals `gating: false`) und
 * abnehmbar sind. Der Agent liess FM-01 deshalb offen. Zwei Definitionen derselben Frage.
 *
 * Jetzt eine, im Kernel, damit Schritt (generate), Probe (steeringDelta) und Bericht sie teilen:
 *   1. nur Regeln, die das GATE auswertet (SE_DESCRIPTOR.rules);
 *   2. keine info-Regeln;
 *   3. keine abgenommenen Funde der abnehmbaren Klasse (acceptedFindings, CR-SM-349/CR-GC-594);
 *   4. aus der Eigentuemer-Spalte (contracts `taskOf`): der Kern sieht alles, was kein Arbeitsschritt
 *      ihm abnimmt; ein Arbeitsschritt sieht seine Regeln und seinen Eintrittspunkt.
 * Dazu ND-01/02: das Gate wertet Beinahe-Duplikate nie aus, CR-GC-287 hat sie aber ausdruecklich in den
 * Fokus gelegt (der Snapshot injiziert die Aehnlichkeit) — CR-GC-593 hatte das still zurueckgedreht.
 * `blockingErrors` = Fehler-Funde der Fokusmenge (ohne abgenommene). NICHT "blockt am Gate": das tun nur
 * R-01/R-08/IO-02/R-18/R-29, und deren Funde koennen im gespeicherten Graphen gar nicht stehen.
 *
 * CR-GC-748 (contracts 11, CR-SM-395) — was hier NICHT mehr steht:
 *   - „Praesenz von Code nur, wenn etwas gebunden ist": das ist die FAELLIGKEIT (`isDue`), und sie
 *     haengt am Katalog. Eine Regel der Stufen 11 und 12 meldet nicht, bevor der Bau eroeffnet ist (ein
 *     offener Auftrag oder eine Bindung); die Fokusmenge bekommt nur faellige Befunde zu sehen und
 *     fragt den Zustand kein zweites Mal ab.
 *   - die Regelsets der Analysen und der Arbeitsschritt `realisierung`: FM-, MS-, CR-R- und
 *     Bindungsregeln gehoeren seit der gekuerzten Zuordnung dem Kern. Sie schweigen, solange es ihre
 *     Elemente nicht gibt; danach ordnet sie die Stufe (generate.ts).
 *   - „abnehmbar je Task": eine Menge, s. `ABNEHMBAR`.
 *
 * @author andreas@siglochconsulting
 */
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  acceptedRuleIds,
  ALL_RULE_DEFS,
  taskOf,
  TASK_ENTRY,
  type OntologyGraph,
  type RuleViolation,
  type RuleTask,
} from '@sigloch/contracts/se';

/** Verlangt die Regel ein Analyse-Artefakt? Die Rolle steht an der Regeldefinition (CR-SM-395). */
export const istAnalyse = (ruleId: string): boolean => ANALYSEN.has(ruleId);
const ANALYSEN: ReadonlySet<string> = new Set(ALL_RULE_DEFS.filter((r) => r.role === 'analysis').map((r) => r.id));

/**
 * Abnehmbar ueber die Analysen hinaus — einzeln begruendet (CR-GC-748). Massstab wie in CR-GC-594:
 * nur, was IM MODELL nicht erfuellbar ist. Geprueft und NICHT mehr abnehmbar:
 *   - R-19, R-20, R-26 (Bindung): sie standen hier, weil sie im Entwurf feuerten. Sie sind erst
 *     faellig, wenn der Bau eroeffnet ist — dann sind ihre Befunde die Arbeitsliste, nichts zum Abnehmen.
 *   - R-32 (Vertragstest je Schema): gilt seit CR-SM-396 fuer jedes Schema, auch im Entwurf — ein TEST
 *     mit verify auf das Schema schliesst den Befund im Modell.
 *   - MS-01 (Meilenstein ohne Auftrag), CR-R01 (Auftrag ohne Umfang): beide schliesst ein Zug im
 *     Modell — Auftrag zuordnen, Umfang verbinden, oder das Element loeschen.
 */
export const ABNEHMBAR_BEGRUENDET: Readonly<Record<string, string>> = {
  'CL-01': 'Ein Akteur, der das System in nur einer Betriebsart nutzt, ist ein gueltiger Befund des Einsatzkonzepts — ob eine zweite fehlt, entscheidet der Auftraggeber.',
  'FM-03': 'Verlangt einen BESTANDENEN Testlauf (`result: passed`); den gibt es erst mit Code, die Regel ist aber faellig, sobald es ein hohes Risiko gibt.',
};

/**
 * Was mit Begruendung abgenommen werden darf (CR-GC-594, neu gefasst CR-GC-748): die Regeln mit Rolle
 * `analysis`, die Eintrittsregeln der Analysen (`TASK_ENTRY` — der Bauplan AF-05 traegt die Rolle
 * `existence`, ist aber als Analyse abnehmbar: „Bau nicht beauftragt") und die begruendeten Ausnahmen.
 * Architekturregeln stehen nicht darin — heute darf sie niemand abnehmen. Eine Menge fuer Kern und
 * Arbeitsschritt: die Regeln der Analysen stehen jetzt im Kern, dort werden sie abgenommen.
 */
export const ABNEHMBAR: ReadonlySet<string> = new Set([
  ...ANALYSEN,
  ...Object.values(TASK_ENTRY).filter((e): e is string => e !== null),
  ...Object.keys(ABNEHMBAR_BEGRUENDET),
]);

const GATE_RULES = new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
/** CR-GC-287: vom Gate nie ausgewertet, von der Steuerung bewusst im Kern gezeigt. */
const STEERING_ONLY_KERN: ReadonlySet<string> = new Set(['ND-01', 'ND-02']);

/**
 * Zaehlt die Regel? Der Gate-Katalog und ND — dieselbe Menge, aus der Marken, Bericht und Viewer zaehlen
 * (CR-GC-766). Die Textregeln der Anforderungsqualitaet (BQ) stehen nicht darin: sie melden nur in ihrem
 * eigenen Arbeitsschritt.
 */
export const zaehlt = (ruleId: string): boolean => GATE_RULES.has(ruleId) || STEERING_ONLY_KERN.has(ruleId);

/**
 * Die Fokusmenge eines Graphen fuer einen Arbeitsschritt (CR-GC-600/601). Kern: die Regeln des
 * Gate-Katalogs (dazu ND), die kein Arbeitsschritt ihm abnimmt. Arbeitsschritt: seine Regeln (heute nur
 * die Textqualitaet der Anforderungen) und sein Eintrittspunkt (CR-GC-603) — eine Analyse ist erst
 * durch, wenn ihre Eintrittsregel schweigt oder abgenommen ist. In beiden Faellen ohne info und ohne
 * abgenommene Funde.
 */
export function focusViolations(og: OntologyGraph, violations: readonly RuleViolation[], task: RuleTask = 'kern'): RuleViolation[] {
  const byId = new Map(og.elements.map((e) => [e.id, e]));
  const sys = og.elements.find((e) => e.type === 'SYS');
  const eintritt = task === 'kern' ? null : TASK_ENTRY[task];
  const imTask = (id: string): boolean =>
    task === 'kern'
      ? taskOf(id) === 'kern' && zaehlt(id)
      : taskOf(id) === task || id === eintritt;
  return violations
    .filter((v) => {
      if (v.severity === 'info' || !imTask(v.rule_id)) return false;
      const traeger = byId.get(v.element_id) ?? sys;
      return !(traeger && ABNEHMBAR.has(v.rule_id) && acceptedRuleIds(traeger).has(v.rule_id));
    });
  // CR-SM-353 / CR-GC-605: kein error → warning-Mapping mehr. Seit `error` die Gate-Wirkung IST,
  // wird die Schwere durchgereicht, nicht umgeschrieben.
}

/** Fehler-Funde der Fokusmenge — abgenommene zaehlen nicht (Rewind opus5-12: 0 → 8 durch FM-03). */
export function blockingOf(focus: readonly RuleViolation[]): number {
  return focus.filter((v) => v.severity === 'error').length;
}
