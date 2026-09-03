/**
 * workspace.ts — die Pfade des Repo-Arbeitsbereichs `.graphcode/`, die der Kern kennt.
 *
 * `KUZU_DIR` lag bis CR-GC-475 als Definition im Paket-Barrel (`index.ts`) und wurde
 * von innen dort importiert — die Oberfläche griff nach der Wurzel. Der Store-Pfad
 * ist Kern-Wissen (REQ-single-kuzu-owner, REQ-disk-persistence); das Barrel
 * re-exportiert ihn nur noch.
 *
 * @author andreas@siglochconsulting
 */

/** Default Kuzu store location relative to the repo root. */
export const KUZU_DIR = '.graphcode/kuzu';
