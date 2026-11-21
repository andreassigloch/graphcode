// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-test-ingest-answer → src/projections/testreport.ts#GraphTestIngestAnswerSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphTestIngestAnswerSchema as S } from '../../src/projections/testreport.js';

describe('Vertrag SCHEMA-test-ingest-answer', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0})).toEqual({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0});
  });
  it("lehnt ab ohne applied", () => {
    expect(S.safeParse({"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: applied mit falschem Typ", () => {
    expect(S.safeParse({"applied":"__falsch__","assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne assignments", () => {
    expect(S.safeParse({"applied":0,"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: assignments mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":"__falsch__","bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne bindings", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: bindings mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":"__falsch__","unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne unresolved", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: unresolved mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":"__falsch__","withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne withdrawn", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: withdrawn mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":"__falsch__","success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne success", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: success mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":"__falsch__","tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: tier mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":12345,"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: tier außerhalb des Enums", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"__ausserhalb__","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne violations", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: violations mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":"__falsch__","graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne graphVersion", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: graphVersion mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":"__falsch__"}).success).toBe(false);
  });
});
