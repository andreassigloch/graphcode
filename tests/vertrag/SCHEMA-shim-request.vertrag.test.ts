// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-shim-request → packages/graphcode-client/src/host-client.ts#ShimRequestSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ShimRequestSchema as S } from '@sigloch/graphcode-client';

describe('Vertrag SCHEMA-shim-request', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"id":1,"tool":"beispiel","input":"beliebig"})).toEqual({"id":1,"tool":"beispiel","input":"beliebig"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne id", () => {
    expect(S.safeParse({"tool":"beispiel","input":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"id":"__falsch__","tool":"beispiel","input":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab ohne tool", () => {
    expect(S.safeParse({"id":1,"input":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: tool mit falschem Typ", () => {
    expect(S.safeParse({"id":1,"tool":12345,"input":"beliebig"}).success).toBe(false);
  });
  it("tool: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":1,"tool":"","input":"beliebig"})).toEqual({"id":1,"tool":"","input":"beliebig"});
  });
  it("nimmt an ohne input (optional)", () => {
    expect(S.parse({"id":1,"tool":"beispiel"})).toEqual({"id":1,"tool":"beispiel"});
  });
});
