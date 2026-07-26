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
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Marker path relative to a repo root (gitignored via `.graphcode/`). */
export const EXPORT_PENDING_REL = '.graphcode/EXPORT_PENDING';

function markerPath(repoRoot: string): string {
  return join(repoRoot, EXPORT_PENDING_REL);
}

/** The live model changed and has NOT been re-exported to the committed snapshot. */
export function setExportPending(repoRoot: string): void {
  const p = markerPath(repoRoot);
  mkdirSync(dirname(p), { recursive: true });
  // Existence is the signal; the text is for a human running `cat` on the marker.
  writeFileSync(p, 'live graph mutated since last graph_export — run graph_export before commit\n');
}

/** The committed snapshot is back in sync with the live model (export or reseed). */
export function clearExportPending(repoRoot: string): void {
  rmSync(markerPath(repoRoot), { force: true });
}

/** True while the live model carries un-exported mutations (the pre-commit guard). */
export function isExportPending(repoRoot: string): boolean {
  return existsSync(markerPath(repoRoot));
}
