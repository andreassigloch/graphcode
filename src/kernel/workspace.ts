/**
 * workspace.ts — die Pfade des Repo-Arbeitsbereichs `.graphcode/`, die der Kern kennt.
 *
 * `KUZU_DIR` lag bis CR-GC-475 (`GRAPHCODE_DIR`/`TRAJECTORY_FILE` bis CR-GC-477 in
 * `surface/scaffold-templates`) als Definition im Paket-Barrel (`index.ts`) und wurde
 * von innen dort importiert — die Oberfläche griff nach der Wurzel. Der Store-Pfad
 * ist Kern-Wissen (REQ-single-kuzu-owner, REQ-disk-persistence); das Barrel
 * re-exportiert ihn nur noch.
 *
 * @author andreas@siglochconsulting
 */

/** Der Repo-Arbeitsbereich: Store, Feed, Config liegen darunter (SPEC §4). */
export const GRAPHCODE_DIR = '.graphcode';
/** Default Kuzu store location relative to the repo root. */
export const KUZU_DIR = `${GRAPHCODE_DIR}/kuzu`;
/** Der Learning-Feed, unter GRAPHCODE_DIR (CR-GC-330). */
export const TRAJECTORY_FILE = 'trajectory.jsonl';
