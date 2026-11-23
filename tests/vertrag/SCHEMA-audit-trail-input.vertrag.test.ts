// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-audit-trail-input → src/surface/audit.ts#AuditTrailInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { AuditTrailInputSchema as S } from '../../src/surface/audit.js';

describe('Vertrag SCHEMA-audit-trail-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne consumerId (optional)", () => {
    expect(S.parse({"since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("lehnt ab: consumerId mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":12345,"since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("consumerId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"consumerId":"","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("nimmt an ohne since (optional)", () => {
    expect(S.parse({"consumerId":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("lehnt ab: since mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":12345,"limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("since: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("nimmt an ohne limit (optional)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":50,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("lehnt ab: limit mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":"__falsch__","includeRulesPassed":true,"includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("limit: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":0,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("limit: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true});
  });
  it("limit: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":1.5,"includeRulesPassed":true,"includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("nimmt an ohne includeRulesPassed (optional)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeCommands":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":false,"includeCommands":true,"includeIntent":true});
  });
  it("lehnt ab: includeRulesPassed mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":"__falsch__","includeCommands":true,"includeIntent":true}).success).toBe(false);
  });
  it("nimmt an ohne includeCommands (optional)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeIntent":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":false,"includeIntent":true});
  });
  it("lehnt ab: includeCommands mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":"__falsch__","includeIntent":true}).success).toBe(false);
  });
  it("nimmt an ohne includeIntent (optional)", () => {
    expect(S.parse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true})).toEqual({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":false});
  });
  it("lehnt ab: includeIntent mit falschem Typ", () => {
    expect(S.safeParse({"consumerId":"beispiel","since":"beispiel","limit":1,"includeRulesPassed":true,"includeCommands":true,"includeIntent":"__falsch__"}).success).toBe(false);
  });
});
