// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-fit-advisory → src/kernel/measure/fit-advisory.ts#FitAdvisory. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { FitAdvisory as S } from '../../src/kernel/measure/fit-advisory.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-fit-advisory', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne layer", () => {
    expect(S.safeParse({"dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: layer mit falschem Typ", () => {
    expect(S.safeParse({"layer":12345,"dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: layer außerhalb des Enums", () => {
    expect(S.safeParse({"layer":"__ausserhalb__","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("layer: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","layer"]])._zod.def.values as Record<string, unknown>)).toEqual(["arch"]);
  });
  it("lehnt ab ohne dimensions", () => {
    expect(S.safeParse({"layer":"arch","before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: dimensions mit falschem Typ", () => {
    expect(S.safeParse({"layer":"arch","dimensions":"__falsch__","before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("dimensions[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"layer":"arch","dimensions":[12345],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("dimensions[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":[""],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":[""],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]});
  });
  it("dimensions: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":[],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":[],"before":[1],"after":[1],"delta":[1],"regressions":["beispiel"]});
  });
  it("lehnt ab ohne before", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: before mit falschem Typ", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":"__falsch__","after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("before[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":["__falsch__"],"after":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("before: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[],"after":[1],"delta":[1],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[],"after":[1],"delta":[1],"regressions":["beispiel"]});
  });
  it("lehnt ab ohne after", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: after mit falschem Typ", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":"__falsch__","delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("after[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":["__falsch__"],"delta":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("after: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[],"delta":[1],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[],"delta":[1],"regressions":["beispiel"]});
  });
  it("lehnt ab ohne delta", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: delta mit falschem Typ", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":"__falsch__","regressions":["beispiel"]}).success).toBe(false);
  });
  it("delta[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":["__falsch__"],"regressions":["beispiel"]}).success).toBe(false);
  });
  it("delta: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[],"regressions":["beispiel"]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[],"regressions":["beispiel"]});
  });
  it("lehnt ab ohne regressions", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1]}).success).toBe(false);
  });
  it("lehnt ab: regressions mit falschem Typ", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":"__falsch__"}).success).toBe(false);
  });
  it("regressions[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":[12345]}).success).toBe(false);
  });
  it("regressions[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":[""]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":[""]});
  });
  it("regressions: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":[]})).toEqual({"layer":"arch","dimensions":["beispiel"],"before":[1],"after":[1],"delta":[1],"regressions":[]});
  });
});
