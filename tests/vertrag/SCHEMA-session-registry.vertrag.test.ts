// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-session-registry → src/surface/gve-session-contract.ts#SessionEntrySchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SessionEntrySchema as S } from '../../src/surface/gve-session-contract.js';

describe('Vertrag SCHEMA-session-registry', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel"})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne pid", () => {
    expect(S.safeParse({"hostname":"beispiel","startedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: pid mit falschem Typ", () => {
    expect(S.safeParse({"pid":"__falsch__","hostname":"beispiel","startedAt":"beispiel"}).success).toBe(false);
  });
  it("pid: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"pid":0,"hostname":"beispiel","startedAt":"beispiel"}).success).toBe(false);
  });
  it("pid: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel"})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel"});
  });
  it("pid: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"pid":1.5,"hostname":"beispiel","startedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab ohne hostname", () => {
    expect(S.safeParse({"pid":1,"startedAt":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: hostname mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":12345,"startedAt":"beispiel"}).success).toBe(false);
  });
  it("hostname: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"pid":1,"hostname":"","startedAt":"beispiel"}).success).toBe(false);
  });
  it("hostname: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"x","startedAt":"beispiel"})).toEqual({"pid":1,"hostname":"x","startedAt":"beispiel"});
  });
  it("lehnt ab ohne startedAt", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: startedAt mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":12345}).success).toBe(false);
  });
  it("startedAt: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":""}).success).toBe(false);
  });
  it("startedAt: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"x"})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"x"});
  });
});
