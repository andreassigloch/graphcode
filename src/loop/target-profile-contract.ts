/**
 * target-profile-contract.ts — SCHEMA-target-profile, der Datenvertrag von
 * `.graphcode/target-profile.json` (FLOW-target-profile, CR-GC-419).
 *
 * Warum eine eigene Datei: die Datei wird vom Skill `se:target-profile`
 * GESCHRIEBEN und von `loadTargetProfile` GELESEN — zwei Schreiber, ein Format;
 * der Vertrag gehört keinem von beiden. (Formal zählt RC-04 eine Deklaration im
 * selben File ohnehin nicht als Bindung: geprüft wird Import UND `parse`.)
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Gewicht je Dimension: -1 (weg davon) bis 1 (dahin), 0/fehlend = unentschieden. */
const weight = z.number().min(-1).max(1);

/**
 * Sollwert je Dimension auf DERSELBEN Skala, die `metrics()` liefert (0–5, `clamp05`
 * in @sigloch/se-engine). CR-GC-457: ein Gewicht ist keine Zielmarke — `1.0` neben
 * einem Ist-Wert von `3.71` liest sich auf der Werteskala als „senken" und meint das
 * Gegenteil. Wer den Abstand zum Ziel zeichnen will, braucht eine Zahl in derselben
 * Einheit wie der Ist-Wert.
 */
const targetValue = z.number().min(0).max(5);

/** Die Gewichts-Form ist identisch zum graph_suggest-`target`-Input — suggest.ts importiert sie (kein Parallelpfad). */
export const TargetWeightsSchema = z.strictObject({
  modifiability: weight.optional(),
  faultTolerance: weight.optional(),
  flowEfficiency: weight.optional(),
  coherence: weight.optional(),
  viability: weight.optional(),
  scalability: weight.optional(),
});
export type TargetWeights = z.infer<typeof TargetWeightsSchema>;

/**
 * Zielwerte je Dimension (CR-GC-457). Getrennt von {@link TargetWeightsSchema}, weil
 * die beiden verschiedene Aufgaben haben und keins aus dem anderen folgt: das GEWICHT
 * steuert die Rangfolge in `graph_suggest` (L2-normiert, CR-GC-353 — nur die Richtung
 * zählt), der WERT ist die Marke, gegen die ein Mensch den Ist-Wert liest. Aus einem
 * Gewicht folgt kein Sollwert und aus einem Sollwert kein Vorrang.
 *
 * Widersprechen sich beide (`+1` heben, Sollwert unter dem Ist-Wert), meldet
 * `graph_metrics.fit.target.inconsistent` das — dort, wo der Ist-Wert bekannt ist.
 * Warnung, nie Block: dieselbe Linie wie `conflictWarnings`.
 */
export const TargetValuesSchema = z.strictObject({
  modifiability: targetValue.optional(),
  faultTolerance: targetValue.optional(),
  flowEfficiency: targetValue.optional(),
  coherence: targetValue.optional(),
  viability: targetValue.optional(),
  scalability: targetValue.optional(),
});
export type TargetValues = z.infer<typeof TargetValuesSchema>;

/** Das Zielprofil eines Repos: wohin gesteuert wird und worum es inhaltlich geht. */
export const TargetProfileSchema = z.strictObject({
  /** ℝ⁶-Zielrichtung; leer = unentschieden (Gleichgewichtung, CR-289-Verhalten). */
  weights: TargetWeightsSchema.default({}),
  /** ℝ⁶-Zielwerte auf der 0–5-Skala; fehlend = kein Sollwert, nie eine erfundene Mitte. */
  values: TargetValuesSchema.default({}),
  /** Die 3–7 inhaltlichen Kernthemen der Intention, vom Menschen bestätigt. */
  intentAnchors: z.array(z.string().min(1)).min(3).max(7).optional(),
});
export type TargetProfile = z.infer<typeof TargetProfileSchema>;
