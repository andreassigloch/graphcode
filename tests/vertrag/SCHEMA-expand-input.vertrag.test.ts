// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-expand-input → src/surface/read.ts#GraphExpandInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphExpandInputSchema as S } from '../../src/surface/read.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-expand-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"handle":"beispiel","branch":"callers","depth":1})).toEqual({"handle":"beispiel","branch":"callers","depth":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne handle", () => {
    expect(S.safeParse({"branch":"callers","depth":1}).success).toBe(false);
  });
  it("lehnt ab: handle mit falschem Typ", () => {
    expect(S.safeParse({"handle":12345,"branch":"callers","depth":1}).success).toBe(false);
  });
  it("handle: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"handle":"","branch":"callers","depth":1})).toEqual({"handle":"","branch":"callers","depth":1});
  });
  it("nimmt an ohne branch (optional)", () => {
    expect(S.parse({"handle":"beispiel","depth":1})).toEqual({"handle":"beispiel","branch":"all","depth":1});
  });
  it("lehnt ab: branch mit falschem Typ", () => {
    expect(S.safeParse({"handle":"beispiel","branch":12345,"depth":1}).success).toBe(false);
  });
  it("lehnt ab: branch außerhalb des Enums", () => {
    expect(S.safeParse({"handle":"beispiel","branch":"__ausserhalb__","depth":1}).success).toBe(false);
  });
  it("branch: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","branch"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["callers","traces","tests","all"]);
  });
  it("nimmt an ohne depth (optional)", () => {
    expect(S.parse({"handle":"beispiel","branch":"callers"})).toEqual({"handle":"beispiel","branch":"callers","depth":2});
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"handle":"beispiel","branch":"callers","depth":"__falsch__"}).success).toBe(false);
  });
  it("depth: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"handle":"beispiel","branch":"callers","depth":0}).success).toBe(false);
  });
  it("depth: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"handle":"beispiel","branch":"callers","depth":1})).toEqual({"handle":"beispiel","branch":"callers","depth":1});
  });
  it("depth: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"handle":"beispiel","branch":"callers","depth":1.5}).success).toBe(false);
  });
});
