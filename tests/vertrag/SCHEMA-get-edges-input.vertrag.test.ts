// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-get-edges-input → src/surface/read.ts#GraphGetEdgesInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphGetEdgesInputSchema as S } from '../../src/surface/read.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-get-edges-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"uid":"beispiel","edgeType":"beispiel","direction":"in","format":"json"})).toEqual({"uid":"beispiel","edgeType":"beispiel","direction":"in","format":"json"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne uid (optional)", () => {
    expect(S.parse({"edgeType":"beispiel","direction":"in","format":"json"})).toEqual({"edgeType":"beispiel","direction":"in","format":"json"});
  });
  it("lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"uid":12345,"edgeType":"beispiel","direction":"in","format":"json"}).success).toBe(false);
  });
  it("uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"uid":"","edgeType":"beispiel","direction":"in","format":"json"})).toEqual({"uid":"","edgeType":"beispiel","direction":"in","format":"json"});
  });
  it("nimmt an ohne edgeType (optional)", () => {
    expect(S.parse({"uid":"beispiel","direction":"in","format":"json"})).toEqual({"uid":"beispiel","direction":"in","format":"json"});
  });
  it("lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"uid":"beispiel","edgeType":12345,"direction":"in","format":"json"}).success).toBe(false);
  });
  it("edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"uid":"beispiel","edgeType":"","direction":"in","format":"json"})).toEqual({"uid":"beispiel","edgeType":"","direction":"in","format":"json"});
  });
  it("nimmt an ohne direction (optional)", () => {
    expect(S.parse({"uid":"beispiel","edgeType":"beispiel","format":"json"})).toEqual({"uid":"beispiel","edgeType":"beispiel","direction":"both","format":"json"});
  });
  it("lehnt ab: direction mit falschem Typ", () => {
    expect(S.safeParse({"uid":"beispiel","edgeType":"beispiel","direction":12345,"format":"json"}).success).toBe(false);
  });
  it("lehnt ab: direction außerhalb des Enums", () => {
    expect(S.safeParse({"uid":"beispiel","edgeType":"beispiel","direction":"__ausserhalb__","format":"json"}).success).toBe(false);
  });
  it("direction: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","direction"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["in","out","both"]);
  });
  it("nimmt an ohne format (optional)", () => {
    expect(S.parse({"uid":"beispiel","edgeType":"beispiel","direction":"in"})).toEqual({"uid":"beispiel","edgeType":"beispiel","direction":"in","format":"json"});
  });
  it("lehnt ab: format mit falschem Typ", () => {
    expect(S.safeParse({"uid":"beispiel","edgeType":"beispiel","direction":"in","format":12345}).success).toBe(false);
  });
  it("lehnt ab: format außerhalb des Enums", () => {
    expect(S.safeParse({"uid":"beispiel","edgeType":"beispiel","direction":"in","format":"__ausserhalb__"}).success).toBe(false);
  });
  it("format: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","format"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["json","formatE"]);
  });
});
