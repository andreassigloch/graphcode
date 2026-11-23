// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-tests-input → src/projections/report.ts#GraphTestsInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphTestsInputSchema as S } from '../../src/projections/report.js';

describe('Vertrag SCHEMA-tests-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"changeSet":["beispiel"],"depth":0})).toEqual({"changeSet":["beispiel"],"depth":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne changeSet", () => {
    expect(S.safeParse({"depth":0}).success).toBe(false);
  });
  it("lehnt ab: changeSet mit falschem Typ", () => {
    expect(S.safeParse({"changeSet":"__falsch__","depth":0}).success).toBe(false);
  });
  it("changeSet[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"changeSet":[12345],"depth":0}).success).toBe(false);
  });
  it("changeSet[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"changeSet":[""],"depth":0})).toEqual({"changeSet":[""],"depth":0});
  });
  it("changeSet: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"changeSet":[],"depth":0}).success).toBe(false);
  });
  it("changeSet: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"changeSet":["beispiel"],"depth":0})).toEqual({"changeSet":["beispiel"],"depth":0});
  });
  it("nimmt an ohne depth (optional)", () => {
    expect(S.parse({"changeSet":["beispiel"]})).toEqual({"changeSet":["beispiel"],"depth":1});
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"changeSet":["beispiel"],"depth":"__falsch__"}).success).toBe(false);
  });
  it("depth: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"changeSet":["beispiel"],"depth":-1}).success).toBe(false);
  });
  it("depth: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"changeSet":["beispiel"],"depth":0})).toEqual({"changeSet":["beispiel"],"depth":0});
  });
  it("depth: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"changeSet":["beispiel"],"depth":0.5}).success).toBe(false);
  });
});
