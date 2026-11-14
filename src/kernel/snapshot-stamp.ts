/**
 * Snapshot-Stempel (CR-GC-931) — der Fingerabdruck des committeten Snapshots
 * `docs/graph/<system>.graph.json` zu dem Zeitpunkt, an dem Store und Datei zuletzt gleich waren.
 *
 * Wer Store und Snapshot zur Deckung bringt, stempelt die Datei: `graph_export` (schreibt sie)
 * und der Reseed aus ihr (liest sie). Beim Start vergleicht der Host den Inhalt der Datei mit dem
 * Stempel. Weicht er ab, hat etwas ausserhalb des Hosts die Datei geaendert — `git pull`,
 * `git checkout`. Der Host meldet das; er baut nicht selbst neu auf, denn ein ungewollter Reseed
 * verwirft lokale, noch nicht exportierte Zuege.
 *
 * Bewusst KEIN Abgleich Knoten fuer Knoten und kein zweiter Store-Handle: CR-GC-392 hat den
 * frueheren Vergleich geloescht, weil er `exportGraphJson(store)` gegen die Datei hielt. Hier
 * wird nur der Inhalt der Datei gehasht. Der Stempel liegt auf Platte unter `.graphcode/`
 * (gitignoriert), nicht im Speicher.
 *
 * Fehlt der Stempel (erster Start nach diesem CR, geloeschtes `.graphcode`), ist der Stand
 * unbekannt: keine Meldung, es wird nichts geraten.
 *
 * @author andreas@siglochconsulting
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod/v4';
import { isExportPending, EXPORT_PENDING_REL } from './export-marker.js';

/** Stempel-Pfad relativ zum Repo-Wurzelverzeichnis (gitignoriert ueber `.graphcode/`). */
export const SNAPSHOT_STAMP_REL = '.graphcode/snapshot.sha256';

/** SHA-256 des Dateiinhalts, 64 Hex-Zeichen. */
export const SnapshotStampSchema = z.string().regex(/^[0-9a-f]{64}$/);

export type SnapshotDrift = 'in-sync' | 'unknown' | 'snapshot-newer' | 'export-conflict';

function hashFile(abs: string): string {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

/** Die Datei und der Store sind jetzt gleich: Stempel auf den aktuellen Dateiinhalt. */
export function writeSnapshotStamp(repoRoot: string, snapshotRel: string): void {
  const stamp = join(repoRoot, SNAPSHOT_STAMP_REL);
  mkdirSync(dirname(stamp), { recursive: true });
  writeFileSync(stamp, `${hashFile(join(repoRoot, snapshotRel))}\n`, 'utf8');
}

/** Der gespeicherte Stempel, oder `null`, wenn er fehlt oder formfremd ist (dann: unbekannt). */
function readSnapshotStamp(repoRoot: string): string | null {
  const p = join(repoRoot, SNAPSHOT_STAMP_REL);
  if (!existsSync(p)) return null;
  const parsed = SnapshotStampSchema.safeParse(readFileSync(p, 'utf8').trim());
  return parsed.success ? parsed.data : null;
}

/**
 * Vergleicht den Snapshot mit dem Stempel. Liest nur Dateien.
 * - kein Snapshot oder kein Stempel: `unknown`
 * - gleicher Hash: `in-sync` (auch bei stehender Marke: der Store ist dann voraus, der Export folgt)
 * - anderer Hash, Export steht aus: `export-conflict` (beide Seiten haben sich bewegt)
 * - anderer Hash, kein Export aus: `snapshot-newer`
 */
export function detectSnapshotDrift(repoRoot: string, snapshotRel: string): SnapshotDrift {
  const abs = join(repoRoot, snapshotRel);
  const stamp = readSnapshotStamp(repoRoot);
  if (stamp === null || !existsSync(abs)) return 'unknown';
  if (hashFile(abs) === stamp) return 'in-sync';
  return isExportPending(repoRoot) ? 'export-conflict' : 'snapshot-newer';
}

/** Die Zeile fuer stderr, oder `null`, wenn nichts zu melden ist. */
export function formatSnapshotDriftNotice(drift: SnapshotDrift, snapshotRel: string): string | null {
  if (drift === 'snapshot-newer') {
    return `[graphcode] store: ${snapshotRel} changed since the last export — snapshot is newer than the store; graph_reseed pulls it in. Nothing was changed.\n`;
  }
  if (drift === 'export-conflict') {
    return (
      `[graphcode] store: conflict — ${snapshotRel} changed since the last export AND an export is pending ` +
      `(${EXPORT_PENDING_REL}): the store holds changes the file lacks. Nothing was changed; ` +
      `decide: graph_export keeps the store, graph_reseed keeps the file and drops the pending changes.\n`
    );
  }
  return null;
}
