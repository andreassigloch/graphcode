/**
 * git-env.setup.ts — der EINE Aufruf (CR-GC-626).
 *
 * Steht als `setupFiles` in `vitest.config.ts` und laeuft damit in jedem Worker, bevor ein Test
 * laedt. Getrennt von `git-env.ts`, weil ein Modul, das beim Import wirkt, jeden Test gruen macht,
 * der es nur importiert — inklusive dem, der die Zusage pruefen soll.
 *
 * @author andreas@siglochconsulting
 */
import { bereinigeGitUmgebung } from './git-env.js';

bereinigeGitUmgebung();
