/**
 * target-profile-contract.ts — SCHEMA-target-profile, der Datenvertrag von
 * `.graphcode/target-profile.json` (FLOW-target-profile, CR-GC-419).
 *
 * Warum eine eigene Datei: die Datei hat zwei Schreiber (`persistIntentAnchors` im
 * Hintergrund von graph_generate und ein Hand-Edit) und einen Leser (`loadTargetProfile`);
 * der Vertrag gehört keinem von ihnen. (Formal zählt RC-04 eine Deklaration im selben
 * File ohnehin nicht als Bindung: geprüft wird Import UND `parse`.)
 *
 * CR-GC-861 (Teil 3 von CR-GC-853): Gewichte und Zielwerte sind zurückgebaut. Sie steuerten
 * seit CR-GC-483 nichts mehr; eine Entscheidung des Autors steht jetzt als Constraint im
 * Modell (CR-GC-804). Der Vertrag trägt nur noch die Themen. Strikt: eine Datei, die noch
 * `weights` oder `values` trägt, scheitert laut beim Laden.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Die Profildatei eines Repos: worum es inhaltlich geht. */
export const TargetProfileSchema = z.strictObject({
  /** Die 3–7 inhaltlichen Kernthemen der Intention (CR-GC-307: still gesetzt von graph_generate). */
  intentAnchors: z.array(z.string().min(1)).min(3).max(7).optional(),
});
export type TargetProfile = z.infer<typeof TargetProfileSchema>;
