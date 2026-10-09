/**
 * task-artifact.ts — die Analysen, die ein Artefakt im Graphen hinterlassen.
 *
 * Bis CR-GC-777 stand hier auch, woran der eingebettete Executor erkannte, dass eine Analyse
 * stattgefunden hat (Einheiten des Artefakts, Abschluss, Stempel-Schluessel; CR-GC-724, CR-GC-752,
 * CR-GC-755). Mit dem Executor (CR-GC-775) ist der Leser weg; den Stempel am SYS setzen die Skills.
 *
 * @author andreas@siglochconsulting
 */

/** Die Analysen — jede hinterlässt ein Artefakt im Graphen. */
export const ANALYSE_TASKS = ['conops', 'trade', 'irr', 'fmea', 'plan'] as const;
