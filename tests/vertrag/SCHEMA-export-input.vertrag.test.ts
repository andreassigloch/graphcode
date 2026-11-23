// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-export-input → src/projections/export.ts#GraphExportInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphExportInputSchema as S } from '../../src/projections/export.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-export-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"name":"A","views":["architecture"],"force":true})).toEqual({"name":"A","views":["architecture"],"force":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne name (optional)", () => {
    expect(S.parse({"views":["architecture"],"force":true})).toEqual({"views":["architecture"],"force":true});
  });
  it("lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"name":12345,"views":["architecture"],"force":true}).success).toBe(false);
  });
  it("name: lehnt ab: Text verletzt die Regel /^[A-Za-z0-9._-]+$/", () => {
    expect(S.safeParse({"name":"!","views":["architecture"],"force":true}).success).toBe(false);
  });
  it("nimmt an ohne views (optional)", () => {
    expect(S.parse({"name":"A","force":true})).toEqual({"name":"A","force":true});
  });
  it("lehnt ab: views mit falschem Typ", () => {
    expect(S.safeParse({"name":"A","views":"__falsch__","force":true}).success).toBe(false);
  });
  it("views[]: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","views"],["innerType"],["element"]])._zod.def.entries as Record<string, unknown>)).toEqual(["architecture","references","srs","nfr","rtm","icd","testconcept","testmatrix","intplan","changelog","fmea","conops","implplan"]);
  });
  it("views[]: nimmt architecture an", () => {
    expect(S.parse({"name":"A","views":["architecture"],"force":true})).toEqual({"name":"A","views":["architecture"],"force":true});
  });
  it("views[]: nimmt references an", () => {
    expect(S.parse({"name":"A","views":["references"],"force":true})).toEqual({"name":"A","views":["references"],"force":true});
  });
  it("views[]: nimmt srs an", () => {
    expect(S.parse({"name":"A","views":["srs"],"force":true})).toEqual({"name":"A","views":["srs"],"force":true});
  });
  it("views[]: nimmt nfr an", () => {
    expect(S.parse({"name":"A","views":["nfr"],"force":true})).toEqual({"name":"A","views":["nfr"],"force":true});
  });
  it("views[]: nimmt rtm an", () => {
    expect(S.parse({"name":"A","views":["rtm"],"force":true})).toEqual({"name":"A","views":["rtm"],"force":true});
  });
  it("views[]: nimmt icd an", () => {
    expect(S.parse({"name":"A","views":["icd"],"force":true})).toEqual({"name":"A","views":["icd"],"force":true});
  });
  it("views[]: nimmt testconcept an", () => {
    expect(S.parse({"name":"A","views":["testconcept"],"force":true})).toEqual({"name":"A","views":["testconcept"],"force":true});
  });
  it("views[]: nimmt testmatrix an", () => {
    expect(S.parse({"name":"A","views":["testmatrix"],"force":true})).toEqual({"name":"A","views":["testmatrix"],"force":true});
  });
  it("views[]: nimmt intplan an", () => {
    expect(S.parse({"name":"A","views":["intplan"],"force":true})).toEqual({"name":"A","views":["intplan"],"force":true});
  });
  it("views[]: nimmt changelog an", () => {
    expect(S.parse({"name":"A","views":["changelog"],"force":true})).toEqual({"name":"A","views":["changelog"],"force":true});
  });
  it("views[]: nimmt fmea an", () => {
    expect(S.parse({"name":"A","views":["fmea"],"force":true})).toEqual({"name":"A","views":["fmea"],"force":true});
  });
  it("views[]: nimmt conops an", () => {
    expect(S.parse({"name":"A","views":["conops"],"force":true})).toEqual({"name":"A","views":["conops"],"force":true});
  });
  it("views[]: nimmt implplan an", () => {
    expect(S.parse({"name":"A","views":["implplan"],"force":true})).toEqual({"name":"A","views":["implplan"],"force":true});
  });
  it("views[]: lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse({"name":"A","views":["__ausserhalb__"],"force":true}).success).toBe(false);
  });
  it("views: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"name":"A","views":[],"force":true})).toEqual({"name":"A","views":[],"force":true});
  });
  it("nimmt an ohne force (optional)", () => {
    expect(S.parse({"name":"A","views":["architecture"]})).toEqual({"name":"A","views":["architecture"],"force":false});
  });
  it("lehnt ab: force mit falschem Typ", () => {
    expect(S.safeParse({"name":"A","views":["architecture"],"force":"__falsch__"}).success).toBe(false);
  });
});
