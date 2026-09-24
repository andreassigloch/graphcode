/**
 * TEST-engpass — ein benannter Engpass hat die Zahl Aufrufer, die er haben darf (CR-GC-634).
 *
 * BEFUND, gemessen am 2026-09-23: CR-GC-631 loeschte `GraphCodeCodec.decode()` und stellte 13
 * Teststellen auf einen Helfer um, der **selbst** `FORMAT_E_CODEC.parse` rief und die
 * Operationen **selbst** abbildete — ein zweiter Leser derselben Sprache, und zwar in den
 * Tests, also genau dort, wo das Auseinanderlaufen niemandem auffaellt.
 *
 * WARUM KEIN AEHNLICHKEITSMASS. Am selben Paar gemessen, mit den Routinen aus
 * `@sigloch/contracts/se` (dieselben, die ND-01/ND-02 fahren):
 *
 *   Name-Jaccard    `knotenAus` ↔ `formatEToCommands`   0,000
 *   Rumpf-Jaccard   16 Zeilen ↔ 183 Zeilen              0,164     (ND-Schwelle: 0,85)
 *
 * Ein zweiter Pfad ist dem ersten nie aehnlich: er ist kuerzer, anders benannt und kann
 * weniger. Aehnlichkeitsmasse finden Copy-Paste, nicht eine zweite Auslegung derselben
 * Sprache. Und ND haette hier ohnehin nichts sehen koennen — Testhilfen tragen keinen Knoten
 * (117 Dateien im Modell mit `testRefs`, davon 0 unter `tests/helpers/`).
 *
 * Was beide teilten, war der EINGANG. Also wird der Eingang gezaehlt, nicht der Rumpf.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/**
 * Die Engpaesse: Stellen, an denen eine Sprache oder ein Vertrag das Repo BETRITT, und die
 * Aufrufer, die sie haben duerfen. Eine Ratsche — die Liste darf schrumpfen, nicht wachsen.
 * Ein neuer Aufrufer ist keine Kleinigkeit, sondern eine zweite Auslegung.
 */
const ENGPAESSE = [
  {
    name: 'Format-E lesen',
    muster: /FORMAT_E_CODEC\.parse\s*\(|\.inner\.parse\s*\(|new FormatECodec\([^)]*\)\.parse\s*\(|FormatEInputSchema\.(safeParse|parse)\s*\(/,
    erlaubt: ['src/loop/format-e-commands.ts'],
    warum:
      'Format-E-Text wird an GENAU EINER Stelle zu Operationen — `formatEToCommands`, gefahren ' +
      'von graph_mutate UND bootstrap (CR-GC-630/631/632), ueber die Tuer der Familie ' +
      '(`FormatEInputSchema`, graph-api-core, CR-SM-359). Wer daneben selbst parst, legt die ' +
      'Sprache ein zweites Mal aus. Fuer src/ prueft das seit CR-GC-641 auch RC-09 am Modell; ' +
      'diese Ratsche deckt zusaetzlich tests/ ab.',
  },
  {
    name: 'Format-E-Codec bauen',
    muster: /new FormatECodec\s*\(/,
    erlaubt: [],
    warum:
      'Die eine SE-Instanz gehoert der Familie (`SE_FORMAT_E_CODEC`, graph-api-core, CR-SM-359). ' +
      'graphcode baut keinen Codec — eine eigene Instanz waere eine zweite Stelle, an der jemand ' +
      'einen anderen Deskriptor unterschiebt (CR-GC-631).',
  },
];

/**
 * Kommentare raus, bevor gezaehlt wird — sonst misst der Test die Doku statt des Codes.
 * Gemessener Anlass: beim ERSTEN Lauf meldete er `tool-context.ts`, und der Treffer war ein
 * Kommentar, der die geloeschte Konstruktion beschreibt. (Dieselbe Lehre wie in
 * `scripts/spike-nd-known-answer.mjs`.)
 */
const ohneKommentare = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** Alle .ts unter src/ und tests/ — ohne dist, node_modules, Deklarationen. */
function quellen(): string[] {
  const treffer: string[] = [];
  const lauf = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (e === 'node_modules' || e === 'dist') continue;
        lauf(p);
      } else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) {
        treffer.push(relative(REPO, p));
      }
    }
  };
  lauf(join(REPO, 'src'));
  lauf(join(REPO, 'tests'));
  return treffer.sort();
}

describe('TEST-engpass: ein benannter Engpass hat einen Aufrufer (CR-GC-634)', () => {
  const dateien = quellen();

  it('findet ueberhaupt Quelldateien — sonst waere jede Zusicherung unten vacuous', () => {
    expect(dateien.length).toBeGreaterThan(100);
  });

  for (const engpass of ENGPAESSE) {
    it(`${engpass.name}: nur ${engpass.erlaubt.join(', ')}`, () => {
      const rufer = dateien.filter((f) => engpass.muster.test(ohneKommentare(readFileSync(join(REPO, f), 'utf8'))));

      // Die erlaubte Stelle MUSS rufen — sonst prueft der Test ein totes Muster.
      for (const erlaubt of engpass.erlaubt) {
        expect(rufer, `${erlaubt} ruft den Engpass nicht (mehr) — Muster veraltet?`).toContain(erlaubt);
      }

      const fremd = rufer.filter((f) => !engpass.erlaubt.includes(f));
      expect(
        fremd,
        `Zweiter Zugang zu "${engpass.name}": ${fremd.join(', ')}.\n  ${engpass.warum}\n` +
          '  Ruf die eine Stelle, statt daneben zu parsen — oder nimm die Datei hier auf und sag im CR warum.',
      ).toEqual([]);
    });
  }
});
