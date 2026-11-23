// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-elements-input → src/surface/read.ts#GraphElementsInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphElementsInputSchema as S } from '../../src/surface/read.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-elements-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":true})).toEqual({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne type (optional)", () => {
    expect(S.parse({"search":"beispiel","limit":1,"format":"json","prosa":true})).toEqual({"search":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"type":12345,"search":"beispiel","limit":1,"format":"json","prosa":true}).success).toBe(false);
  });
  it("type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"type":"","search":"beispiel","limit":1,"format":"json","prosa":true})).toEqual({"type":"","search":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("nimmt an ohne search (optional)", () => {
    expect(S.parse({"type":"beispiel","limit":1,"format":"json","prosa":true})).toEqual({"type":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("lehnt ab: search mit falschem Typ", () => {
    expect(S.safeParse({"type":"beispiel","search":12345,"limit":1,"format":"json","prosa":true}).success).toBe(false);
  });
  it("search: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"type":"beispiel","search":"","limit":1,"format":"json","prosa":true})).toEqual({"type":"beispiel","search":"","limit":1,"format":"json","prosa":true});
  });
  it("nimmt an ohne limit (optional)", () => {
    expect(S.parse({"type":"beispiel","search":"beispiel","format":"json","prosa":true})).toEqual({"type":"beispiel","search":"beispiel","limit":100,"format":"json","prosa":true});
  });
  it("lehnt ab: limit mit falschem Typ", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":"__falsch__","format":"json","prosa":true}).success).toBe(false);
  });
  it("limit: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":0,"format":"json","prosa":true}).success).toBe(false);
  });
  it("limit: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":true})).toEqual({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("limit: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":1.5,"format":"json","prosa":true}).success).toBe(false);
  });
  it("nimmt an ohne format (optional)", () => {
    expect(S.parse({"type":"beispiel","search":"beispiel","limit":1,"prosa":true})).toEqual({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":true});
  });
  it("lehnt ab: format mit falschem Typ", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":1,"format":12345,"prosa":true}).success).toBe(false);
  });
  it("lehnt ab: format außerhalb des Enums", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":1,"format":"__ausserhalb__","prosa":true}).success).toBe(false);
  });
  it("format: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","format"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["json","formatE"]);
  });
  it("nimmt an ohne prosa (optional)", () => {
    expect(S.parse({"type":"beispiel","search":"beispiel","limit":1,"format":"json"})).toEqual({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":false});
  });
  it("lehnt ab: prosa mit falschem Typ", () => {
    expect(S.safeParse({"type":"beispiel","search":"beispiel","limit":1,"format":"json","prosa":"__falsch__"}).success).toBe(false);
  });
});
