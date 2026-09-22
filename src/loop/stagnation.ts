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
 * zuvor, hat der Zug ihn nicht geloest — beim zweiten gleichen Feedback stellt die Maschine das
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

export interface FocusMemory {
  /** Der zuletzt ausgelieferte Fokus und die Graph-Version, bei der er ausgeliefert wurde. */
  last: { key: string; version: number } | null;
  /** Fund-Sets, die zweimal ohne Wirkung kamen — fuer diese Sitzung zurueckgestellt. */
  readonly deferred: Set<string>;
}

const memories = new WeakMap<object, FocusMemory>();

/** Das Gedaechtnis einer Sitzung — je Harness-Instanz genau eins. */
export function focusMemoryOf(owner: object): FocusMemory {
  let m = memories.get(owner);
  if (!m) {
    m = { last: null, deferred: new Set() };
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
  if (step.focusKey && memory.last && memory.last.key === step.focusKey && version > memory.last.version) {
    memory.deferred.add(step.focusKey);
    step = compute(alle());
  }
  memory.last = step.focusKey ? { key: step.focusKey, version } : null;
  return step;
}
