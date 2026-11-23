// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-metrics-input → src/projections/metrics.ts#GraphMetricsInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphMetricsInputSchema as S } from '../../src/projections/metrics.js';

describe('Vertrag SCHEMA-metrics-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"scope":["beispiel"],"constraintCarriers":true})).toEqual({"scope":["beispiel"],"constraintCarriers":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne scope (optional)", () => {
    expect(S.parse({"constraintCarriers":true})).toEqual({"constraintCarriers":true});
  });
  it("lehnt ab: scope mit falschem Typ", () => {
    expect(S.safeParse({"scope":"__falsch__","constraintCarriers":true}).success).toBe(false);
  });
  it("scope[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"scope":[12345],"constraintCarriers":true}).success).toBe(false);
  });
  it("scope[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"scope":[""],"constraintCarriers":true})).toEqual({"scope":[""],"constraintCarriers":true});
  });
  it("scope: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"scope":[],"constraintCarriers":true}).success).toBe(false);
  });
  it("scope: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"scope":["beispiel"],"constraintCarriers":true})).toEqual({"scope":["beispiel"],"constraintCarriers":true});
  });
  it("nimmt an ohne constraintCarriers (optional)", () => {
    expect(S.parse({"scope":["beispiel"]})).toEqual({"scope":["beispiel"]});
  });
  it("lehnt ab: constraintCarriers mit falschem Typ", () => {
    expect(S.safeParse({"scope":["beispiel"],"constraintCarriers":"__falsch__"}).success).toBe(false);
  });
  it("nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"scope":["beispiel"],"constraintCarriers":true,"__zusatz__":1})).toEqual({"scope":["beispiel"],"constraintCarriers":true,"__zusatz__":1});
  });
});
