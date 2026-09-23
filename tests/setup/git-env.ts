/**
 * git-env.ts — ein Testlauf erbt die git-Umgebung seines Aufrufers nicht (CR-GC-626).
 *
 * BEFUND, gemessen am 2026-09-23: ein Commit mit Snapshot im Diff brach ab mit
 * `invalid object … for 'docs/graph/fremd-anlage.graph.json'` / `Error building trees`.
 *
 * Die Kette: git setzt jedem Hook `GIT_DIR` und `GIT_INDEX_FILE`. Der `pre-commit` faehrt bei
 * einem Snapshot die Modell-Spur (CR-GC-535); in ihr liegt `rewind.test.ts`, das in einem
 * Temp-Repo `git add -A` fuehrt. Mit geerbtem `GIT_INDEX_FILE` schrieb dieser Aufruf in den Index
 * des UMGEBENDEN Repos, waehrend der Blob im Objektspeicher des Temp-Repos blieb — ein Eintrag,
 * der ins Leere zeigt. `-C <dir>` half nicht: `GIT_DIR` aus der Umgebung sticht es.
 *
 * WARUM IM PROZESS und nicht an den Aufrufstellen: es sind zwei Sorten Aufrufer im selben Prozess —
 * die Tests selbst und der Produktcode, den sie fahren (`rewind.ts`, `measured.ts`,
 * `test-selection-audit.ts`). Raeumt man nur die Tests auf, committen sie ins Temp-Repo, waehrend
 * `resolveCommit` die sha noch im umgebenden Repo sucht — gemessen 10 rote Faelle. Die Umgebung
 * gehoert dem PROZESS, also wird sie einmal im Prozess bereinigt.
 *
 * Diese Datei ist WIRKUNGSFREI: sie stellt die Bereinigung bereit, fuehrt sie aber nicht aus.
 * Das tut `git-env.setup.ts`, und nur das steht in `vitest.config.ts`. Der Grund ist ein
 * gemessener Fehlschlag: solange der Aufruf hier unten stand, reinigte schon der IMPORT den
 * Prozess — `git-env-isolation.test.ts` war damit auch ohne `setupFiles` gruen und bewies nichts.
 *
 * @author andreas@siglochconsulting
 */

/**
 * Die Variablen, mit denen git einen Aufruf auf ein FREMDES Repo umbiegt — Verzeichnis, Index,
 * Objektspeicher, Praefix. Lieber eine zu viel als eine zu wenig: ein Test, der versehentlich im
 * Repo des Aufrufers arbeitet, ist genau der Unfall, den diese Datei ausschliesst.
 */
export const GEERBTE_GIT_VARIABLEN = [
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CEILING_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_INTERNAL_SUPER_PREFIX',
] as const;

/** Entfernt sie aus `env` und meldet, welche wirklich gesetzt waren. */
export function bereinigeGitUmgebung(env: NodeJS.ProcessEnv = process.env): string[] {
  const gefunden = GEERBTE_GIT_VARIABLEN.filter((k) => env[k] !== undefined);
  for (const k of gefunden) delete env[k];
  return gefunden;
}
