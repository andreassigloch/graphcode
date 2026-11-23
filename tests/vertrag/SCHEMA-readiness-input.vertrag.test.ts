// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-readiness-input → src/projections/report.ts#GraphReadinessInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphReadinessInputSchema as S } from '../../src/projections/report.js';

describe('Vertrag SCHEMA-readiness-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"detail":true,"verlauf":1})).toEqual({"detail":true,"verlauf":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne detail (optional)", () => {
    expect(S.parse({"verlauf":1})).toEqual({"detail":false,"verlauf":1});
  });
  it("lehnt ab: detail mit falschem Typ", () => {
    expect(S.safeParse({"detail":"__falsch__","verlauf":1}).success).toBe(false);
  });
  it("nimmt an ohne verlauf (optional)", () => {
    expect(S.parse({"detail":true})).toEqual({"detail":true});
  });
  it("lehnt ab: verlauf mit falschem Typ", () => {
    expect(S.safeParse({"detail":true,"verlauf":"__falsch__"}).success).toBe(false);
  });
  it("verlauf: lehnt ab: 0 unter der Untergrenze 1", () => {
    expect(S.safeParse({"detail":true,"verlauf":0}).success).toBe(false);
  });
  it("verlauf: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 1)", () => {
    expect(S.parse({"detail":true,"verlauf":1})).toEqual({"detail":true,"verlauf":1});
  });
  it("verlauf: lehnt ab: 1001 über der Obergrenze 1000", () => {
    expect(S.safeParse({"detail":true,"verlauf":1001}).success).toBe(false);
  });
  it("verlauf: nimmt 1000 an (größter erlaubter Wert, Obergrenze 1000)", () => {
    expect(S.parse({"detail":true,"verlauf":1000})).toEqual({"detail":true,"verlauf":1000});
  });
  it("verlauf: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"detail":true,"verlauf":1.5}).success).toBe(false);
  });
});
