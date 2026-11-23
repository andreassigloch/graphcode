// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-suggest-input → src/loop/suggest.ts#GraphSuggestInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphSuggestInputSchema as S } from '../../src/loop/suggest.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-suggest-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"k":1,"layer":"all"})).toEqual({"k":1,"layer":"all"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne k (optional)", () => {
    expect(S.parse({"layer":"all"})).toEqual({"k":5,"layer":"all"});
  });
  it("lehnt ab: k mit falschem Typ", () => {
    expect(S.safeParse({"k":"__falsch__","layer":"all"}).success).toBe(false);
  });
  it("k: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"k":0,"layer":"all"}).success).toBe(false);
  });
  it("k: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"k":1,"layer":"all"})).toEqual({"k":1,"layer":"all"});
  });
  it("k: lehnt ab: 21 über der Obergrenze 20", () => {
    expect(S.safeParse({"k":21,"layer":"all"}).success).toBe(false);
  });
  it("k: nimmt 20 an (größter erlaubter Wert, Obergrenze 20)", () => {
    expect(S.parse({"k":20,"layer":"all"})).toEqual({"k":20,"layer":"all"});
  });
  it("k: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"k":1.5,"layer":"all"}).success).toBe(false);
  });
  it("nimmt an ohne layer (optional)", () => {
    expect(S.parse({"k":1})).toEqual({"k":1,"layer":"arch"});
  });
  it("lehnt ab: layer mit falschem Typ", () => {
    expect(S.safeParse({"k":1,"layer":12345}).success).toBe(false);
  });
  it("lehnt ab: layer außerhalb des Enums", () => {
    expect(S.safeParse({"k":1,"layer":"__ausserhalb__"}).success).toBe(false);
  });
  it("layer: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","layer"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["all","arch"]);
  });
});
