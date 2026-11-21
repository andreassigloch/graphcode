// Von Hand ergänzt (der Generator nimmt nur ein Beispiel und die Felder der ersten Ebene) — SCHEMA-work-set → src/kernel/measure/working-set.ts#ArbeitsmengeSchema.
// TEST-vertrag-work-set
import { describe, it, expect } from 'vitest';
import { ArbeitsmengeSchema as S } from '../../src/kernel/measure/working-set.js';

describe('Vertrag SCHEMA-work-set: Grenzfälle', () => {
  it('nimmt die leere Menge an: noch kein Schreibzug', () => {
    expect(S.parse({ uids: [], zuege: 0 })).toEqual({ uids: [], zuege: 0 });
  });
  it('nimmt mehrere uids und mehrere Züge an', () => {
    expect(S.parse({ uids: ['FUNC-a', 'REQ-b'], zuege: 3 }).uids).toEqual(['FUNC-a', 'REQ-b']);
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
  it('lehnt eine uid mit falschem Typ in der Liste ab', () => {
    expect(S.safeParse({ uids: [7], zuege: 1 }).success).toBe(false);
  });
});
