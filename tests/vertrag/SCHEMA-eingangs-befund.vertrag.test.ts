// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-eingangs-befund → src/kernel/measure/constraints.ts#EingangsBefund. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { EingangsBefund as S } from '../../src/kernel/measure/constraints.js';

describe('Vertrag SCHEMA-eingangs-befund', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":["beispiel"]})).toEqual({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne fremd", () => {
    expect(S.safeParse({"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: fremd mit falschem Typ", () => {
    expect(S.safeParse({"fremd":"__falsch__","fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"fremd":["__falsch__"],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[]: lehnt ab ohne fluss", () => {
    expect(S.safeParse({"fremd":[{"absender":["beispiel"]}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[]: lehnt ab: fluss mit falschem Typ", () => {
    expect(S.safeParse({"fremd":[{"fluss":12345,"absender":["beispiel"]}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[].fluss: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[{"fluss":"","absender":["beispiel"]}],"fehlend":["beispiel"]})).toEqual({"fremd":[{"fluss":"","absender":["beispiel"]}],"fehlend":["beispiel"]});
  });
  it("fremd[]: lehnt ab ohne absender", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel"}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[]: lehnt ab: absender mit falschem Typ", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":"__falsch__"}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[].absender[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":[12345]}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd[].absender[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[{"fluss":"beispiel","absender":[""]}],"fehlend":["beispiel"]})).toEqual({"fremd":[{"fluss":"beispiel","absender":[""]}],"fehlend":["beispiel"]});
  });
  it("fremd[].absender: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[{"fluss":"beispiel","absender":[]}],"fehlend":["beispiel"]})).toEqual({"fremd":[{"fluss":"beispiel","absender":[]}],"fehlend":["beispiel"]});
  });
  it("fremd[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":["beispiel"],"__zusatz__":1}],"fehlend":["beispiel"]}).success).toBe(false);
  });
  it("fremd: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[],"fehlend":["beispiel"]})).toEqual({"fremd":[],"fehlend":["beispiel"]});
  });
  it("lehnt ab ohne fehlend", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}]}).success).toBe(false);
  });
  it("lehnt ab: fehlend mit falschem Typ", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":"__falsch__"}).success).toBe(false);
  });
  it("fehlend[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":[12345]}).success).toBe(false);
  });
  it("fehlend[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":[""]})).toEqual({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":[""]});
  });
  it("fehlend: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":[]})).toEqual({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":[]});
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"fremd":[{"fluss":"beispiel","absender":["beispiel"]}],"fehlend":["beispiel"],"__zusatz__":1}).success).toBe(false);
  });
});
