// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-mcp-tool → src/kernel/tool-contract.ts#MCPToolSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { MCPToolSchema as S } from '../../src/kernel/tool-contract.js';

const fn = (): number => 1;

describe('Vertrag SCHEMA-mcp-tool', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":fn},"handler":fn})).toEqual({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":expect.any(Function)},"handler":expect.any(Function)});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne name", () => {
    expect(S.safeParse({"description":"beispiel","inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"name":12345,"description":"beispiel","inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("name: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"name":"","description":"beispiel","inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("name: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"name":"x","description":"beispiel","inputSchema":{"safeParse":fn},"handler":fn})).toEqual({"name":"x","description":"beispiel","inputSchema":{"safeParse":expect.any(Function)},"handler":expect.any(Function)});
  });
  it("lehnt ab ohne description", () => {
    expect(S.safeParse({"name":"beispiel","inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":12345,"inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("description: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"name":"beispiel","description":"","inputSchema":{"safeParse":fn},"handler":fn}).success).toBe(false);
  });
  it("description: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"name":"beispiel","description":"x","inputSchema":{"safeParse":fn},"handler":fn})).toEqual({"name":"beispiel","description":"x","inputSchema":{"safeParse":expect.any(Function)},"handler":expect.any(Function)});
  });
  it("lehnt ab ohne inputSchema", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","handler":fn}).success).toBe(false);
  });
  it("lehnt ab: inputSchema mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","inputSchema":"__falsch__","handler":fn}).success).toBe(false);
  });
  it("inputSchema: lehnt ab ohne safeParse", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","inputSchema":{},"handler":fn}).success).toBe(false);
  });
  it("inputSchema: lehnt ab: safeParse mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":"__falsch__"},"handler":fn}).success).toBe(false);
  });
  it("inputSchema: nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":fn,"__zusatz__":1},"handler":fn})).toEqual({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":expect.any(Function),"__zusatz__":1},"handler":expect.any(Function)});
  });
  it("lehnt ab ohne handler", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":fn}}).success).toBe(false);
  });
  it("lehnt ab: handler mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","inputSchema":{"safeParse":fn},"handler":"__falsch__"}).success).toBe(false);
  });
});
