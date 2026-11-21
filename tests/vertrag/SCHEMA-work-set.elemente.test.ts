// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-work-set → src/kernel/measure/working-set.ts#ArbeitsmengeSchema.
// TEST-vertrag-work-set
import { describe, it, expect } from 'vitest';
import { ArbeitsmengeSchema as S } from '../../src/kernel/measure/working-set.js';

describe('Vertrag SCHEMA-work-set: Wertregeln', () => {
  it('nimmt die leere Menge an: noch kein Schreibzug', () => {
    expect(S.parse({ uids: [], zuege: 0 })).toEqual({ uids: [], zuege: 0 });
  });
  it('lehnt eine negative Zugzahl ab', () => {
    expect(S.safeParse({ uids: [], zuege: -1 }).success).toBe(false);
  });
  it('lehnt eine gebrochene Zugzahl ab', () => {
    expect(S.safeParse({ uids: [], zuege: 1.5 }).success).toBe(false);
  });
  it('lehnt eine leere uid ab', () => {
    expect(S.safeParse({ uids: [''], zuege: 1 }).success).toBe(false);
  });
});
