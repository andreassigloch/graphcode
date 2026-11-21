// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-rule-violation → packages/contracts/src/harness/index.ts#RuleViolationSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RuleViolationSchema as S } from '@sigloch/contracts/harness';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-rule-violation', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":12345,"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("ruleId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"})).toEqual({"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"});
  });
  it("lehnt ab ohne severity", () => {
    expect(S.safeParse({"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("severity: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","severity"]])._zod.def.entries as Record<string, unknown>)).toEqual(["error","warning","info"]);
  });
  it("lehnt ab ohne message", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("message: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"});
  });
  it("nimmt an ohne elementId (optional)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"});
  });
  it("lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("elementId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"});
  });
  it("nimmt an ohne fixHint (optional)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"});
  });
  it("lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}).success).toBe(false);
  });
  it("fixHint: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"});
  });
  it("nimmt an ohne context (optional)", () => {
    expect(S.parse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"})).toEqual({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"});
  });
});
