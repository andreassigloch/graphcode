// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-audit-stats-input → src/surface/audit.ts#AuditStatsInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { AuditStatsInputSchema as S } from '../../src/surface/audit.js';

describe('Vertrag SCHEMA-audit-stats-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"since":"beispiel","consumerId":"beispiel"})).toEqual({"since":"beispiel","consumerId":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne since (optional)", () => {
    expect(S.parse({"consumerId":"beispiel"})).toEqual({"consumerId":"beispiel"});
  });
  it("lehnt ab: since mit falschem Typ", () => {
    expect(S.safeParse({"since":12345,"consumerId":"beispiel"}).success).toBe(false);
  });
  it("since: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"since":"","consumerId":"beispiel"})).toEqual({"since":"","consumerId":"beispiel"});
  });
  it("nimmt an ohne consumerId (optional)", () => {
    expect(S.parse({"since":"beispiel"})).toEqual({"since":"beispiel"});
  });
  it("lehnt ab: consumerId mit falschem Typ", () => {
    expect(S.safeParse({"since":"beispiel","consumerId":12345}).success).toBe(false);
  });
  it("consumerId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"since":"beispiel","consumerId":""})).toEqual({"since":"beispiel","consumerId":""});
  });
});
