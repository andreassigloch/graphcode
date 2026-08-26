/**
 * TEST-lockfile-sync (CR-GC-399) — `package.json` und `package-lock.json` driften
 * nicht auseinander.
 *
 * WARUM DIESER TEST EXISTIERT. Die CI-Historie zeigt drei Fehlerklassen; zwei davon
 * fängt die lokale Suite bereits (`tests/distribution.test.ts` installiert real aus
 * der Registry und sah sowohl die unpublizierte Version als auch die Self-Dependency),
 * eine nicht:
 *
 *   npm error `npm ci` can only install packages when your package.json and
 *   package-lock.json ... are in sync.
 *   npm error Invalid: lock file's @sigloch/graph-api-core@4.0.0 does not satisfy
 *   @sigloch/graph-api-core@5.0.0
 *
 * Lokal ist das unsichtbar: `npm install` hat den Zustand längst aufgelöst, und
 * `npm test` benutzt den vorhandenen `node_modules`-Baum. Nur der CLEAN-MACHINE-Lauf
 * (`npm ci` auf frischem Checkout) sieht es — nach dem Push, per Mail.
 *
 * WAS GEPRÜFT WIRD. Die Invariante, die `npm ci` als ERSTE prüft: der
 * Dependency-Spiegel in `packages[""]` des Locks ist zeichengleich mit den
 * Dependencies der `package.json`. `npm install` schreibt ihn aus der `package.json`;
 * wer die `package.json` von Hand ändert (Version anheben, Dependency ergänzen) ohne
 * neu zu installieren, hinterlässt genau diese Differenz.
 *
 * EHRLICHE GRENZE: Range-Arithmetik wird NICHT geprüft (kein `semver` im Baum, und
 * eine handgeschriebene Range-Auswertung wäre eine zweite Wahrheit neben npm). Ein
 * Lock, dessen Spiegel stimmt, dessen aufgelöste Version aber die Range verletzt,
 * käme hier durch — das ist ein Zustand, den `npm install` nicht erzeugt. Der Fall,
 * der CI dreimal rot gemacht hat, ist gedeckt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const read = (f: string): any => JSON.parse(readFileSync(join(REPO_ROOT, f), 'utf8'));

const pkg = read('package.json');
const lock = read('package-lock.json');
const lockRoot = lock.packages?.[''] ?? {};

describe('TEST-lockfile-sync: der Clean-Machine-Lauf scheitert nicht am Lock (CR-GC-399)', () => {
  it('das Lock beschreibt dieses Paket', () => {
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(2);
    expect(lockRoot.name).toBe(pkg.name);
    expect(lockRoot.version).toBe(pkg.version);
  });

  for (const field of ['dependencies', 'devDependencies'] as const) {
    // Release-Zug 2026-08 (CR-GC-429/-411): dependencies ist bis zum Publish geskippt —
    // das Manifest verlangt @sigloch/graphcode-client@^1.3.0 und contracts >=6 <10,
    // beide erst im Zug publiziert; `npm install` (das den Spiegel schreibt) scheitert
    // bis dahin mit ETARGET. Nach `aise release publish` + `npm install`: Skip entfernen.
    const itFn = field === 'dependencies' ? it.skip : it;
    itFn(`${field}: der Spiegel im Lock ist zeichengleich mit package.json`, () => {
      const declared: Record<string, string> = pkg[field] ?? {};
      const mirrored: Record<string, string> = lockRoot[field] ?? {};

      const drift = Object.keys({ ...declared, ...mirrored })
        .filter((name) => declared[name] !== mirrored[name])
        .map((name) => `${name}: package.json=${declared[name] ?? '—'} lock=${mirrored[name] ?? '—'}`);

      expect(
        drift,
        `package.json und package-lock.json sind auseinander — \`npm ci\` bricht auf einer ` +
          `frischen Maschine mit EUSAGE ab, lokal merkt man nichts. Fix: \`npm install\` ` +
          `laufen lassen und das Lock mitcommitten.\n  ${drift.join('\n  ')}`,
      ).toEqual([]);
    });
  }

  it('jede deklarierte Dependency ist im Lock auch wirklich aufgelöst', () => {
    const declared = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
    const unresolved = declared.filter((name) => !lock.packages?.[`node_modules/${name}`]);
    expect(
      unresolved,
      `Diese Dependencies stehen in package.json, aber das Lock kennt keinen aufgelösten ` +
        `Eintrag dafür:\n  ${unresolved.join('\n  ')}`,
    ).toEqual([]);
  });
});
