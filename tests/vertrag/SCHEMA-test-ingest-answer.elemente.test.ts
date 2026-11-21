// Von Hand ergänzt (der Generator prüft nur die Felder der ersten Ebene) — SCHEMA-test-ingest-answer → src/projections/testreport.ts#GraphTestIngestAnswerSchema.
// TEST-vertrag-test-ingest-answer
import { describe, it, expect } from 'vitest';
import { GraphTestIngestAnswerSchema as S } from '../../src/projections/testreport.js';

const antwort = {
  applied: 1,
  assignments: [{ testUid: 'TEST-a', file: 'tests/a.test.ts', result: 'passed' }],
  bindings: [{ testUid: 'TEST-b', file: 'tests/b.test.ts', result: 'failed', tool: 'vitest' }],
  unresolved: [{ file: 'tests/c.test.ts', reason: 'kein TEST' }],
  withdrawn: [{ testUid: 'TEST-d', file: 'tests/d.test.ts' }],
  success: true,
  tier: 'auto-apply',
  violations: [],
  graphVersion: 7,
};

describe('Vertrag SCHEMA-test-ingest-answer: Elemente und Gate-Urteil', () => {
  it('nimmt die Antwort ohne tier und mit leeren Listen an', () => {
    const { tier: _t, ...ohne } = antwort;
    expect(S.safeParse({ ...ohne, assignments: [], bindings: [], unresolved: [], withdrawn: [] }).success).toBe(true);
  });
  it('nimmt eine Zuordnung mit Evidenz an', () => {
    const a = [{ testUid: 'TEST-a', file: 'protokoll.md', result: 'passed', evidence: 'docs/p.md' }];
    expect(S.parse({ ...antwort, assignments: a }).assignments).toEqual(a);
  });
  it('nimmt eine Verletzung des Gate-Urteils an', () => {
    const v = [{ ruleId: 'R-01', severity: 'warning', message: 'm', elementId: 'REQ-a' }];
    expect(S.parse({ ...antwort, tier: 'suggest', violations: v }).violations).toEqual(v);
  });
  it('lehnt eine Bindung ohne tool ab', () => {
    expect(S.safeParse({ ...antwort, bindings: [{ testUid: 'TEST-b', file: 'b', result: 'passed' }] }).success).toBe(false);
  });
  it('lehnt ein unbekanntes Ergebnis in einer Zuordnung ab', () => {
    expect(S.safeParse({ ...antwort, assignments: [{ testUid: 'TEST-a', file: 'a', result: 'gruen' }] }).success).toBe(false);
  });
  it('lehnt eine Zuordnung ohne testUid ab', () => {
    expect(S.safeParse({ ...antwort, assignments: [{ file: 'a', result: 'passed' }] }).success).toBe(false);
  });
  it('lehnt ein unbekanntes tier ab', () => {
    expect(S.safeParse({ ...antwort, tier: 'gut' }).success).toBe(false);
  });
  it('lehnt eine Verletzung mit unbekannter severity ab', () => {
    expect(S.safeParse({ ...antwort, violations: [{ ruleId: 'R-01', severity: 'fatal', message: 'm' }] }).success).toBe(false);
  });
  it('lehnt eine nicht aufgelöste Datei ohne Grund ab', () => {
    expect(S.safeParse({ ...antwort, unresolved: [{ file: 'c' }] }).success).toBe(false);
  });
  it('lehnt eine Rücknahme ohne file ab', () => {
    expect(S.safeParse({ ...antwort, withdrawn: [{ testUid: 'TEST-d' }] }).success).toBe(false);
  });
  it('lehnt eine negative graphVersion und ein negatives applied ab', () => {
    expect(S.safeParse({ ...antwort, graphVersion: -1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, applied: -1 }).success).toBe(false);
  });
});
