/**
 * repo-pfad-contract.ts — SCHEMA-repo-pfad, der Pfad der Repo-Wurzel, den serveStdio an
 * `attachGve` gibt und den der Start des Viewers als `--repo` übergibt (CR-GC-989).
 *
 * Ein leerer Pfad wäre kein Fehler des Aufrufs, sondern ein Viewer ohne Repo: `--repo ''`
 * startet, ohne zu sagen, welches Repo er zeigt. Der Erzeuger parst deshalb an der Grenze.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Der Pfad der Repo-Wurzel: nicht leerer Text. */
export const RepoPfadSchema = z.string().min(1);

/** Der Repo-Pfad, aus seinem Vertrag abgeleitet — eine Definition. */
export type RepoPfad = z.infer<typeof RepoPfadSchema>;
