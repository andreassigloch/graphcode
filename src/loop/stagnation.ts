/**
 * stagnation.ts — die Abbruchregel der Maschine (CR-GC-596).
 *
 * `generationStep` ist rein: es rechnet nur aus dem Graphen. Nach einem erfolglosen Zug sieht der
 * Graph im Fokusfenster aus wie davor — also kommt derselbe Fokus wieder. Gemessen in Lauf 11:
 * R-04 stand sechsmal hintereinander im Fokus, der Steuerterm bewegte sich keinen Hundertstel,
 * sieben Zuege waren verbrannt. Der Executor hatte dafuer eine eigene Zaehlung (CR-GC-281); ein
 * MCP-Host hatte nichts — `defer` haette er selbst fuehren muessen, und das tut kein Agent.
 *
 * Die Regel: kommt nach einer angewandten Mutation (Graph-Version gestiegen) DERSELBE Fokus wie
 * zuvor, hat der Zug ihn nicht geloest — beim dritten gleichen Feedback (CR-GC-606) stellt die Maschine das
 * Fund-Set zurueck und liefert den naechsten Kandidaten derselben Rangfolge. Bleiben nur
 * zurueckgestellte Funde, endet sie `stalled` (generate.ts), nie `done`.
 *
 * Das Gedaechtnis gehoert der SITZUNG (Harness-Instanz, Prozesslebensdauer), nicht dem Graphen:
 * es ist Laufzustand, kein Modellinhalt. Gleicher Graph, gleiche Version, gleicher Aufruf —
 * gleiche Antwort: wer graph_generate zweimal ohne Zug ruft, bekommt keinen Abbruch.
 *
 * Nur fuer `selection: 'host'`. Der Executor behaelt vorerst seine gemessene Zaehlung (Hinweis bei
 * der ersten Wiederholung, Zurueckstellen bei der dritten) — ITEM-2026-449 fuehrt beides zusammen.
 *
 * @author andreas@siglochconsulting
 */
import type { GenerationStep } from './generate.js';
import { TASK_ENTRY, type RuleTask } from '@sigloch/contracts/se';
import { STEER_RULES } from '@sigloch/se-engine';

/**
 * CR-GC-604: Eintrittspunkte (AF-01..05) sind von der Regel ausgenommen. Ein Zug im Kern kann sie gar
 * nicht loesen — das tut nur der Task (oder eine Abnahme). opus5-14: AF-03 stand im Fokus, der Agent
 * arbeitete anderes ab, beim zweiten Mal wurde AF-03 zurueckgestellt — und am Ende hiess es
 * `stalled`, "uebergib an den Menschen", obwohl nur der IRR-Task fehlte.
 */
const EINTRITTE: ReadonlySet<string> = new Set(Object.values(TASK_ENTRY).filter((e): e is string => e !== null));
const regelDes = (focusKey: string): string => focusKey.split(':')[1] ?? '';
/** Wie oft derselbe Fokus nach einem Zug wiederkommen darf, bevor er zurueckgestellt wird (CR-GC-606). */
export const WIEDERHOLUNGEN_BIS_ZURUECK = 2;

/**
 * CR-GC-608 — das Fertig-Kriterium der Steuerregeln (RD-04, BW-02, R-04, CR-01, MT-02): ein lokales
 * Optimum ist ein ERGEBNIS, kein Festfahren. Abbruchkriterium der lokalen Suche (Tabu-Gedaechtnis):
 *   Kreis   — der Termvektor nimmt einen Zustand der letzten k Steuerzuege wieder an (A → B → A:
 *             der Ueberschuss wandert nur; opus5-15: der R-04-Tausch erzeugte den CR-01-Ueberschuss);
 *   Plateau — der Steuerwert (Summe der Ueberschuesse) sinkt ueber k Steuerzuege um weniger als ε
 *             (opus5-11: R-04 sechsmal, keine Bewegung).
 * "Kein anwendbarer Zug" (opus5-13) steckt im Plateau: ohne anwendbaren Zug sinkt der Wert nicht —
 * ein eigener Check kostete nach JEDEM Zug einen Dry-Run je graph_suggest-Kandidat.
 * Gezaehlt werden nur Zuege, die bei einem Steuerregel-Fokus fielen — REQ-Arbeit, die R-04 nicht
 * beruehrt, ist kein Plateau. Steuerregeln sind deshalb auch von der Abbruchregel ausgenommen.
 */
export const STEUER_FENSTER = 3;
export const STEUER_EPS = 0.05;
const STEUERREGELN: ReadonlySet<string> = new Set(STEER_RULES);

/** Der Steuerzustand eines Graphen: kanonischer Termvektor, Steuerwert, lesbare Terme. */
export interface SteerState { key: string; sum: number; terms: string[] }
export interface SteerOptimum { grund: 'kreis' | 'plateau'; sum: number; terms: string[] }

/** Rein: ist der letzte Zustand des Verlaufs ein lokales Optimum? */
export function lokalesOptimum(
  verlauf: readonly SteerState[],
  k: number = STEUER_FENSTER,
  eps: number = STEUER_EPS,
): SteerOptimum['grund'] | null {
  const n = verlauf.length;
  const jetzt = verlauf[n - 1];
  if (!jetzt || jetzt.terms.length === 0) return null;
  for (let i = Math.max(0, n - 1 - k); i < n - 2; i++) {
    if (verlauf[i].key === jetzt.key && verlauf[n - 2].key !== jetzt.key) return 'kreis';
  }
  if (n - 1 >= k) {
    const vorher = verlauf[n - 1 - k];
    if (vorher.sum - jetzt.sum < eps * vorher.sum) return 'plateau';
  }
  return null;
}

