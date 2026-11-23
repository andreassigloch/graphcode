// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-context-input → src/surface/read.ts#GraphContextInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphContextInputSchema as S } from '../../src/surface/read.js';

describe('Vertrag SCHEMA-context-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"id":"beispiel","depth":1})).toEqual({"id":"beispiel","depth":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne id", () => {
    expect(S.safeParse({"depth":1}).success).toBe(false);
  });
  it("lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"id":12345,"depth":1}).success).toBe(false);
  });
  it("id: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"","depth":1})).toEqual({"id":"","depth":1});
  });
  it("nimmt an ohne depth (optional)", () => {
    expect(S.parse({"id":"beispiel"})).toEqual({"id":"beispiel","depth":1});
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"id":"beispiel","depth":"__falsch__"}).success).toBe(false);
  });
  it("depth: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"id":"beispiel","depth":0}).success).toBe(false);
  });
  it("depth: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"id":"beispiel","depth":1})).toEqual({"id":"beispiel","depth":1});
  });
  it("depth: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"id":"beispiel","depth":1.5}).success).toBe(false);
  });
});
