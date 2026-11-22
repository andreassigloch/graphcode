// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-real-ref → packages/contracts/src/se/ontology.ts#RealRefSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RealRefSchema as S } from '@sigloch/contracts/se';

describe('Vertrag SCHEMA-real-ref', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"file":"beispiel","symbol":"beispiel","lang":"beispiel"})).toEqual({"file":"beispiel","symbol":"beispiel","lang":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne file", () => {
    expect(S.safeParse({"symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"file":12345,"symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("file: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"file":"","symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("file: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"file":"x","symbol":"beispiel","lang":"beispiel"})).toEqual({"file":"x","symbol":"beispiel","lang":"beispiel"});
  });
  it("file: lehnt ab: Text passt auf das verbotene Muster /\\\\/", () => {
    expect(S.safeParse({"file":"\\","symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("file: lehnt ab: Text passt auf das verbotene Muster /^[/~]/", () => {
    expect(S.safeParse({"file":"/","symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("file: lehnt ab: Text passt auf das verbotene Muster /^[A-Za-z]:/", () => {
    expect(S.safeParse({"file":"A:","symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("file: lehnt ab: Text passt auf das verbotene Muster /(^|\\/)\\.\\.(\\/|$)/", () => {
    expect(S.safeParse({"file":"../","symbol":"beispiel","lang":"beispiel"}).success).toBe(false);
  });
  it("nimmt an ohne symbol (optional)", () => {
    expect(S.parse({"file":"beispiel","lang":"beispiel"})).toEqual({"file":"beispiel","lang":"beispiel"});
  });
  it("lehnt ab: symbol mit falschem Typ", () => {
    expect(S.safeParse({"file":"beispiel","symbol":12345,"lang":"beispiel"}).success).toBe(false);
  });
  it("symbol: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"file":"beispiel","symbol":"","lang":"beispiel"})).toEqual({"file":"beispiel","symbol":"","lang":"beispiel"});
  });
  it("nimmt an ohne lang (optional)", () => {
    expect(S.parse({"file":"beispiel","symbol":"beispiel"})).toEqual({"file":"beispiel","symbol":"beispiel"});
  });
  it("lehnt ab: lang mit falschem Typ", () => {
    expect(S.safeParse({"file":"beispiel","symbol":"beispiel","lang":12345}).success).toBe(false);
  });
  it("lang: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"file":"beispiel","symbol":"beispiel","lang":""})).toEqual({"file":"beispiel","symbol":"beispiel","lang":""});
  });
});
