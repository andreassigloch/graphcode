/**
 * store-rebuild-notice.ts — SCHEMA-store-rebuild-notice, die Meldung an den Nutzer, wenn der
 * GraphStore nach einem Schemawechsel neu aufgebaut wurde (FLOW-store-rebuild-notice, CR-GC-831).
 *
 * Der Neuaufbau wirft den Kuzu-Store weg und befüllt ihn aus der committeten SSOT. Was seit dem
 * letzten Export nur im Store stand, ist danach fort — das darf nicht still geschehen. Die Meldung
 * geht beim Start auf stderr, wie die übrigen Host-Meldungen (`[graphcode] …`).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { SchemaFingerprintSchema } from './schema-fingerprint-contract.js';

export const StoreRebuildNoticeSchema = z.object({
  /** Fingerabdruck am Marker vor dem Start. */
  from: SchemaFingerprintSchema,
  /** Fingerabdruck des laufenden Meta-Modells. */
  to: SchemaFingerprintSchema,
  /** Die SSOT-Datei, aus der der Store neu befüllt wurde, repo-relativ. */
  source: z.string().min(1),
});

export type StoreRebuildNotice = z.infer<typeof StoreRebuildNoticeSchema>;

/** Die Zeile für stderr. */
export function formatStoreRebuildNotice(notice: StoreRebuildNotice): string {
  const n = StoreRebuildNoticeSchema.parse(notice);
  return `[graphcode] store: schema changed (${n.from} -> ${n.to}) — store rebuilt from ${n.source}; changes not exported before are gone\n`;
}
