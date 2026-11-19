// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vertragstest-bericht → src/projections/vertragstest.ts#VertragstestBerichtSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VertragstestBerichtSchema as S } from '../../src/projections/vertragstest.js';

describe('Vertrag SCHEMA-vertragstest-bericht', () => {
  it("Element: Variante 1: nimmt das Beispiel an", () => {
    expect(S.parse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"]}])).toEqual([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"]}]);
  });
  it("Element: Variante 1: lehnt ab ohne schema", () => {
    expect(S.safeParse([{"datei":"beispiel","faelle":1,"verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab: schema mit falschem Typ", () => {
    expect(S.safeParse([{"schema":12345,"datei":"beispiel","faelle":1,"verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab ohne datei", () => {
    expect(S.safeParse([{"schema":"beispiel","faelle":1,"verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab: datei mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":12345,"faelle":1,"verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab ohne faelle", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab: faelle mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":"__falsch__","verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab ohne verworfen", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab: verworfen mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":"__falsch__"}]).success).toBe(false);
  });
  it("Element: Variante 1: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"__zusatz__":1}]).success).toBe(false);
  });
  it("Element: Variante 2: nimmt das Beispiel an", () => {
    expect(S.parse([{"schema":"beispiel","fehler":"beispiel"}])).toEqual([{"schema":"beispiel","fehler":"beispiel"}]);
  });
  it("Element: Variante 2: lehnt ab ohne schema", () => {
    expect(S.safeParse([{"fehler":"beispiel"}]).success).toBe(false);
  });
  it("Element: Variante 2: lehnt ab: schema mit falschem Typ", () => {
    expect(S.safeParse([{"schema":12345,"fehler":"beispiel"}]).success).toBe(false);
  });
  it("Element: Variante 2: lehnt ab ohne fehler", () => {
    expect(S.safeParse([{"schema":"beispiel"}]).success).toBe(false);
  });
  it("Element: Variante 2: lehnt ab: fehler mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","fehler":12345}]).success).toBe(false);
  });
  it("Element: Variante 2: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"schema":"beispiel","fehler":"beispiel","__zusatz__":1}]).success).toBe(false);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
});
