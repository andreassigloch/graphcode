// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-grenz-befund → src/kernel/measure/constraints.ts#GrenzBefund. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GrenzBefund as S } from '../../src/kernel/measure/constraints.js';

describe('Vertrag SCHEMA-grenz-befund', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":["beispiel"]}]})).toEqual({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":["beispiel"]}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne ohneSchema", () => {
    expect(S.safeParse({}).success).toBe(false);
  });
  it("lehnt ab: ohneSchema mit falschem Typ", () => {
    expect(S.safeParse({"ohneSchema":"__falsch__"}).success).toBe(false);
  });
  it("ohneSchema[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"ohneSchema":["__falsch__"]}).success).toBe(false);
  });
  it("ohneSchema[]: lehnt ab ohne fluss", () => {
    expect(S.safeParse({"ohneSchema":[{"module":["beispiel"],"schemas":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[]: lehnt ab: fluss mit falschem Typ", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":12345,"module":["beispiel"],"schemas":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[].fluss: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"","module":["beispiel"],"schemas":["beispiel"]}]})).toEqual({"ohneSchema":[{"fluss":"","module":["beispiel"],"schemas":["beispiel"]}]});
  });
  it("ohneSchema[]: lehnt ab ohne module", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","schemas":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[]: lehnt ab: module mit falschem Typ", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":"__falsch__","schemas":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[].module[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":[12345],"schemas":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[].module[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"beispiel","module":[""],"schemas":["beispiel"]}]})).toEqual({"ohneSchema":[{"fluss":"beispiel","module":[""],"schemas":["beispiel"]}]});
  });
  it("ohneSchema[].module: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"beispiel","module":[],"schemas":["beispiel"]}]})).toEqual({"ohneSchema":[{"fluss":"beispiel","module":[],"schemas":["beispiel"]}]});
  });
  it("ohneSchema[]: lehnt ab ohne schemas", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"]}]}).success).toBe(false);
  });
  it("ohneSchema[]: lehnt ab: schemas mit falschem Typ", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":"__falsch__"}]}).success).toBe(false);
  });
  it("ohneSchema[].schemas[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":[12345]}]}).success).toBe(false);
  });
  it("ohneSchema[].schemas[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":[""]}]})).toEqual({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":[""]}]});
  });
  it("ohneSchema[].schemas: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":[]}]})).toEqual({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":[]}]});
  });
  it("ohneSchema[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":["beispiel"],"__zusatz__":1}]}).success).toBe(false);
  });
  it("ohneSchema: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ohneSchema":[]})).toEqual({"ohneSchema":[]});
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ohneSchema":[{"fluss":"beispiel","module":["beispiel"],"schemas":["beispiel"]}],"__zusatz__":1}).success).toBe(false);
  });
});
