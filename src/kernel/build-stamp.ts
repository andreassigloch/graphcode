/**
 * build-stamp.ts — womit der laufende Prozess gebootet hat (CR-GC-620).
 *
 * `readPackageVersion()` nennt die Paketnummer. Die identifiziert ein RELEASE, keinen Build:
 * `npm run build` macht `rm -rf dist && tsc` und lässt die Nummer stehen, und ein
 * `npm install` tauscht `@sigloch/contracts` unter derselben graphcode-Version aus. Ein
 * Prozess lebt aber mit dem Code weiter, mit dem er gestartet ist — beides ist für ihn
 * unsichtbar, und `status` meldete deshalb `Version OK` über einem Host, dessen geladene
 * Dateien seit elf Stunden gelöscht waren (gemessen 2026-09-23, pid 2422).
 *
 * Deshalb hier die zwei Grössen, die sich ÄNDERN, wenn sich der Build ändert, und die ein
 * anderer Prozess ohne Rückfrage beim Host nachschlagen kann: die neueste Änderung unter dem
 * Code-Wurzelverzeichnis und die installierte contracts-Version. Ein Zeitstempel ist keine
 * Prüfsumme — er beweist nicht, dass der Inhalt ein anderer ist. Er beantwortet aber genau die
 * gestellte Frage („ist seit meinem Boot gebaut worden?"), und zwar ohne 60 Dateien zu lesen.
 *
 * @author andreas@siglochconsulting
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageRootDir } from './package-version.js';

/** Was ein Prozess über seinen eigenen Build weiss. */
export interface BuildStamp {
  /** Das Verzeichnis, aus dem der laufende Code geladen wurde (`…/dist`, im Dev-Baum `…/src`). */
  codeRoot: string;
  /** Neueste `mtimeMs` darunter. `0` heisst: nicht lesbar — dann wird nicht geurteilt. */
  codeMtimeMs: number;
  /** Die installierte `@sigloch/contracts`-Version, oder `undefined`, wenn sie nicht auffindbar ist. */
  contracts?: string;
}

/**
 * Die Code-Wurzel des laufenden Prozesses: das Kind der Paketwurzel, auf dessen Pfad diese
 * Datei liegt — `dist` im veröffentlichten Paket, `src` im Dev-Baum. Nicht fest verdrahtet,
 * aus demselben Grund wie in `packageRootDir()`: eine gezählte Ebene bricht beim nächsten
 * Verzeichnis-Umbau stumm.
 */
export function codeRootDir(): string {
  const wurzel = packageRootDir();
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dirname(dir) !== wurzel) {
    const eltern = dirname(dir);
    if (eltern === dir) return dir; // Paketwurzel nicht auf dem Pfad — nimm, was da ist
    dir = eltern;
  }
  return dir;
}

/**
 * Die neueste Änderung unter `root`, rekursiv. Rein: Pfad rein, Zahl raus.
 *
 * `0` für ein nicht lesbares Verzeichnis — und `0` ist kein Messwert, sondern die Abwesenheit
 * eines Messwerts. Der Aufrufer muss daraus „nicht beurteilbar" machen, nie „unverändert":
 * ein Vergleich gegen 0 meldete sonst jedem Host Drift, dessen Verzeichnis gerade nicht
 * lesbar ist.
 */
export function neuesteAenderung(root: string): number {
  let neueste = 0;
  const gehe = (dir: string): void => {
    let eintraege;
    try {
      eintraege = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of eintraege) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        gehe(p);
        continue;
      }
      try {
        neueste = Math.max(neueste, statSync(p).mtimeMs);
      } catch {
        /* zwischen readdir und stat verschwunden */
      }
    }
  };
  gehe(root);
  return neueste;
}

/**
 * Die installierte `@sigloch/contracts`-Version — die, die ein Boot JETZT laden würde.
 *
 * Über `node_modules` neben der Paketwurzel gelesen, nicht über einen Import: ein Import gäbe
 * die Version des SCHON GELADENEN Moduls zurück, und genau deren Vergleich mit der Platte ist
 * die Frage.
 */
export function installierteContracts(paketWurzel = packageRootDir()): string | undefined {
  const pfad = join(paketWurzel, 'node_modules', '@sigloch', 'contracts', 'package.json');
  if (!existsSync(pfad)) return undefined;
  try {
    const v = (JSON.parse(readFileSync(pfad, 'utf8')) as { version?: unknown }).version;
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Der Stempel des laufenden Prozesses — einmal beim Boot genommen, in den Lock geschrieben. */
export function buildStempel(): BuildStamp {
  const codeRoot = codeRootDir();
  return {
    codeRoot,
    codeMtimeMs: neuesteAenderung(codeRoot),
    contracts: installierteContracts(),
  };
}
