/**
 * store-rebuild-notice.ts — SCHEMA-store-rebuild-notice, die Meldung an den Nutzer, wenn der
 * GraphStore beim Oeffnen neu aufgebaut wurde (FLOW-store-rebuild-notice, CR-GC-831).
 *
 * Der Neuaufbau wirft den Kuzu-Store weg und befüllt ihn aus der committeten SSOT. Was seit dem
 * letzten Export nur im Store stand, ist danach fort — das darf nicht still geschehen. Die Meldung
 * geht beim Start auf stderr, wie die übrigen Host-Meldungen (`[graphcode] …`).
 *
 * Zwei Gründe (CR-GC-796): der Schema-Fingerabdruck weicht vom Marker ab, oder die Store-Datei
 * ist nicht lesbar — dann trägt die Meldung den Fehler, mit dem Kuzu das Öffnen abwies.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { SchemaFingerprintSchema } from './schema-fingerprint-contract.js';

export const StoreRebuildNoticeSchema = z.discriminatedUnion('cause', [
  z.object({
    cause: z.literal('schema'),
    /** Fingerabdruck am Marker vor dem Start. */
    from: SchemaFingerprintSchema,
    /** Fingerabdruck des laufenden Meta-Modells. */
    to: SchemaFingerprintSchema,
    /** Die SSOT-Datei, aus der der Store neu befüllt wurde, repo-relativ. */
    source: z.string().min(1),
  }),
  z.object({
    cause: z.literal('unreadable'),
    /** Die Meldung, mit der das Öffnen des Stores scheiterte. */
    error: z.string().min(1),
    /** Die SSOT-Datei, aus der der Store neu befüllt wurde, repo-relativ. */
    source: z.string().min(1),
  }),
]);

export type StoreRebuildNotice = z.infer<typeof StoreRebuildNoticeSchema>;

/** Die Zeile für stderr. */
export function formatStoreRebuildNotice(notice: StoreRebuildNotice): string {
  const n = StoreRebuildNoticeSchema.parse(notice);
  const reason = n.cause === 'schema' ? `schema changed (${n.from} -> ${n.to})` : `unreadable (${n.error})`;
  return `[graphcode] store: ${reason} — store rebuilt from ${n.source}; changes not exported before are gone\n`;
}
