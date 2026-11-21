// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-rule-violation → packages/contracts/src/harness/index.ts#RuleViolationSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RuleViolationSchema as S } from '@sigloch/contracts/harness';

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
  it("lehnt ab ohne severity", () => {
    expect(S.safeParse({"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab ohne message", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}).success).toBe(false);
  });
  it("lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}).success).toBe(false);
  });
});
