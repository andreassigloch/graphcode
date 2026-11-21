// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-render-summary → src/surface/render-verb.ts#RenderSummarySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RenderSummarySchema as S } from '../../src/surface/render-verb.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-render-summary', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"})).toEqual({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne view", () => {
    expect(S.safeParse({"format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: view mit falschem Typ", () => {
    expect(S.safeParse({"view":12345,"format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: view außerhalb des Enums", () => {
    expect(S.safeParse({"view":"__ausserhalb__","format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("view: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","view"]])._zod.def.entries as Record<string, unknown>)).toEqual(["architecture","references","srs","nfr","rtm","icd","testconcept","testmatrix","intplan","changelog","fmea","conops","implplan"]);
  });
  it("lehnt ab ohne format", () => {
    expect(S.safeParse({"view":"architecture","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: format mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":12345,"out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: format außerhalb des Enums", () => {
    expect(S.safeParse({"view":"architecture","format":"__ausserhalb__","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("format: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","format"]])._zod.def.entries as Record<string, unknown>)).toEqual(["md","docx","pdf"]);
  });
  it("lehnt ab ohne out", () => {
    expect(S.safeParse({"view":"architecture","format":"md","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: out mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":12345,"bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("out: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("out: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"view":"architecture","format":"md","out":"x","bytes":0,"vorlage":"beispiel"})).toEqual({"view":"architecture","format":"md","out":"x","bytes":0,"vorlage":"beispiel"});
  });
  it("lehnt ab ohne bytes", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":"__falsch__","vorlage":"beispiel"}).success).toBe(false);
  });
  it("bytes: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":-1,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("bytes: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"})).toEqual({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"beispiel"});
  });
  it("bytes: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0.5,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne vorlage", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0}).success).toBe(false);
  });
  it("lehnt ab: vorlage mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":12345}).success).toBe(false);
  });
  it("vorlage: nimmt null an", () => {
    expect(S.parse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":null})).toEqual({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":null});
  });
  it("vorlage: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":""}).success).toBe(false);
  });
  it("vorlage: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"x"})).toEqual({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":"x"});
  });
});
