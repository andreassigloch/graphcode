// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-typbindung-optionen → src/surface/typbindung-verb.ts#TypbindungOptionenSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TypbindungOptionenSchema as S } from '../../src/surface/typbindung-verb.js';

describe('Vertrag SCHEMA-typbindung-optionen', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","ziel":"beispiel"})).toEqual({"repoRoot":"beispiel","ziel":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"ziel":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"ziel":"beispiel"}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"","ziel":"beispiel"})).toEqual({"repoRoot":"","ziel":"beispiel"});
  });
  it("nimmt an ohne ziel (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel"})).toEqual({"repoRoot":"beispiel"});
  });
  it("lehnt ab: ziel mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","ziel":12345}).success).toBe(false);
  });
  it("ziel: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","ziel":""})).toEqual({"repoRoot":"beispiel","ziel":""});
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"repoRoot":"beispiel","ziel":"beispiel","__zusatz__":1}).success).toBe(false);
  });
});
