// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vertragstest-satz → src/projections/vertragstest.ts#VertragstestSatzSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VertragstestSatzSchema as S } from '../../src/projections/vertragstest.js';

describe('Vertrag SCHEMA-vertragstest-satz', () => {
  it("Element: nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}]);
  });
  it("Element: lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("Element: lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("Element: lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("Element: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345,"symbol":"beispiel"}]).success).toBe(false);
  });
  it("Element: lehnt ab ohne symbol", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel"}]).success).toBe(false);
  });
  it("Element: lehnt ab: symbol mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":12345}]).success).toBe(false);
  });
  it("Element: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":"beispiel","__zusatz__":1}]).success).toBe(false);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
});
