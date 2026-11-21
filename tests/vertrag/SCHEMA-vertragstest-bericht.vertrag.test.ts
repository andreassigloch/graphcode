// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vertragstest-bericht → src/projections/vertragstest.ts#VertragstestBerichtSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VertragstestBerichtSchema as S } from '../../src/projections/vertragstest.js';

describe('Vertrag SCHEMA-vertragstest-bericht', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}])).toEqual([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("[] (Variante 1): nimmt das Beispiel an", () => {
    expect(S.parse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}])).toEqual([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]);
  });
  it("[] (Variante 1): lehnt ab ohne schema", () => {
    expect(S.safeParse([{"datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: schema mit falschem Typ", () => {
    expect(S.safeParse([{"schema":12345,"datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne datei", () => {
    expect(S.safeParse([{"schema":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: datei mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":12345,"faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne faelle", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: faelle mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":"__falsch__","verworfen":["beispiel"],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne verworfen", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: verworfen mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":"__falsch__","begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1).verworfen[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":[12345],"begrenzt":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab ohne begrenzt", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: begrenzt mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":"__falsch__"}]).success).toBe(false);
  });
  it("[] (Variante 1).begrenzt[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":[12345]}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"schema":"beispiel","datei":"beispiel","faelle":1,"verworfen":["beispiel"],"begrenzt":["beispiel"],"__zusatz__":1}]).success).toBe(false);
  });
  it("[] (Variante 2): nimmt das Beispiel an", () => {
    expect(S.parse([{"schema":"beispiel","fehler":"beispiel"}])).toEqual([{"schema":"beispiel","fehler":"beispiel"}]);
  });
  it("[] (Variante 2): lehnt ab ohne schema", () => {
    expect(S.safeParse([{"fehler":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: schema mit falschem Typ", () => {
    expect(S.safeParse([{"schema":12345,"fehler":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab ohne fehler", () => {
    expect(S.safeParse([{"schema":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: fehler mit falschem Typ", () => {
    expect(S.safeParse([{"schema":"beispiel","fehler":12345}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"schema":"beispiel","fehler":"beispiel","__zusatz__":1}]).success).toBe(false);
  });
});
