// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-markdown-view → src/projections/exporter.ts#MarkdownViewSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { MarkdownViewSchema as S } from '../../src/projections/exporter.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-markdown-view', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("architecture")).toEqual("architecture");
  });
  it("Werteliste unverändert", () => {
    expect(Object.values(bei([])._zod.def.entries as Record<string, unknown>)).toEqual(["architecture","references","srs","nfr","rtm","icd","testconcept","testmatrix","intplan","changelog","fmea","conops","implplan"]);
  });
  it("nimmt architecture an", () => {
    expect(S.parse("architecture")).toEqual("architecture");
  });
  it("nimmt references an", () => {
    expect(S.parse("references")).toEqual("references");
  });
  it("nimmt srs an", () => {
    expect(S.parse("srs")).toEqual("srs");
  });
  it("nimmt nfr an", () => {
    expect(S.parse("nfr")).toEqual("nfr");
  });
  it("nimmt rtm an", () => {
    expect(S.parse("rtm")).toEqual("rtm");
  });
  it("nimmt icd an", () => {
    expect(S.parse("icd")).toEqual("icd");
  });
  it("nimmt testconcept an", () => {
    expect(S.parse("testconcept")).toEqual("testconcept");
  });
  it("nimmt testmatrix an", () => {
    expect(S.parse("testmatrix")).toEqual("testmatrix");
  });
  it("nimmt intplan an", () => {
    expect(S.parse("intplan")).toEqual("intplan");
  });
  it("nimmt changelog an", () => {
    expect(S.parse("changelog")).toEqual("changelog");
  });
  it("nimmt fmea an", () => {
    expect(S.parse("fmea")).toEqual("fmea");
  });
  it("nimmt conops an", () => {
    expect(S.parse("conops")).toEqual("conops");
  });
  it("nimmt implplan an", () => {
    expect(S.parse("implplan")).toEqual("implplan");
  });
  it("lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse("__ausserhalb__").success).toBe(false);
  });
});
