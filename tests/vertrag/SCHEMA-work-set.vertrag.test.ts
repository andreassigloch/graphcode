// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-work-set → src/kernel/measure/working-set.ts#ArbeitsmengeSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ArbeitsmengeSchema as S } from '../../src/kernel/measure/working-set.js';

describe('Vertrag SCHEMA-work-set', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"uids":["beispiel"],"zuege":0})).toEqual({"uids":["beispiel"],"zuege":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne uids", () => {
    expect(S.safeParse({"zuege":0}).success).toBe(false);
  });
  it("lehnt ab: uids mit falschem Typ", () => {
    expect(S.safeParse({"uids":"__falsch__","zuege":0}).success).toBe(false);
  });
  it("uids[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"uids":[12345],"zuege":0}).success).toBe(false);
  });
  it("uids[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"uids":[""],"zuege":0}).success).toBe(false);
  });
  it("uids[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"uids":["x"],"zuege":0})).toEqual({"uids":["x"],"zuege":0});
  });
  it("uids: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"uids":[],"zuege":0})).toEqual({"uids":[],"zuege":0});
  });
  it("lehnt ab ohne zuege", () => {
    expect(S.safeParse({"uids":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: zuege mit falschem Typ", () => {
    expect(S.safeParse({"uids":["beispiel"],"zuege":"__falsch__"}).success).toBe(false);
  });
  it("zuege: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"uids":["beispiel"],"zuege":-1}).success).toBe(false);
  });
  it("zuege: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"uids":["beispiel"],"zuege":0})).toEqual({"uids":["beispiel"],"zuege":0});
  });
  it("zuege: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"uids":["beispiel"],"zuege":0.5}).success).toBe(false);
  });
});
