/**
 * TEST-verify-model-completeness (CR-GC-399, CR-GC-1034) — die Modell-Spur kann nicht still
 * veralten.
 *
 * `npm run verify:model` fährt die Tests, die beim Lauf eine Datei der Spur lesen — gemessen
 * (`model-test-set.json`), nicht nach Textmustern geraten. Eine Messung, die niemand nachzieht,
 * wird still falsch: ein neuer oder geänderter Test fehlt darin, und die Spur meldet trotzdem grün.
 *
 * Zusicherungen:
 *   1. Aktualität — jede Testdatei hat eine Messung mit ihrem heutigen Fingerabdruck, und keine
 *      Messung gehört zu einer gelöschten Datei.
 *   2. Ausnahmen sind Entscheidungen — jede ist ein gemessener Leser und trägt einen Grund.
 *   3. Die eine Pfadregel trennt, was sie trennen soll (Modell gegen Skill-Text und Code).
 *   4. Parallelitäts-Sicherheit — kein Test der Spur öffnet den Repo-Store.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INCLUDED, AUSNAHMEN, MEASUREMENT, FILE_PARALLELISM, hashOf, isModelLanePath } from '../scripts/model-test-set.mjs';

const TESTS_DIR = join(process.cwd(), 'tests');

const allTestFiles = (): string[] =>
  readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => `tests/${f}`)
    .sort();

const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');
const dateien: Record<string, { hash: string; liest: string[] }> = MEASUREMENT.dateien;

describe('TEST-verify-model-completeness: die Modell-Spur veraltet nicht still (CR-GC-399, CR-GC-1034)', () => {
  it('jede Testdatei ist mit ihrem heutigen Inhalt gemessen', () => {
    const stale = allTestFiles().filter((f) => dateien[f]?.hash !== hashOf(read(f)));
    expect(
      stale,
      `Diese Testdateien sind neu oder geändert und noch nicht gemessen — ob sie Modell, Sichten, ` +
        `CRs oder Markdown lesen, ist unbekannt. Messen (nur diese, Sekunden): npm run verify:model:messen\n  ${stale.join('\n  ')}`,
    ).toEqual([]);
  });

  it('die Messung nennt keine Datei, die es nicht gibt', () => {
    const existing = new Set(allTestFiles());
    expect(Object.keys(dateien).filter((f) => !existing.has(f))).toEqual([]);
  });

  it('jede Ausnahme ist ein gemessener Leser und trägt einen Grund', () => {
    for (const [file, reason] of Object.entries(AUSNAHMEN)) {
      expect(dateien[file]?.liest.length ?? 0, `${file} liest nichts aus der Spur — dann ist es keine Ausnahme`).toBeGreaterThan(0);
      expect(String(reason).length, `${file} ist ohne Begründung ausgenommen`).toBeGreaterThan(40);
    }
  });

  it('die Pfadregel: Modell, Sichten, CRs und Markdown ja — Skill-Text und Code nein', () => {
    expect(isModelLanePath('docs/graph/graphcode.graph.json')).toBe(true);
    expect(isModelLanePath('docs/views/uebersicht.md')).toBe(true);
    expect(isModelLanePath('docs/cr/open/CR-GC-1.md')).toBe(true);
    expect(isModelLanePath('README.md')).toBe(true);
    expect(isModelLanePath('.claude/commands/se-bau.md')).toBe(false);
    expect(isModelLanePath('src/kernel/gate.ts')).toBe(false);
    expect(isModelLanePath('docs/project/systemmodell-in-bildern.html')).toBe(false);
  });

  it('Gegenprobe der Messung: ein SSOT-Leser ist in der Spur, ein Wegwerf-Repo-Test nicht', () => {
    // channel-model liest die committete SSOT; render-verb schreibt einen eigenen Snapshot in ein Temp-Repo.
    expect(INCLUDED).toContain('tests/channel-model.test.ts');
    expect(INCLUDED).not.toContain('tests/render-verb.test.ts');
  });

  it('kein Test der Spur öffnet den Repo-Store — die Voraussetzung der Parallelität', () => {
    expect(FILE_PARALLELISM).toBe(true);
    // Wer das echte Repo als repoRoot benutzt, konstruiert eine Harness — dann muss
    // ein eigenes lockDir dabei sein, sonst kollidiert er parallel mit dem Owner
    // des Repo-Stores (StoreOwnershipError, CR-GC-218).
    // CR-GC-1034: verdaechtig ist `repoRoot` auf dem echten Repo — wer das Repo nur LIEST und die
    // Harness auf ein Temp-Verzeichnis setzt (claims.conformance: `repoRoot: tmp`), kollidiert nicht.
    // Ohne `repoRoot:`-Angabe bleibt die alte, grobe Vermutung.
    const offenders = INCLUDED.filter((f: string) => {
      const src = read(f);
      const usesRepoRoot = /REPO_ROOT|process\.cwd\(\)/.test(src);
      const harnessOnRepo = /repoRoot:\s*(REPO_ROOT|REPO\b|ROOT\b|process\.cwd\(\))/.test(src) || (usesRepoRoot && !/repoRoot:/.test(src));
      const buildsHarness = /new GraphCodeHarness\(/.test(src);
      return harnessOnRepo && buildsHarness && !/lockDir/.test(src);
    });
    expect(
      offenders,
      `Diese Tests bauen eine Harness auf dem echten Repo ohne eigenes lockDir und wuerden ` +
        `parallel um den Repo-Store konkurrieren:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
