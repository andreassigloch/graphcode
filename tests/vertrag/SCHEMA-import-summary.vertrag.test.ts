// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-import-summary → src/surface/import-code-verb.ts#ImportCodeSummarySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ImportCodeSummarySchema as S } from '../../src/surface/import-code-verb.js';

describe('Vertrag SCHEMA-import-summary', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"})).toEqual({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne files", () => {
    expect(S.safeParse({"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: files mit falschem Typ", () => {
    expect(S.safeParse({"files":"__falsch__","extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne extracted", () => {
    expect(S.safeParse({"files":1,"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: extracted mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":"__falsch__","status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("extracted{}: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":"__falsch__"},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne status", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: status mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":12345,"applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: status außerhalb des Enums", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"__ausserhalb__","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne applied", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: applied mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":"__falsch__","violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("applied: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("applied: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":"__falsch__","edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("applied: lehnt ab ohne edges", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("applied: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":"__falsch__"},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne violations", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: violations mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":"__falsch__","backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":["__falsch__"],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne ruleId", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: ruleId mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":12345,"severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne severity", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":12345,"elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: severity außerhalb des Enums", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"__ausserhalb__","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne elementId", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: elementId mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":12345,"message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab ohne message", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: message mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":12345,"fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("violations[]: lehnt ab: fixHint mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":12345}],"backupPath":"beispiel","exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: backupPath mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":12345,"exportPath":"beispiel","exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: exportPath mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":12345,"exportError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: exportError mit falschem Typ", () => {
    expect(S.safeParse({"files":1,"extracted":{"beispiel":1},"status":"success","applied":{"nodes":0,"edges":0},"violations":[{"ruleId":"beispiel","severity":"error","elementId":"beispiel","message":"beispiel","fixHint":"beispiel"}],"backupPath":"beispiel","exportPath":"beispiel","exportError":12345}).success).toBe(false);
  });
});