export interface FocusMemory {
  /** CR-GC-601: der Task, in dem die Sitzung gerade arbeitet — `next` bleibt darin, bis graph_generate ohne task. */
  task: RuleTask;
  /** Der zuletzt ausgelieferte Fokus, die Graph-Version dazu und wie oft er nach einem Zug wiederkam. */
  last: { key: string; version: number; repeats: number } | null;
  /** Fund-Sets, die nach zwei Zuegen noch standen (CR-GC-606) — fuer diese Sitzung zurueckgestellt. */
  readonly deferred: Set<string>;
  /** CR-GC-608: Steuerzustaende rund um Steuerzuege, je mit Graph-Version. */
  steerVerlauf: (SteerState & { version: number })[];
  /** CR-GC-608: erreichtes lokales Optimum — die Steuerregeln verlassen den Fokus. */
  steerOptimum: SteerOptimum | null;
}

const memories = new WeakMap<object, FocusMemory>();

/** Das Gedaechtnis einer Sitzung — je Harness-Instanz genau eins. */
export function focusMemoryOf(owner: object): FocusMemory {
  let m = memories.get(owner);
  if (!m) {
    m = { task: 'kern', last: null, deferred: new Set(), steerVerlauf: [], steerOptimum: null };
    memories.set(owner, m);
  }
  return m;
}

/**
 * Einen Schritt mit Abbruchregel und Fertig-Kriterium rechnen. `compute(defer, optimum)` ist
 * `generationStep` mit allen uebrigen Argumenten gebunden; `extraDefer` sind die vom Aufrufer
 * ausdruecklich gesetzten.
 */
export function stepWithMemory(
  memory: FocusMemory,
  version: number,
  compute: (defer: string[], optimum: SteerOptimum | null) => GenerationStep,
  extraDefer: readonly string[] = [],
): GenerationStep {
  // CR-GC-598: ein ausdrueckliches defer des Hosts gilt fuer die Sitzung — sonst bot `next` beim
  // naechsten Zug das eben zurueckgestellte Fenster wieder an (Rewind opus5-12, Zug 23).
  for (const k of extraDefer) memory.deferred.add(k);
  const alle = () => [...memory.deferred];
  let step = compute(alle(), memory.steerOptimum);
  steuerVerlaufFuehren(memory, version, step);
  if (!memory.steerOptimum) {
    const letzter = memory.steerVerlauf[memory.steerVerlauf.length - 1];
    const grund = lokalesOptimum(memory.steerVerlauf);
    if (grund && letzter) {
      memory.steerOptimum = { grund, sum: letzter.sum, terms: letzter.terms };
      step = compute(alle(), memory.steerOptimum);
    }
  }
  // CR-GC-606: zurueckgestellt wird beim DRITTEN gleichen Feedback (zwei Zuege nach der Auslieferung).
  // opus5-15: der Zug nach der ersten Auslieferung war ein Nachtrag zum vorigen (Modulbeschreibungen),
  // kein Versuch — beim zweiten Mal zurueckgestellt, sah der Agent CR-01 nie; Ende `stalled` statt `done`.
  const gleich = !!step.focusKey && memory.last?.key === step.focusKey;
  if (gleich && version <= memory.last!.version) return step; // kein Zug dazwischen: nichts zaehlen
  const repeats = gleich ? memory.last!.repeats + 1 : 0;
  const ausgenommen = EINTRITTE.has(regelDes(step.focusKey ?? '')) || STEUERREGELN.has(regelDes(step.focusKey ?? ''));
  if (repeats >= WIEDERHOLUNGEN_BIS_ZURUECK && !ausgenommen) {
    memory.deferred.add(step.focusKey!);
    step = compute(alle(), memory.steerOptimum);
    memory.last = step.focusKey ? { key: step.focusKey, version, repeats: 0 } : null;
    return step;
  }
  memory.last = step.focusKey ? { key: step.focusKey, version, repeats } : null;
  return step;
}

/** CR-GC-608: Zustand festhalten, wenn ein Steuerfokus ausgeliefert wird oder ein Steuerzug fiel. */
function steuerVerlaufFuehren(memory: FocusMemory, version: number, step: GenerationStep): void {
  const zustand = step.steer;
  if (!zustand) return;
  // ein neues Steuerproblem (Wert ueber dem Optimum) oeffnet die Steuerregeln wieder
  if (memory.steerOptimum && zustand.sum > memory.steerOptimum.sum * (1 + STEUER_EPS) + 1e-9) {
    memory.steerOptimum = null;
    memory.steerVerlauf = [];
  }
  if (zustand.terms.length === 0) {
    memory.steerVerlauf = [];
    return;
  }
  const liefertSteuer = STEUERREGELN.has(regelDes(step.focusKey ?? ''));
  const warSteuerzug = !!memory.last && STEUERREGELN.has(regelDes(memory.last.key)) && version > memory.last.version;
  const zuletzt = memory.steerVerlauf[memory.steerVerlauf.length - 1];
  if ((liefertSteuer || warSteuerzug) && (!zuletzt || version > zuletzt.version)) {
    memory.steerVerlauf.push({ ...zustand, version });
    if (memory.steerVerlauf.length > STEUER_FENSTER + 1) memory.steerVerlauf.shift();
  }
}
