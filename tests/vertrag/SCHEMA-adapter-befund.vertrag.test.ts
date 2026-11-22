// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-adapter-befund → src/kernel/measure/constraints.ts#AdapterBefund. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { AdapterBefund as S } from '../../src/kernel/measure/constraints.js';

describe('Vertrag SCHEMA-adapter-befund', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne flussOhneEinModul", () => {
    expect(S.safeParse({"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: flussOhneEinModul mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":"__falsch__","moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"flussOhneEinModul":["__falsch__"],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[]: lehnt ab ohne akteur", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[]: lehnt ab: akteur mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":12345,"fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[].akteur: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("flussOhneEinModul[]: lehnt ab ohne fluss", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[]: lehnt ab: fluss mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":12345,"module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[].fluss: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("flussOhneEinModul[]: lehnt ab ohne module", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel"}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[]: lehnt ab: module mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":"__falsch__"}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[].module[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":[12345]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul[].module[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":[""]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":[""]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("flussOhneEinModul[].module: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":[]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":[]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("flussOhneEinModul[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"],"__zusatz__":1}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("flussOhneEinModul: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("lehnt ab ohne moduleOhneEinenAkteur", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: moduleOhneEinenAkteur mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":"__falsch__","akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":["__falsch__"],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[]: lehnt ab ohne modul", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[]: lehnt ab: modul mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":12345,"akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[].modul: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("moduleOhneEinenAkteur[]: lehnt ab ohne akteure", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel"}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[]: lehnt ab: akteure mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":"__falsch__"}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[].akteure[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":[12345]}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur[].akteure[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":[""]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":[""]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("moduleOhneEinenAkteur[].akteure: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":[]}],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":[]}],"akteurOhneAdapter":["beispiel"]});
  });
  it("moduleOhneEinenAkteur[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"],"__zusatz__":1}],"akteurOhneAdapter":["beispiel"]}).success).toBe(false);
  });
  it("moduleOhneEinenAkteur: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[],"akteurOhneAdapter":["beispiel"]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[],"akteurOhneAdapter":["beispiel"]});
  });
  it("lehnt ab ohne akteurOhneAdapter", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}]}).success).toBe(false);
  });
  it("lehnt ab: akteurOhneAdapter mit falschem Typ", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":"__falsch__"}).success).toBe(false);
  });
  it("akteurOhneAdapter[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":[12345]}).success).toBe(false);
  });
  it("akteurOhneAdapter[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":[""]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":[""]});
  });
  it("akteurOhneAdapter: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":[]})).toEqual({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":[]});
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"flussOhneEinModul":[{"akteur":"beispiel","fluss":"beispiel","module":["beispiel"]}],"moduleOhneEinenAkteur":[{"modul":"beispiel","akteure":["beispiel"]}],"akteurOhneAdapter":["beispiel"],"__zusatz__":1}).success).toBe(false);
  });
});
