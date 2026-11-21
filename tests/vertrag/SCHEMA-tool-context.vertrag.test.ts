// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-tool-context → src/surface/tool-context-contract.ts#ToolContext. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ToolContext as S } from '../../src/surface/tool-context-contract.js';

const fn = (): number => 1;

describe('Vertrag SCHEMA-tool-context', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn})).toEqual({"harness":{},"auditLog":{"record":expect.any(Function),"query":expect.any(Function)},"graphVersion":expect.any(Function),"recordAudit":expect.any(Function),"recordPreview":expect.any(Function),"noteConsulted":expect.any(Function),"noteTemplateEdits":expect.any(Function),"classifyEditSource":expect.any(Function),"setOrigin":expect.any(Function),"sessionId":expect.any(Function),"ownerPid":expect.any(Function),"serializeToolWrite":expect.any(Function),"arbeitsmenge":expect.any(Function),"occReject":expect.any(Function)});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne harness", () => {
    expect(S.safeParse({"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: harness mit falschem Typ", () => {
    expect(S.safeParse({"harness":"__falsch__","auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("harness: nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"harness":{"__zusatz__":1},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn})).toEqual({"harness":{"__zusatz__":1},"auditLog":{"record":expect.any(Function),"query":expect.any(Function)},"graphVersion":expect.any(Function),"recordAudit":expect.any(Function),"recordPreview":expect.any(Function),"noteConsulted":expect.any(Function),"noteTemplateEdits":expect.any(Function),"classifyEditSource":expect.any(Function),"setOrigin":expect.any(Function),"sessionId":expect.any(Function),"ownerPid":expect.any(Function),"serializeToolWrite":expect.any(Function),"arbeitsmenge":expect.any(Function),"occReject":expect.any(Function)});
  });
  it("lehnt ab ohne auditLog", () => {
    expect(S.safeParse({"harness":{},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: auditLog mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":"__falsch__","graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("auditLog: lehnt ab ohne record", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("auditLog: lehnt ab: record mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":"__falsch__","query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("auditLog: lehnt ab ohne query", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("auditLog: lehnt ab: query mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":"__falsch__"},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("auditLog: nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"harness":{},"auditLog":{"record":fn,"query":fn,"__zusatz__":1},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn})).toEqual({"harness":{},"auditLog":{"record":expect.any(Function),"query":expect.any(Function),"__zusatz__":1},"graphVersion":expect.any(Function),"recordAudit":expect.any(Function),"recordPreview":expect.any(Function),"noteConsulted":expect.any(Function),"noteTemplateEdits":expect.any(Function),"classifyEditSource":expect.any(Function),"setOrigin":expect.any(Function),"sessionId":expect.any(Function),"ownerPid":expect.any(Function),"serializeToolWrite":expect.any(Function),"arbeitsmenge":expect.any(Function),"occReject":expect.any(Function)});
  });
  it("lehnt ab ohne graphVersion", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: graphVersion mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":"__falsch__","recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne recordAudit", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: recordAudit mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":"__falsch__","recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne recordPreview", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: recordPreview mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":"__falsch__","noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne noteConsulted", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: noteConsulted mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":"__falsch__","noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne noteTemplateEdits", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: noteTemplateEdits mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":"__falsch__","classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne classifyEditSource", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: classifyEditSource mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":"__falsch__","setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne setOrigin", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: setOrigin mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":"__falsch__","sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne sessionId", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: sessionId mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":"__falsch__","ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne ownerPid", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: ownerPid mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":"__falsch__","serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne serializeToolWrite", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: serializeToolWrite mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":"__falsch__","arbeitsmenge":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne arbeitsmenge", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"occReject":fn}).success).toBe(false);
  });
  it("lehnt ab: arbeitsmenge mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":"__falsch__","occReject":fn}).success).toBe(false);
  });
  it("lehnt ab ohne occReject", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn}).success).toBe(false);
  });
  it("lehnt ab: occReject mit falschem Typ", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":"__falsch__"}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"harness":{},"auditLog":{"record":fn,"query":fn},"graphVersion":fn,"recordAudit":fn,"recordPreview":fn,"noteConsulted":fn,"noteTemplateEdits":fn,"classifyEditSource":fn,"setOrigin":fn,"sessionId":fn,"ownerPid":fn,"serializeToolWrite":fn,"arbeitsmenge":fn,"occReject":fn,"__zusatz__":1}).success).toBe(false);
  });
});
