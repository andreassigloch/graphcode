/**
 * Export-pending marker (CR-GC-217) — the single-writer-safe drift signal between
 * the live Kuzu store and the committed SSOT snapshot (docs/graph/*.graph.json).
 *
 * WHY a file and not a Kuzu read: while an agent session runs, the MCP server owns
 * the single Kuzu writer handle (REQ-single-kuzu-owner). A git pre-commit hook can
 * therefore NOT open a second handle to compare store-vs-snapshot. So the gate
 * leaves a marker the hook reads without touching Kuzu:
 *   - mutate() persists a model delta            → setExportPending()   (snapshot stale)
 *   - graph_export writes the committed snapshot  → clearExportPending() (snapshot fresh)
 *   - graph_reseed re-syncs store ← snapshot      → clearExportPending() (back in sync)
 * The pre-commit hook blocks while the marker is present, so no commit can carry a
 * snapshot that lags the live model — REQ-graph-snapshot-per-commit ("each commit a
 * graph state that fits the code"). Recall is the inverse: `git checkout <sha>` +
 * graph_reseed (the committed snapshot is the SSOT at rest / history of record).
 *
 * The marker lives under the gitignored `.graphcode/` workspace, so it never commits.
 *
 * @author andreas@siglochconsulting
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ExportPending } from './export-pending-contract.js';

/** Marker path relative to a repo root (gitignored via `.graphcode/`). */
export const EXPORT_PENDING_REL = '.graphcode/EXPORT_PENDING';

function markerPath(repoRoot: string): string {
  return join(repoRoot, EXPORT_PENDING_REL);
}

/**
 * Wie weit der committete Snapshot zurückhängt (CR-GC-426) — `null`, wenn keine
 * Marke liegt ODER sie keinen Vertrag erfüllt.
 *
 * Der zweite Fall ist der ABWÄRTSKOMPATIBLE: eine Marke, die ein graphcode vor
 * CR-GC-426 geschrieben hat, trägt einen Prosasatz statt JSON. Sie bleibt eine
 * gültige Marke — `isExportPending` sagt weiter „ja" und der Hook blockt weiter —
 * nur die Frage „wie weit" ist an ihr nicht zu beantworten. Geraten wird nicht.
 */
export function readExportPending(repoRoot: string): ExportPending | null {
  const p = markerPath(repoRoot);
  if (!existsSync(p)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null; // Prosa-Marke (vor CR-GC-426) oder halb geschriebene Datei.
  }
  const parsed = ExportPending.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The live model changed and has NOT been re-exported to the committed snapshot.
 *
 * Die Marke ZÄHLT (CR-GC-426): der erste Aufruf setzt `since`, jeder weitere erhöht
 * nur `versionsBehind` — `since` ist der Zeitpunkt, ab dem der Snapshot zurückliegt,
 * nicht der der letzten Mutation. Liegt eine vertragslose Altmarke, beginnt die
 * Zählung neu; das ist die ehrliche Auskunft, denn ihr Rückstand ist nicht bekannt.
 */
export function setExportPending(repoRoot: string): void {
  const p = markerPath(repoRoot);
  mkdirSync(dirname(p), { recursive: true });
  const prev = readExportPending(repoRoot);
  const next: ExportPending = prev
    ? { since: prev.since, versionsBehind: prev.versionsBehind + 1 }
    : { since: new Date().toISOString(), versionsBehind: 1 };
  writeFileSync(p, JSON.stringify(next) + '\n');
}

/** The committed snapshot is back in sync with the live model (export or reseed). */
export function clearExportPending(repoRoot: string): void {
  rmSync(markerPath(repoRoot), { force: true });
}

/** True while the live model carries un-exported mutations (the pre-commit guard). */
export function isExportPending(repoRoot: string): boolean {
  return existsSync(markerPath(repoRoot));
}
