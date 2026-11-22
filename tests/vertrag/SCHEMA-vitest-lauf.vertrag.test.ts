// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vitest-lauf → src/projections/test-schlupf.ts#VitestLaufSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VitestLaufSchema as S } from '../../src/projections/test-schlupf.js';

describe('Vertrag SCHEMA-vitest-lauf', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"status":1,"signal":"beispiel","bericht":"beispiel"})).toEqual({"status":1,"signal":"beispiel","bericht":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne status", () => {
    expect(S.safeParse({"signal":"beispiel","bericht":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: status mit falschem Typ", () => {
    expect(S.safeParse({"status":"__falsch__","signal":"beispiel","bericht":"beispiel"}).success).toBe(false);
  });
  it("status: nimmt null an", () => {
    expect(S.parse({"status":null,"signal":"beispiel","bericht":"beispiel"})).toEqual({"status":null,"signal":"beispiel","bericht":"beispiel"});
  });
  it("lehnt ab ohne signal", () => {
    expect(S.safeParse({"status":1,"bericht":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: signal mit falschem Typ", () => {
    expect(S.safeParse({"status":1,"signal":12345,"bericht":"beispiel"}).success).toBe(false);
  });
  it("signal: nimmt null an", () => {
    expect(S.parse({"status":1,"signal":null,"bericht":"beispiel"})).toEqual({"status":1,"signal":null,"bericht":"beispiel"});
  });
  it("signal: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"status":1,"signal":"","bericht":"beispiel"})).toEqual({"status":1,"signal":"","bericht":"beispiel"});
  });
  it("nimmt an ohne bericht (optional)", () => {
    expect(S.parse({"status":1,"signal":"beispiel"})).toEqual({"status":1,"signal":"beispiel"});
  });
  it("lehnt ab: bericht mit falschem Typ", () => {
    expect(S.safeParse({"status":1,"signal":"beispiel","bericht":12345}).success).toBe(false);
  });
  it("bericht: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"status":1,"signal":"beispiel","bericht":""})).toEqual({"status":1,"signal":"beispiel","bericht":""});
  });
});
