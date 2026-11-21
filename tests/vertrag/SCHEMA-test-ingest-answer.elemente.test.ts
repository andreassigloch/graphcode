// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-test-ingest-answer → src/projections/testreport.ts#GraphTestIngestAnswerSchema.
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

describe('Vertrag SCHEMA-test-ingest-answer: Wertregeln', () => {
  it('nimmt die Antwort ohne tier und mit leeren Listen an', () => {
    const { tier: _t, ...ohne } = antwort;
    expect(S.safeParse({ ...ohne, assignments: [], bindings: [], unresolved: [], withdrawn: [] }).success).toBe(true);
  });
  it('lehnt eine nicht aufgelöste Datei mit leerem Grund ab', () => {
    expect(S.safeParse({ ...antwort, unresolved: [{ file: 'c', reason: '' }] }).success).toBe(false);
  });
  it('lehnt eine negative graphVersion und ein negatives applied ab', () => {
    expect(S.safeParse({ ...antwort, graphVersion: -1 }).success).toBe(false);
    expect(S.safeParse({ ...antwort, applied: -1 }).success).toBe(false);
  });
});
