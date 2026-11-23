// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-reseed-input → src/surface/write.ts#GraphReseedInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphReseedInputSchema as S } from '../../src/surface/write.js';

describe('Vertrag SCHEMA-reseed-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"path":"beispiel"})).toEqual({"path":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne path (optional)", () => {
    expect(S.parse({})).toEqual({});
  });
  it("lehnt ab: path mit falschem Typ", () => {
    expect(S.safeParse({"path":12345}).success).toBe(false);
  });
  it("path: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"path":""})).toEqual({"path":""});
  });
});
