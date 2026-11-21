// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-render-summary → src/surface/render-verb.ts#RenderSummarySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RenderSummarySchema as S } from '../../src/surface/render-verb.js';

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
  it("lehnt ab ohne format", () => {
    expect(S.safeParse({"view":"architecture","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: format mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":12345,"out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: format außerhalb des Enums", () => {
    expect(S.safeParse({"view":"architecture","format":"__ausserhalb__","out":"beispiel","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne out", () => {
    expect(S.safeParse({"view":"architecture","format":"md","bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: out mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":12345,"bytes":0,"vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne bytes", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":"__falsch__","vorlage":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne vorlage", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0}).success).toBe(false);
  });
  it("lehnt ab: vorlage mit falschem Typ", () => {
    expect(S.safeParse({"view":"architecture","format":"md","out":"beispiel","bytes":0,"vorlage":12345}).success).toBe(false);
  });
});
