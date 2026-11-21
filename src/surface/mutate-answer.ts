/**
 * mutate-answer.ts — der Vertrag der Antwort von `graph_mutate` (SCHEMA-mutate-answer, CR-GC-985).
 *
 * Das ist nicht `MutateResult`: das ist der Vertrag von `harness.mutate` im Prozess (contracts). Die
 * Werkzeug-Antwort nimmt dessen Felder ohne `violations` und `graphVersion` und haengt an, was die
 * Werkzeugschicht dazu rechnet. Alle Bausteine kommen aus contracts oder aus dem Erzeuger der Berichte;
 * nachgebaut ist nichts. Der Erzeuger `graph_mutate` (write.ts) parst jede Antwort gegen dieses Schema.
 *
 * Varianten, die das Schema annehmen muss (jede hat einen Fall in tests/mutate-answer.*.test.ts):
 * Urteil des Gates (angewandt, Probelauf, Ablehnung), OCC-Ablehnung (`stale`, `staleDelta`), Ablehnung vor dem
 * Gate (SCHEMA-01, SKILL, STRUCT), `violations` gefaltet (summary) oder je Element (full) — die Ablehnungen
 * vor dem Gate tragen auch im Modus summary die Elementliste —, Berichte (`steerAdvisory`, `workOrder`,
 * `metricsAfter`, `berichtFehlt`), `steeringDelta`, `refs`, `vorschlag`, `nameWarning`, `occWarning`.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { GraphVersionSchema, MutateResultSchema, RuleViolationSchema } from '@sigloch/contracts/harness';
import { GroupedViolationSchema } from '../kernel/evaluation.js';
import { SteeringDelta } from '../kernel/measure/steering-snapshot.js';
import { ZugBericht } from '../kernel/measure/zug-bericht.js';

/** Was ein Batch an den Code-Verweisen (R-19/R-20/R-26) bewegt hat — CR-GC-685. */
export const BindingReportSchema = z.object({
  /** Welche fehlenden Code-Verweise dieser Batch geschlossen hat. */
  resolved: z.array(z.string()),
  /** Welche er aufgerissen hat — normalerweise leer. */
  introduced: z.array(z.string()),
  /** Wie viele Verweise im Modell noch offen sind — die Zahl, nicht die Liste. */
  openRefs: z.number().int().nonnegative(),
});
export type BindingReport = z.infer<typeof BindingReportSchema>;

/**
 * Berichte zum Zug, wie sie ueber die Leitung gehen: `fitAdvisory` steht nie darin (CR-GC-853), ein Bericht,
 * der nichts meldet, fehlt (CR-GC-576), und `berichtFehlt` nennt einen Bericht, den die Messung nicht lieferte.
 */
const BerichteAufDerLeitung = ZugBericht.omit({ fitAdvisory: true }).partial().extend({ berichtFehlt: z.string().optional() });

export const GraphMutateAnswerSchema = z.object({
  ...MutateResultSchema.omit({ violations: true, graphVersion: true }).shape,
  ...BerichteAufDerLeitung.shape,
  // `violations` folgt der Eingabe: summary faltet je Regel und Meldungsmuster, full liefert ein Eintrag je Element
  // (CR-GC-570, CR-GC-871). Ablehnungen vor dem Gate tragen immer die Einträge je Element. Strikt, damit ein
  // missratener gefalteter Eintrag nicht als Eintrag je Element durchgeht.
  violations: z.union([z.array(GroupedViolationSchema), z.array(RuleViolationSchema.strict())]),
  /** Immer da: die Revision nach dem Aufruf, bei Ablehnung die unveraenderte. */
  graphVersion: GraphVersionSchema,
  occWarning: z.string().optional(),
  nameWarning: z.string().optional(),
  steeringDelta: SteeringDelta.optional(),
  vorschlag: z.string().optional(),
  refs: BindingReportSchema.optional(),
});
export type GraphMutateAnswer = z.infer<typeof GraphMutateAnswerSchema>;
