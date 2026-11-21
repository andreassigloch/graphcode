// Vertragstest von Hand (der Generator nimmt dieses SCHEMA nicht: zwei refine) — SCHEMA-test-ingest-input → src/projections/testreport.ts#GraphTestIngestInputSchema.
// TEST-vertrag-test-ingest-input
import { describe, it, expect } from 'vitest';
import { GraphTestIngestInputSchema as S } from '../../src/projections/testreport.js';

const bericht = '{"testResults":[]}';
const ergebnisse = [{ file: 'tests/a.test.ts', result: 'passed' }];
const aenderung = ['FUNC-a'];

describe('Vertrag SCHEMA-test-ingest-input: angenommen', () => {
  it('nur report', () => {
    expect(S.parse({ report: bericht })).toEqual({ report: bericht, consumerId: 'test-ingest', dryRun: false });
  });
  it('nur results, mit tool und evidence je Eintrag', () => {
    const r = [{ file: 'tests/m.md', result: 'failed', tool: 'manuell', evidence: 'protokoll.md' }];
    expect(S.parse({ results: r }).results).toEqual(r);
  });
  it('nur changeSet', () => {
    expect(S.parse({ changeSet: aenderung }).changeSet).toEqual(aenderung);
  });
  it('results zusammen mit changeSet', () => {
    expect(S.safeParse({ results: ergebnisse, changeSet: aenderung }).success).toBe(true);
  });
  it('report zusammen mit changeSet', () => {
    expect(S.safeParse({ report: bericht, changeSet: aenderung }).success).toBe(true);
  });
  it('leeres results zählt als genannt', () => {
    expect(S.safeParse({ results: [] }).success).toBe(true);
  });
  it('consumerId und dryRun überschreiben die Vorgaben', () => {
    const p = S.parse({ report: bericht, consumerId: 'x', dryRun: true });
    expect([p.consumerId, p.dryRun]).toEqual(['x', true]);
  });
});

describe('Vertrag SCHEMA-test-ingest-input: abgelehnt', () => {
  it('keins von report, results, changeSet', () => {
    const r = S.safeParse({});
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('supply report, results or changeSet');
  });
  it('nur consumerId und dryRun', () => {
    expect(S.safeParse({ consumerId: 'x', dryRun: true }).success).toBe(false);
  });
  it('report und results zugleich', () => {
    const r = S.safeParse({ report: bericht, results: ergebnisse });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('at most one of report or results');
  });
  it('report mit falschem Typ', () => {
    expect(S.safeParse({ report: 12345 }).success).toBe(false);
  });
  it('results mit falschem Typ', () => {
    expect(S.safeParse({ results: 'tests/a.test.ts' }).success).toBe(false);
  });
  it('results-Eintrag ohne file', () => {
    expect(S.safeParse({ results: [{ result: 'passed' }] }).success).toBe(false);
  });
  it('results-Eintrag mit leerem file', () => {
    expect(S.safeParse({ results: [{ file: '', result: 'passed' }] }).success).toBe(false);
  });
  it('results-Eintrag ohne result', () => {
    expect(S.safeParse({ results: [{ file: 'tests/a.test.ts' }] }).success).toBe(false);
  });
  it('results-Eintrag mit unbekanntem result', () => {
    expect(S.safeParse({ results: [{ file: 'tests/a.test.ts', result: 'gruen' }] }).success).toBe(false);
  });
  it('results-Eintrag mit leerem tool', () => {
    expect(S.safeParse({ results: [{ file: 'tests/a.test.ts', result: 'passed', tool: '' }] }).success).toBe(false);
  });
  it('results-Eintrag mit leerer evidence', () => {
    expect(S.safeParse({ results: [{ file: 'tests/a.test.ts', result: 'passed', evidence: '' }] }).success).toBe(false);
  });
  it('changeSet leer', () => {
    expect(S.safeParse({ changeSet: [] }).success).toBe(false);
  });
  it('changeSet mit leerer uid', () => {
    expect(S.safeParse({ changeSet: [''] }).success).toBe(false);
  });
  it('changeSet mit falschem Typ', () => {
    expect(S.safeParse({ changeSet: 'FUNC-a' }).success).toBe(false);
  });
  it('dryRun mit falschem Typ', () => {
    expect(S.safeParse({ report: bericht, dryRun: 'ja' }).success).toBe(false);
  });
  it('consumerId mit falschem Typ', () => {
    expect(S.safeParse({ report: bericht, consumerId: 1 }).success).toBe(false);
  });
});
