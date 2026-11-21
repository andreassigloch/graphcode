// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-rewind-summary → src/surface/rewind.ts#RewindSummarySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RewindSummarySchema as S } from '../../src/surface/rewind.js';

describe('Vertrag SCHEMA-rewind-summary', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true})).toEqual({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne ref", () => {
    expect(S.safeParse({"commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab: ref mit falschem Typ", () => {
    expect(S.safeParse({"ref":12345,"commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab ohne commit", () => {
    expect(S.safeParse({"ref":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab: commit mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":12345,"snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab ohne snapshot", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab: snapshot mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":12345,"restored":{"nodes":1,"edges":1},"forced":true}).success).toBe(false);
  });
  it("lehnt ab ohne restored", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","forced":true}).success).toBe(false);
  });
  it("lehnt ab: restored mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":"__falsch__","forced":true}).success).toBe(false);
  });
  it("restored: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"edges":1},"forced":true}).success).toBe(false);
  });
  it("restored: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":"__falsch__","edges":1},"forced":true}).success).toBe(false);
  });
  it("restored: lehnt ab ohne edges", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1},"forced":true}).success).toBe(false);
  });
  it("restored: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":"__falsch__"},"forced":true}).success).toBe(false);
  });
  it("lehnt ab ohne forced", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1}}).success).toBe(false);
  });
  it("lehnt ab: forced mit falschem Typ", () => {
    expect(S.safeParse({"ref":"beispiel","commit":"beispiel","snapshot":"beispiel","restored":{"nodes":1,"edges":1},"forced":"__falsch__"}).success).toBe(false);
  });
});
