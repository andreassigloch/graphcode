// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-target-profile → src/loop/target-profile-contract.ts#TargetProfileSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TargetProfileSchema as S } from '../../src/loop/target-profile-contract.js';

describe('Vertrag SCHEMA-target-profile', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"intentAnchors":["beispiel","beispiel","beispiel"]})).toEqual({"intentAnchors":["beispiel","beispiel","beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("nimmt an ohne intentAnchors (optional)", () => {
    expect(S.parse({})).toEqual({});
  });
  it("lehnt ab: intentAnchors mit falschem Typ", () => {
    expect(S.safeParse({"intentAnchors":"__falsch__"}).success).toBe(false);
  });
  it("intentAnchors[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"intentAnchors":[12345,"beispiel","beispiel"]}).success).toBe(false);
  });
  it("intentAnchors[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"intentAnchors":["","beispiel","beispiel"]}).success).toBe(false);
  });
  it("intentAnchors[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"intentAnchors":["x","beispiel","beispiel"]})).toEqual({"intentAnchors":["x","beispiel","beispiel"]});
  });
  it("intentAnchors: lehnt ab: Liste mit 2 Elementen (unter der Mindestlänge 3)", () => {
    expect(S.safeParse({"intentAnchors":["beispiel","beispiel"]}).success).toBe(false);
  });
  it("intentAnchors: nimmt Liste mit 3 Elementen an (Untergrenze)", () => {
    expect(S.parse({"intentAnchors":["beispiel","beispiel","beispiel"]})).toEqual({"intentAnchors":["beispiel","beispiel","beispiel"]});
  });
  it("intentAnchors: nimmt Liste mit 7 Elementen an (Obergrenze)", () => {
    expect(S.parse({"intentAnchors":["beispiel","beispiel","beispiel","beispiel","beispiel","beispiel","beispiel"]})).toEqual({"intentAnchors":["beispiel","beispiel","beispiel","beispiel","beispiel","beispiel","beispiel"]});
  });
  it("intentAnchors: lehnt ab: Liste mit 8 Elementen (über der Obergrenze 7)", () => {
    expect(S.safeParse({"intentAnchors":["beispiel","beispiel","beispiel","beispiel","beispiel","beispiel","beispiel","beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"intentAnchors":["beispiel","beispiel","beispiel"],"__zusatz__":1}).success).toBe(false);
  });
});
