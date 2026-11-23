// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-authoring-guide-input → src/projections/report.ts#GraphAuthoringGuideInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphAuthoringGuideInputSchema as S } from '../../src/projections/report.js';

describe('Vertrag SCHEMA-authoring-guide-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"type":"beispiel"})).toEqual({"type":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne type", () => {
    expect(S.safeParse({}).success).toBe(false);
  });
  it("lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"type":12345}).success).toBe(false);
  });
  it("type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"type":""})).toEqual({"type":""});
  });
});
