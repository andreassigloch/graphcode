// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-import-summary → src/surface/import-code-verb.ts#ImportCodeSummarySchema.
// TEST-vertrag-import-summary
import { describe, it, expect } from 'vitest';
import { ImportCodeSummarySchema as S } from '../../src/surface/import-code-verb.js';

const befund = { ruleId: 'R-20', severity: 'warning', elementId: 'FUNC-a', message: 'ohne realRef', fixHint: 'binden' };
const zusammenfassung = {
  files: 3,
  extracted: { FUNC: 4, MOD: 2 },
  status: 'success',
  applied: { nodes: 6, edges: 5 },
  violations: [befund],
  backupPath: '.graphcode/backup/graph-1.json',
  exportPath: 'docs/graph/x.graph.json',
};

describe('Vertrag SCHEMA-import-summary: Wertregeln', () => {
  it('nimmt eine Zusammenfassung ohne Backup, Export und mit leeren Befunden an', () => {
    const { backupPath: _b, exportPath: _e, ...ohne } = zusammenfassung;
    expect(S.safeParse({ ...ohne, violations: [] }).success).toBe(true);
    expect(S.safeParse({ ...ohne, violations: [], exportError: 'Export verweigert' }).success).toBe(true);
  });
  it('lehnt null Dateien, gebrochene und negative Zähler ab', () => {
    expect(S.safeParse({ ...zusammenfassung, files: 0 }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, files: 1.5 }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, applied: { nodes: -1, edges: 0 } }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, applied: { nodes: 0, edges: 1.5 } }).success).toBe(false);
  });
  it('lehnt eine Zählung je Typ mit 0, negativem oder gebrochenem Wert ab; keine Typen gelten', () => {
    expect(S.safeParse({ ...zusammenfassung, extracted: { FUNC: 0 } }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, extracted: { FUNC: -2 } }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, extracted: { FUNC: 1.5 } }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, extracted: {} }).success).toBe(true);
  });
  it('lehnt einen unbekannten Status ab; partial und failed gelten', () => {
    expect(S.safeParse({ ...zusammenfassung, status: 'ok' }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, status: 'partial' }).success).toBe(true);
    expect(S.safeParse({ ...zusammenfassung, status: 'failed' }).success).toBe(true);
  });
  it('lehnt einen Befund ohne Element, ohne Meldung oder mit falscher Schwere ab; fixHint ist frei', () => {
    const { elementId: _e, ...ohneElement } = befund;
    const { message: _m, ...ohneMeldung } = befund;
    const { fixHint: _f, ...ohneHinweis } = befund;
    expect(S.safeParse({ ...zusammenfassung, violations: [ohneElement] }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, violations: [ohneMeldung] }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, violations: [{ ...befund, severity: 'fatal' }] }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, violations: [ohneHinweis] }).success).toBe(true);
  });
  it('lehnt leere Pfade und eine leere Fehlermeldung ab', () => {
    expect(S.safeParse({ ...zusammenfassung, backupPath: '' }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, exportPath: '' }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, exportError: '' }).success).toBe(false);
  });
});
