// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-impact-input → src/surface/read.ts#GraphImpactInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphImpactInputSchema as S } from '../../src/surface/read.js';

describe('Vertrag SCHEMA-impact-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"id":"beispiel","depth":0})).toEqual({"id":"beispiel","depth":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne id", () => {
    expect(S.safeParse({"depth":0}).success).toBe(false);
  });
  it("lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"id":12345,"depth":0}).success).toBe(false);
  });
  it("id: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"","depth":0})).toEqual({"id":"","depth":0});
  });
  it("nimmt an ohne depth (optional)", () => {
    expect(S.parse({"id":"beispiel"})).toEqual({"id":"beispiel","depth":1});
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"id":"beispiel","depth":"__falsch__"}).success).toBe(false);
  });
  it("depth: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"id":"beispiel","depth":-1}).success).toBe(false);
  });
  it("depth: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"id":"beispiel","depth":0})).toEqual({"id":"beispiel","depth":0});
  });
  it("depth: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"id":"beispiel","depth":0.5}).success).toBe(false);
  });
});
