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

export interface FocusMemory {
  /** CR-GC-601: der Task, in dem die Sitzung gerade arbeitet — `next` bleibt darin, bis graph_generate ohne task. */
  task: RuleTask;
  /** Der zuletzt ausgelieferte Fokus, die Graph-Version dazu und wie oft er nach einem Zug wiederkam. */
  last: { key: string; version: number; repeats: number } | null;
  /** Fund-Sets, die nach zwei Zuegen noch standen (CR-GC-606) — fuer diese Sitzung zurueckgestellt. */
  readonly deferred: Set<string>;
}

const memories = new WeakMap<object, FocusMemory>();

/** Das Gedaechtnis einer Sitzung — je Harness-Instanz genau eins. */
export function focusMemoryOf(owner: object): FocusMemory {
  let m = memories.get(owner);
  if (!m) {
    m = { task: 'kern', last: null, deferred: new Set() };
    memories.set(owner, m);
  }
  return m;
}

/**
 * Einen Schritt mit Abbruchregel rechnen. `compute(defer)` ist `generationStep` mit allen
 * uebrigen Argumenten gebunden; `extraDefer` sind die vom Aufrufer ausdruecklich gesetzten.
 */
export function stepWithMemory(
  memory: FocusMemory,
  version: number,
  compute: (defer: string[]) => GenerationStep,
  extraDefer: readonly string[] = [],
): GenerationStep {
  // CR-GC-598: ein ausdrueckliches defer des Hosts gilt fuer die Sitzung — sonst bot `next` beim
  // naechsten Zug das eben zurueckgestellte Fenster wieder an (Rewind opus5-12, Zug 23).
  for (const k of extraDefer) memory.deferred.add(k);
  const alle = () => [...memory.deferred];
  let step = compute(alle());
  // CR-GC-606: zurueckgestellt wird beim DRITTEN gleichen Feedback (zwei Zuege nach der Auslieferung).
  // opus5-15: der Zug nach der ersten Auslieferung war ein Nachtrag zum vorigen (Modulbeschreibungen),
  // kein Versuch — beim zweiten Mal zurueckgestellt, sah der Agent CR-01 nie; Ende `stalled` statt `done`.
  const gleich = !!step.focusKey && memory.last?.key === step.focusKey;
  if (gleich && version <= memory.last!.version) return step; // kein Zug dazwischen: nichts zaehlen
  const repeats = gleich ? memory.last!.repeats + 1 : 0;
  if (repeats >= WIEDERHOLUNGEN_BIS_ZURUECK && !EINTRITTE.has(regelDes(step.focusKey!))) {
    memory.deferred.add(step.focusKey!);
    step = compute(alle());
    memory.last = step.focusKey ? { key: step.focusKey, version, repeats: 0 } : null;
    return step;
  }
  memory.last = step.focusKey ? { key: step.focusKey, version, repeats } : null;
  return step;
}
