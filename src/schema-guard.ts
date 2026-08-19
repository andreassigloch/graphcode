/**
 * Store schema guard (CR-GC-249) — auto-reseed on meta-model schema drift.
 *
 * A persistent Kuzu store freezes its schema (node tables + rel-table FROM/TO
 * pairs) at creation time. When the SE meta-model later gains a node type or a
 * trace pair (e.g. FUNC→FUNC compose), the on-disk rel tables no longer cover it
 * and the next write aborts ("Expected labels are …"). The manual recovery was
 * `rm .graphcode/kuzu*` + reseed; this automates it.
 *
 * The guard keys on a FINGERPRINT of the generated DDL — not a version string.
 * The schema depends on node types + TRACE_PATTERNS (the pairs), and those bump
 * META_MODEL_VERSION, NOT ONTOLOGY_VERSION (= SE_DESCRIPTOR.version) — so a
 * version-string guard would miss exactly the pair-addition case it exists for.
 * The DDL fingerprint changes precisely when the on-disk schema would differ, so
 * no human version-bump discipline is required.
 */
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { generateSchema } from '@sigloch/graph-api-core/kuzu';
import type { OntologyDescriptor } from '@sigloch/graph-api-core';

/** Marker file (next to the Kuzu store) holding the schema fingerprint. */
export const SCHEMA_FINGERPRINT_BASENAME = 'ontology.schema';

/**
 * Stable fingerprint of the DDL a descriptor generates — the exact on-disk schema.
 * Uses the same (default) extra-prop options the KuzuAdapter is wired with, so the
 * fingerprint matches what was actually persisted.
 */
export function schemaFingerprint(ontology: OntologyDescriptor): string {
  const ddl = generateSchema(ontology).ddl.join('\n');
  return createHash('sha256').update(ddl).digest('hex').slice(0, 16);
}

/** Read the stored schema fingerprint, or null if the marker is absent/unreadable. */
export function readStoredFingerprint(storeDir: string): string | null {
  const p = join(storeDir, SCHEMA_FINGERPRINT_BASENAME);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** Stamp the store with the current schema fingerprint. */
export function writeStoredFingerprint(storeDir: string, fingerprint: string): void {
  writeFileSync(join(storeDir, SCHEMA_FINGERPRINT_BASENAME), `${fingerprint}\n`, 'utf8');
}

/**
 * Delete the Kuzu store file (+ its WAL sidecar) so the next `init` regenerates the
 * DDL from the current descriptor. The committed graph JSON is the SSOT the caller
 * reseeds from afterwards — this discards only the derived store, never source data.
 */
export function resetKuzuStore(storePath: string): void {
  rmSync(storePath, { force: true });
  rmSync(`${storePath}.wal`, { force: true });
}
