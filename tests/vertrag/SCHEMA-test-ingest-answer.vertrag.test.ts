// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-test-ingest-answer → src/projections/testreport.ts#GraphTestIngestAnswerSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphTestIngestAnswerSchema as S } from '../../src/projections/testreport.js';

describe('Vertrag SCHEMA-test-ingest-answer', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0})).toEqual({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
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
  it("assignments[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"applied":0,"assignments":["__falsch__"],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab ohne testUid", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab: testUid mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":12345,"file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab ohne file", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":12345,"result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab ohne result", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":12345,"evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab: result außerhalb des Enums", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"__ausserhalb__","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("assignments[]: lehnt ab: evidence mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":12345}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne bindings", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: bindings mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":"__falsch__","unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":["__falsch__"],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab ohne testUid", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: testUid mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":12345,"file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab ohne file", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":12345,"result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab ohne result", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":12345,"evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: result außerhalb des Enums", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"__ausserhalb__","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: evidence mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":12345,"tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab ohne tool", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("bindings[]: lehnt ab: tool mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":12345}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne unresolved", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: unresolved mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":"__falsch__","withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("unresolved[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":["__falsch__"],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("unresolved[]: lehnt ab ohne file", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("unresolved[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":12345,"reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("unresolved[]: lehnt ab ohne reason", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("unresolved[]: lehnt ab: reason mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":12345}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne withdrawn", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab: withdrawn mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":"__falsch__","success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("withdrawn[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":["__falsch__"],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("withdrawn[]: lehnt ab ohne testUid", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("withdrawn[]: lehnt ab: testUid mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":12345,"file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("withdrawn[]: lehnt ab ohne file", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("withdrawn[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":12345}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
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
  it("violations[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":["__falsch__"],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":12345,"severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne severity", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":12345,"message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"__ausserhalb__","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne message", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":12345,"elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":12345,"fixHint":"beispiel","context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("violations[]: lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":12345,"context":"beliebig"}],"graphVersion":0}).success).toBe(false);
  });
  it("lehnt ab ohne graphVersion", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}]}).success).toBe(false);
  });
  it("lehnt ab: graphVersion mit falschem Typ", () => {
    expect(S.safeParse({"applied":0,"assignments":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel"}],"bindings":[{"testUid":"beispiel","file":"beispiel","result":"passed","evidence":"beispiel","tool":"beispiel"}],"unresolved":[{"file":"beispiel","reason":"beispiel"}],"withdrawn":[{"testUid":"beispiel","file":"beispiel"}],"success":true,"tier":"auto-apply","violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","elementId":"beispiel","fixHint":"beispiel","context":"beliebig"}],"graphVersion":"__falsch__"}).success).toBe(false);
  });
});
