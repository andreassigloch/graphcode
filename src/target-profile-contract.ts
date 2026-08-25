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

/** Das Zielprofil eines Repos: wohin gesteuert wird und worum es inhaltlich geht. */
export const TargetProfileSchema = z.strictObject({
  /** ℝ⁶-Zielrichtung; leer = unentschieden (Gleichgewichtung, CR-289-Verhalten). */
  weights: TargetWeightsSchema.default({}),
  /** Die 3–7 inhaltlichen Kernthemen der Intention, vom Menschen bestätigt. */
  intentAnchors: z.array(z.string().min(1)).min(3).max(7).optional(),
});
export type TargetProfile = z.infer<typeof TargetProfileSchema>;
