// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-completeness → packages/graphcode-client/src/readiness.ts#ReadinessMarkSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ReadinessMarkSchema as S } from '@sigloch/graphcode-client';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-completeness', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne id", () => {
    expect(S.safeParse({"label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"id":12345,"label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: id außerhalb des Enums", () => {
    expect(S.safeParse({"id":"__ausserhalb__","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("id: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","id"]])._zod.def.entries as Record<string, unknown>)).toEqual(["SRR","PDR","CDR","TRR","Bau"]);
  });
  it("lehnt ab ohne label", () => {
    expect(S.safeParse({"id":"SRR","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: label mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":12345,"reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("label: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("lehnt ab ohne reached", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: reached mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":"__falsch__","holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab ohne holding", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true}).success).toBe(false);
  });
  it("lehnt ab: holding mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":"__falsch__"}).success).toBe(false);
  });
  it("holding[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":["__falsch__"]}).success).toBe(false);
  });
  it("holding[]: lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[]: lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":12345,"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[].ruleId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("holding[]: lehnt ab ohne severity", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[]: lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[]: lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[].severity: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","holding"],["element"],["shape","severity"]])._zod.def.entries as Record<string, unknown>)).toEqual(["error","warning","info"]);
  });
  it("holding[]: lehnt ab ohne message", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[]: lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[].message: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("holding[]: nimmt an ohne elementId (optional)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("holding[]: lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[].elementId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}]});
  });
  it("holding[]: nimmt an ohne fixHint (optional)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}]});
  });
  it("holding[]: lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}]}).success).toBe(false);
  });
  it("holding[].fixHint: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}]});
  });
  it("holding[]: nimmt an ohne context (optional)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}]});
  });
  it("holding: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"id":"SRR","label":"beispiel","reached":true,"holding":[]})).toEqual({"id":"SRR","label":"beispiel","reached":true,"holding":[]});
  });
});
