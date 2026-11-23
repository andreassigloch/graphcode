// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-skill-text → src/surface/scaffold-templates.ts#SkillMetaSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SkillMetaSchema as S } from '../../src/surface/scaffold-templates.js';

describe('Vertrag SCHEMA-skill-text', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"name":"beispiel","description":"beispiel","version":0})).toEqual({"name":"beispiel","description":"beispiel","version":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne name", () => {
    expect(S.safeParse({"description":"beispiel","version":0}).success).toBe(false);
  });
  it("lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"name":12345,"description":"beispiel","version":0}).success).toBe(false);
  });
  it("name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"name":"","description":"beispiel","version":0})).toEqual({"name":"","description":"beispiel","version":0});
  });
  it("lehnt ab ohne description", () => {
    expect(S.safeParse({"name":"beispiel","version":0}).success).toBe(false);
  });
  it("lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":12345,"version":0}).success).toBe(false);
  });
  it("description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"name":"beispiel","description":"","version":0})).toEqual({"name":"beispiel","description":"","version":0});
  });
  it("lehnt ab ohne version", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","version":"__falsch__"}).success).toBe(false);
  });
  it("version: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","version":-1}).success).toBe(false);
  });
  it("version: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"name":"beispiel","description":"beispiel","version":0})).toEqual({"name":"beispiel","description":"beispiel","version":0});
  });
  it("version: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","version":0.5}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"name":"beispiel","description":"beispiel","version":0,"__zusatz__":1}).success).toBe(false);
  });
});
