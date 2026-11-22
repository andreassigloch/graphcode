// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-cr-groups → src/loop/se-plan.ts#CrGroupsSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { CrGroupsSchema as S } from '../../src/loop/se-plan.js';

describe('Vertrag SCHEMA-cr-groups', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"groups":[["beispiel"]],"cyclic":["beispiel"]})).toEqual({"groups":[["beispiel"]],"cyclic":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne groups", () => {
    expect(S.safeParse({"cyclic":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: groups mit falschem Typ", () => {
    expect(S.safeParse({"groups":"__falsch__","cyclic":["beispiel"]}).success).toBe(false);
  });
  it("groups[]: lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse({"groups":["__falsch__"],"cyclic":["beispiel"]}).success).toBe(false);
  });
  it("groups[][]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"groups":[[12345]],"cyclic":["beispiel"]}).success).toBe(false);
  });
  it("groups[][]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"groups":[[""]],"cyclic":["beispiel"]})).toEqual({"groups":[[""]],"cyclic":["beispiel"]});
  });
  it("groups[]: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"groups":[[]],"cyclic":["beispiel"]}).success).toBe(false);
  });
  it("groups[]: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"groups":[["beispiel"]],"cyclic":["beispiel"]})).toEqual({"groups":[["beispiel"]],"cyclic":["beispiel"]});
  });
  it("groups: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"groups":[],"cyclic":["beispiel"]})).toEqual({"groups":[],"cyclic":["beispiel"]});
  });
  it("lehnt ab ohne cyclic", () => {
    expect(S.safeParse({"groups":[["beispiel"]]}).success).toBe(false);
  });
  it("lehnt ab: cyclic mit falschem Typ", () => {
    expect(S.safeParse({"groups":[["beispiel"]],"cyclic":"__falsch__"}).success).toBe(false);
  });
  it("cyclic[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"groups":[["beispiel"]],"cyclic":[12345]}).success).toBe(false);
  });
  it("cyclic[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"groups":[["beispiel"]],"cyclic":[""]})).toEqual({"groups":[["beispiel"]],"cyclic":[""]});
  });
  it("cyclic: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"groups":[["beispiel"]],"cyclic":[]})).toEqual({"groups":[["beispiel"]],"cyclic":[]});
  });
});
