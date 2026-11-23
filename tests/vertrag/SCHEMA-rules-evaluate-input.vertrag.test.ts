// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-rules-evaluate-input → src/projections/report.ts#RulesEvaluateInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RulesEvaluateInputSchema as S } from '../../src/projections/report.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-rules-evaluate-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"detail":"summary"})).toEqual({"detail":"summary"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne detail (optional)", () => {
    expect(S.parse({})).toEqual({"detail":"full"});
  });
  it("lehnt ab: detail mit falschem Typ", () => {
    expect(S.safeParse({"detail":12345}).success).toBe(false);
  });
  it("lehnt ab: detail außerhalb des Enums", () => {
    expect(S.safeParse({"detail":"__ausserhalb__"}).success).toBe(false);
  });
  it("detail: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","detail"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["summary","full","grouped"]);
  });
});
