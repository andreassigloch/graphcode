/**
 * TEST-verify-model-completeness (CR-GC-399) — die Modell-Spur kann nicht still
 * veralten.
 *
 * `npm run verify:model` fährt eine LISTE. Eine Liste, die niemand nachzieht, wird
 * still falsch: wer morgen einen Test schreibt, der die committete SSOT liest, hat
 * ihn nicht in der Spur — und die Spur meldet trotzdem grün. Ohne diesen Test ist
 * Stufe 1 des CR eine Bequemlichkeit mit eingebauter Lücke.
 *
 * Zwei Zusicherungen:
 *   1. Vollständigkeit — jede modellrelevante Testdatei ist entweder in der Spur
 *      oder mit BEGRÜNDUNG ausgeschlossen. Nichts fällt einfach heraus.
 *   2. Parallelitäts-Sicherheit — die Spur läuft parallel, was nur zulässig ist,
 *      solange kein Test der Menge den Repo-Store öffnet (Kuzu: ein Schreiber pro
 *      Store). Wer das echte Repo als repoRoot nimmt, MUSS ein eigenes lockDir
 *      übergeben. Das ist hier geprüft, nicht angenommen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INCLUDED, EXCLUDED, FILE_PARALLELISM, isModelRelevant } from '../scripts/model-test-set.mjs';

const TESTS_DIR = join(process.cwd(), 'tests');

const allTestFiles = (): string[] =>
  readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => `tests/${f}`)
    .sort();

const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');

describe('TEST-verify-model-completeness: die Modell-Spur veraltet nicht still (CR-GC-399)', () => {
  it('jede modellrelevante Testdatei ist in der Spur oder begründet ausgeschlossen', () => {
    const relevant = allTestFiles().filter((f) => isModelRelevant(read(f)));
    const accounted = new Set<string>([...INCLUDED, ...Object.keys(EXCLUDED)]);

    const missing = relevant.filter((f) => !accounted.has(f));
    expect(
      missing,
      `Diese Testdateien lesen die committete SSOT oder die Regel-/Ontologie-Konstanten, stehen ` +
        `aber weder in INCLUDED noch in EXCLUDED von scripts/model-test-set.mjs. Entweder in die ` +
        `Spur aufnehmen oder mit Grund ausschliessen:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('die Spur enthält nichts, was es nicht gibt, und nichts doppelt', () => {
    const existing = new Set(allTestFiles());
    expect(INCLUDED.filter((f: string) => !existing.has(f))).toEqual([]);
    expect(Object.keys(EXCLUDED).filter((f) => !existing.has(f))).toEqual([]);
    expect(new Set(INCLUDED).size).toBe(INCLUDED.length);
  });

  it('jeder Ausschluss trägt einen Grund, keinen leeren Platzhalter', () => {
    for (const [file, reason] of Object.entries(EXCLUDED)) {
      expect(String(reason).length, `${file} ist ohne Begründung ausgeschlossen`).toBeGreaterThan(40);
    }
  });

  it('kein Test der Spur öffnet den Repo-Store — die Voraussetzung der Parallelität', () => {
    expect(FILE_PARALLELISM).toBe(true);
    // Wer das echte Repo als repoRoot benutzt, konstruiert eine Harness — dann muss
    // ein eigenes lockDir dabei sein, sonst kollidiert er parallel mit dem Owner
    // des Repo-Stores (StoreOwnershipError, CR-GC-218).
    const offenders = INCLUDED.filter((f: string) => {
      const src = read(f);
      const usesRepoRoot = /REPO_ROOT|process\.cwd\(\)/.test(src);
      const buildsHarness = /new GraphCodeHarness\(/.test(src);
      return usesRepoRoot && buildsHarness && !/lockDir/.test(src);
    });
    expect(
      offenders,
      `Diese Tests bauen eine Harness auf dem echten Repo ohne eigenes lockDir und wuerden ` +
        `parallel um den Repo-Store konkurrieren:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
