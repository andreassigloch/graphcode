// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-get-node-input → src/surface/read.ts#GraphGetNodeInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphGetNodeInputSchema as S } from '../../src/surface/read.js';

describe('Vertrag SCHEMA-get-node-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"uid":"beispiel"})).toEqual({"uid":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne uid", () => {
    expect(S.safeParse({}).success).toBe(false);
  });
  it("lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"uid":12345}).success).toBe(false);
  });
  it("uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"uid":""})).toEqual({"uid":""});
  });
});
