// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-impacted-tests → src/kernel/measure/test-selection.ts#TestImpactResultSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TestImpactResultSchema as S } from '../../src/kernel/measure/test-selection.js';

describe('Vertrag SCHEMA-impacted-tests', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]})).toEqual({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne nodes", () => {
    expect(S.safeParse({"edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"nodes":"__falsch__","edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("nodes: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"nodes":[],"edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]})).toEqual({"nodes":[],"edges":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]});
  });
  it("lehnt ab ohne edges", () => {
    expect(S.safeParse({"nodes":["beliebig"],"anchors":["beispiel"],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":"__falsch__","anchors":["beispiel"],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("edges: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":[],"anchors":["beispiel"],"testIds":["beispiel"]})).toEqual({"nodes":["beliebig"],"edges":[],"anchors":["beispiel"],"testIds":["beispiel"]});
  });
  it("lehnt ab ohne anchors", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: anchors mit falschem Typ", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":"__falsch__","testIds":["beispiel"]}).success).toBe(false);
  });
  it("anchors[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":[12345],"testIds":["beispiel"]}).success).toBe(false);
  });
  it("anchors[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":[""],"testIds":["beispiel"]})).toEqual({"nodes":["beliebig"],"edges":["beliebig"],"anchors":[""],"testIds":["beispiel"]});
  });
  it("anchors: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":[],"testIds":["beispiel"]})).toEqual({"nodes":["beliebig"],"edges":["beliebig"],"anchors":[],"testIds":["beispiel"]});
  });
  it("lehnt ab ohne testIds", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: testIds mit falschem Typ", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":"__falsch__"}).success).toBe(false);
  });
  it("testIds[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":[12345]}).success).toBe(false);
  });
  it("testIds[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":[""]})).toEqual({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":[""]});
  });
  it("testIds: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":[]})).toEqual({"nodes":["beliebig"],"edges":["beliebig"],"anchors":["beispiel"],"testIds":[]});
  });
});
