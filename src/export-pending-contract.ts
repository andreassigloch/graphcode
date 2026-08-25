/**
 * export-pending-contract.ts — SCHEMA-export-pending, der Datenvertrag von
 * `.graphcode/EXPORT_PENDING` (FLOW-export-pending, CR-GC-426).
 *
 * Bis CR-GC-426 war die EXISTENZ der Datei das ganze Signal; ihr Text war
 * ausdrücklich kein Datum („the text is for a human running `cat`"). Der
 * pre-commit-Hook konnte deshalb nur sagen DASS der Snapshot zurückhängt, nie
 * WIE WEIT — und „irgendwas ist offen" ist die Sorte Meldung, die man nach dem
 * dritten Mal wegklickt.
 *
 * Warum das ein Vertrag gehört und keine Prosa: die Datei quert eine
 * PROZESSGRENZE. Geschrieben wird sie vom Apply-Gate im Owner-Prozess, gelesen
 * vom git-Hook eines beliebigen anderen (der den Kuzu-Store nicht öffnen darf —
 * single-writer, REQ-single-kuzu-owner). Genau dort, wo niemand mehr Typen teilt,
 * ist ein blanker Cast die Stelle, an der Format-Drift still durchläuft.
 *
 * Eigene Datei, weil RC-04 Import UND `parse` im Datei-Satz der io-verbundenen
 * FUNC verlangt: ein Schema, das in derselben Datei definiert und geprüft wird,
 * erfüllt das nie (`importedSymbols` bleibt leer — Lehre aus CR-GC-413/420).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/**
 * Der Rückstand des committeten Snapshots gegenüber dem lebenden Store.
 *
 * `versionsBehind` ist die Zahl der ANGEWANDTEN Mutations-Batches seit dem letzten
 * Export. Das ist zugleich die Zahl der `graphVersion`-Schritte, die der Snapshot
 * zurückhängt: der Zähler in `tool-context.ts` bewegt sich um genau 1 pro
 * erfolgreichem Batch. Ein Delta statt einer absoluten Version — der Leser müsste
 * die absolute sonst erst gegen den `graphVersion`-Trailer des Snapshots rechnen
 * (CR-GC-300), und der Schreiber der Marke (das Gate) kennt sie ohnehin nicht:
 * die Version lebt eine Schicht höher, in der Werkzeug-Registry.
 */
export const ExportPending = z.object({
  /** ISO-Zeitstempel der ERSTEN un-exportierten Mutation, nicht der letzten. */
  since: z.string().min(1),
  /** Angewandte Mutations-Batches seit dem letzten Export; ≥ 1, solange die Marke liegt. */
  versionsBehind: z.number().int().positive(),
});

/** Der Rückstand, aus seinem Vertrag abgeleitet. */
export type ExportPending = z.infer<typeof ExportPending>;
