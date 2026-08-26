/**
 * gve-session-contract.ts — SCHEMA-session-registry, der Datenvertrag von
 * `.graphcode/sessions/<pid>` (FLOW-session-registry, CR-GC-416).
 *
 * Warum eine eigene Datei und nicht ein `const` in `gve-sessions.ts`: der Eintrag
 * wird von einem Prozess GESCHRIEBEN und von einem anderen GELESEN — er gehört
 * keinem von beiden allein. (Formal zählt RC-04 eine Deklaration im selben File
 * ohnehin nicht als Bindung: geprüft wird Import UND `parse`.)
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/**
 * Ein Sitzungseintrag: wer im Repo noch ein Dashboard braucht.
 *
 * `hostname` ist nicht kosmetisch: ein Eintrag eines ANDEREN Rechners zählt nicht
 * und wird auch nicht gelöscht, weil seine PID gegen die eigene Prozesstabelle zu
 * prüfen geraten wäre. Genau deshalb muss das Feld geprüft werden — ein Eintrag
 * ohne `hostname` wurde bisher als „fremder Rechner" gelesen und ignoriert, die
 * Sitzung zählte nicht mehr mit, und der Viewer ging zu früh aus.
 */
export const SessionEntrySchema = z.object({
  pid: z.number().int().positive(),
  hostname: z.string().min(1),
  startedAt: z.string().min(1),
});

/** Ein Sitzungseintrag, aus seinem Vertrag abgeleitet — eine Definition. */
export type SessionEntry = z.infer<typeof SessionEntrySchema>;
