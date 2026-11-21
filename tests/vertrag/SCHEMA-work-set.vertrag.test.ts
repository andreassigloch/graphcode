// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-work-set → src/kernel/measure/working-set.ts#ArbeitsmengeSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ArbeitsmengeSchema as S } from '../../src/kernel/measure/working-set.js';

describe('Vertrag SCHEMA-work-set', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"uids":["beispiel"],"zuege":0})).toEqual({"uids":["beispiel"],"zuege":0});
  });
  it("lehnt ab ohne uids", () => {
    expect(S.safeParse({"zuege":0}).success).toBe(false);
  });
  it("lehnt ab: uids mit falschem Typ", () => {
    expect(S.safeParse({"uids":"__falsch__","zuege":0}).success).toBe(false);
  });
  it("lehnt ab ohne zuege", () => {
    expect(S.safeParse({"uids":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: zuege mit falschem Typ", () => {
    expect(S.safeParse({"uids":["beispiel"],"zuege":"__falsch__"}).success).toBe(false);
  });
});
