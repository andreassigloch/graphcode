// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vertragstest-satz → src/projections/vertragstest.ts#VertragstestSatzSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VertragstestSatzSchema as S } from '../../src/projections/vertragstest.js';

describe('Vertrag SCHEMA-vertragstest-satz', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}]);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("[] (Variante 1): nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}]);
  });
  it("[] (Variante 1): lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345,"symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne symbol", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: symbol mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":12345}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":"beispiel","__zusatz__":1}]).success).toBe(false);
  });
  it("[] (Variante 2): nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":".md"}])).toEqual([{"id":"beispiel","file":".md"}]);
  });
  it("[] (Variante 2): lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":".md"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":".md"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":".md","__zusatz__":1}]).success).toBe(false);
  });
});
