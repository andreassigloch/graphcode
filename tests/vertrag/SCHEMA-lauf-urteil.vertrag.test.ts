// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-lauf-urteil → src/projections/test-schlupf.ts#LaufUrteilSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { LaufUrteilSchema as S } from '../../src/projections/test-schlupf.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-lauf-urteil', () => {
  it("Variante 1: nimmt das Beispiel an", () => {
    expect(S.parse({"beleg":true,"rot":["beispiel"],"gesamt":1})).toEqual({"beleg":true,"rot":["beispiel"],"gesamt":1});
  });
  it("Variante 1: lehnt ab ohne beleg", () => {
    expect(S.safeParse({"rot":["beispiel"],"gesamt":1}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: beleg mit falschem Typ", () => {
    expect(S.safeParse({"beleg":"__falsch__","rot":["beispiel"],"gesamt":1}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: beleg außerhalb des Enums", () => {
    expect(S.safeParse({"beleg":"__ausserhalb__","rot":["beispiel"],"gesamt":1}).success).toBe(false);
  });
  it("Variante 1.beleg: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",0],["shape","beleg"]])._zod.def.values as Record<string, unknown>)).toEqual([true]);
  });
  it("Variante 1: lehnt ab ohne rot", () => {
    expect(S.safeParse({"beleg":true,"gesamt":1}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: rot mit falschem Typ", () => {
    expect(S.safeParse({"beleg":true,"rot":"__falsch__","gesamt":1}).success).toBe(false);
  });
  it("Variante 1.rot[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"beleg":true,"rot":[12345],"gesamt":1}).success).toBe(false);
  });
  it("Variante 1.rot[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"beleg":true,"rot":[""],"gesamt":1})).toEqual({"beleg":true,"rot":[""],"gesamt":1});
  });
  it("Variante 1.rot: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"beleg":true,"rot":[],"gesamt":1})).toEqual({"beleg":true,"rot":[],"gesamt":1});
  });
  it("Variante 1: lehnt ab ohne gesamt", () => {
    expect(S.safeParse({"beleg":true,"rot":["beispiel"]}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: gesamt mit falschem Typ", () => {
    expect(S.safeParse({"beleg":true,"rot":["beispiel"],"gesamt":"__falsch__"}).success).toBe(false);
  });
  it("Variante 2: nimmt das Beispiel an", () => {
    expect(S.parse({"beleg":false,"grund":"beispiel"})).toEqual({"beleg":false,"grund":"beispiel"});
  });
  it("Variante 2: lehnt ab ohne beleg", () => {
    expect(S.safeParse({"grund":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: beleg mit falschem Typ", () => {
    expect(S.safeParse({"beleg":"__falsch__","grund":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: beleg außerhalb des Enums", () => {
    expect(S.safeParse({"beleg":"__ausserhalb__","grund":"beispiel"}).success).toBe(false);
  });
  it("Variante 2.beleg: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",1],["shape","beleg"]])._zod.def.values as Record<string, unknown>)).toEqual([false]);
  });
  it("Variante 2: lehnt ab ohne grund", () => {
    expect(S.safeParse({"beleg":false}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: grund mit falschem Typ", () => {
    expect(S.safeParse({"beleg":false,"grund":12345}).success).toBe(false);
  });
  it("Variante 2.grund: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"beleg":false,"grund":""})).toEqual({"beleg":false,"grund":""});
  });
});
