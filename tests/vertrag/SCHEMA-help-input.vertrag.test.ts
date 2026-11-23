// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-help-input → src/projections/report.ts#GraphHelpInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphHelpInputSchema as S } from '../../src/projections/report.js';

describe('Vertrag SCHEMA-help-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"token":"beispiel"})).toEqual({"token":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne token", () => {
    expect(S.safeParse({}).success).toBe(false);
  });
  it("lehnt ab: token mit falschem Typ", () => {
    expect(S.safeParse({"token":12345}).success).toBe(false);
  });
  it("token: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"token":""})).toEqual({"token":""});
  });
});
