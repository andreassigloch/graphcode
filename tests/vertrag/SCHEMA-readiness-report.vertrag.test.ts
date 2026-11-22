// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-readiness-report → packages/graphcode-client/src/readiness.ts#ReadinessReportSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ReadinessReportSchema as S } from '@sigloch/graphcode-client';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-readiness-report', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne incoseScope", () => {
    expect(S.safeParse({"marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: incoseScope mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":12345,"marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: incoseScope außerhalb des Enums", () => {
    expect(S.safeParse({"incoseScope":"__ausserhalb__","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("incoseScope: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","incoseScope"]])._zod.def.entries as Record<string, unknown>)).toEqual(["lean","full"]);
  });
  it("lehnt ab ohne marks", () => {
    expect(S.safeParse({"incoseScope":"lean","violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: marks mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":"__falsch__","violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":["__falsch__"],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab ohne id", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":12345,"label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab: id außerhalb des Enums", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"__ausserhalb__","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].id: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","marks"],["element"],["shape","id"]])._zod.def.entries as Record<string, unknown>)).toEqual(["SRR","PDR","CDR","TRR","Bau"]);
  });
  it("marks[]: lehnt ab ohne label", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab: label mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":12345,"reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].label: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[]: lehnt ab ohne reached", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab: reached mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":"__falsch__","holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab ohne holding", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[]: lehnt ab: holding mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":"__falsch__"}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":["__falsch__"]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":12345,"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[].ruleId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: lehnt ab ohne severity", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[].severity: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","marks"],["element"],["shape","holding"],["element"],["shape","severity"]])._zod.def.entries as Record<string, unknown>)).toEqual(["error","warning","info"]);
  });
  it("marks[].holding[]: lehnt ab ohne message", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[]: lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[].message: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: nimmt an ohne elementId (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[].elementId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: nimmt an ohne fixHint (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("marks[].holding[].fixHint: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding[]: nimmt an ohne context (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks[].holding: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("marks: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("lehnt ab ohne violationsByRule", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: violationsByRule mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":"__falsch__","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violationsByRule: nimmt einen leeren Record an", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violationsByRule{}: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":"__falsch__"},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne violations", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"computedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: violations mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":"__falsch__","computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":["__falsch__"],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":12345,"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[].ruleId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: lehnt ab ohne severity", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[].severity: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","violations"],["element"],["shape","severity"]])._zod.def.entries as Record<string, unknown>)).toEqual(["error","warning","info"]);
  });
  it("violations[]: lehnt ab ohne message", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[].message: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: nimmt an ohne elementId (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[].elementId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"","fixHint":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: nimmt an ohne fixHint (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}],"computedAt":"beispiel"}).success).toBe(false);
  });
  it("violations[].fixHint: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"","context":"beliebig"}],"computedAt":"beispiel"});
  });
  it("violations[]: nimmt an ohne context (optional)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel"}],"computedAt":"beispiel"});
  });
  it("violations: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[],"computedAt":"beispiel"})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[],"computedAt":"beispiel"});
  });
  it("lehnt ab ohne computedAt", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: computedAt mit falschem Typ", () => {
    expect(S.safeParse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":12345}).success).toBe(false);
  });
  it("computedAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":""})).toEqual({"incoseScope":"lean","marks":[{"id":"SRR","label":"beispiel","reached":true,"holding":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}],"violationsByRule":{"beispiel":1},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"computedAt":""});
  });
});
