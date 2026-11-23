// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-generate-input → src/loop/suggest.ts#GraphGenerateInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphGenerateInputSchema as S } from '../../src/loop/suggest.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-generate-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":true})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne intent (optional)", () => {
    expect(S.parse({"threshold":0,"task":"kern","defer":["beispiel"],"peek":true})).toEqual({"threshold":0,"task":"kern","defer":["beispiel"],"peek":true});
  });
  it("lehnt ab: intent mit falschem Typ", () => {
    expect(S.safeParse({"intent":12345,"threshold":0,"task":"kern","defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("intent: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"intent":"","threshold":0,"task":"kern","defer":["beispiel"],"peek":true})).toEqual({"intent":"","threshold":0,"task":"kern","defer":["beispiel"],"peek":true});
  });
  it("nimmt an ohne threshold (optional)", () => {
    expect(S.parse({"intent":"beispiel","task":"kern","defer":["beispiel"],"peek":true})).toEqual({"intent":"beispiel","task":"kern","defer":["beispiel"],"peek":true});
  });
  it("lehnt ab: threshold mit falschem Typ", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":"__falsch__","task":"kern","defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("threshold: lehnt ab: -0.001 unter der Untergrenze 0", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":-0.001,"task":"kern","defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("threshold: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":true})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":true});
  });
  it("threshold: lehnt ab: 1.001 über der Obergrenze 1", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":1.001,"task":"kern","defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("threshold: nimmt 1 an (größter erlaubter Wert, Obergrenze 1)", () => {
    expect(S.parse({"intent":"beispiel","threshold":1,"task":"kern","defer":["beispiel"],"peek":true})).toEqual({"intent":"beispiel","threshold":1,"task":"kern","defer":["beispiel"],"peek":true});
  });
  it("nimmt an ohne task (optional)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"defer":["beispiel"],"peek":true})).toEqual({"intent":"beispiel","threshold":0,"defer":["beispiel"],"peek":true});
  });
  it("lehnt ab: task mit falschem Typ", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":0,"task":12345,"defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("lehnt ab: task außerhalb des Enums", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":0,"task":"__ausserhalb__","defer":["beispiel"],"peek":true}).success).toBe(false);
  });
  it("task: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","task"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["kern","conops","trade","irr","fmea","plan","anforderungsqualitaet"]);
  });
  it("nimmt an ohne defer (optional)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","peek":true})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","peek":true});
  });
  it("lehnt ab: defer mit falschem Typ", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":0,"task":"kern","defer":"__falsch__","peek":true}).success).toBe(false);
  });
  it("defer[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":0,"task":"kern","defer":[12345],"peek":true}).success).toBe(false);
  });
  it("defer[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","defer":[""],"peek":true})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","defer":[""],"peek":true});
  });
  it("defer: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","defer":[],"peek":true})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","defer":[],"peek":true});
  });
  it("nimmt an ohne peek (optional)", () => {
    expect(S.parse({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"]})).toEqual({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":false});
  });
  it("lehnt ab: peek mit falschem Typ", () => {
    expect(S.safeParse({"intent":"beispiel","threshold":0,"task":"kern","defer":["beispiel"],"peek":"__falsch__"}).success).toBe(false);
  });
});
