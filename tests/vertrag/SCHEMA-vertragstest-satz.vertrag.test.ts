// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-vertragstest-satz → src/projections/vertragstest.ts#VertragstestSatzSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { VertragstestSatzSchema as S } from '../../src/projections/vertragstest.js';

describe('Vertrag SCHEMA-vertragstest-satz', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}]);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("[] (Variante 1): nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"beispiel"}]);
  });
  it("[] (Variante 1): lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1).id: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"","file":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1).id: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"x","file":"beispiel","symbol":"beispiel"}])).toEqual([{"id":"x","file":"beispiel","symbol":"beispiel"}]);
  });
  it("[] (Variante 1): lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345,"symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1).file: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"beispiel","file":"","symbol":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1).file: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"beispiel","file":"x","symbol":"beispiel"}])).toEqual([{"id":"beispiel","file":"x","symbol":"beispiel"}]);
  });
  it("[] (Variante 1): lehnt ab ohne symbol", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 1): lehnt ab: symbol mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":12345}]).success).toBe(false);
  });
  it("[] (Variante 1).symbol: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":""}]).success).toBe(false);
  });
  it("[] (Variante 1).symbol: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"beispiel","file":"beispiel","symbol":"x"}])).toEqual([{"id":"beispiel","file":"beispiel","symbol":"x"}]);
  });
  it("[] (Variante 1): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":"beispiel","symbol":"beispiel","__zusatz__":1}]).success).toBe(false);
  });
  it("[] (Variante 2): nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}])).toEqual([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}]);
  });
  it("[] (Variante 2): lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2).id: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2).id: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"x","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}])).toEqual([{"id":"x","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a"}]);
  });
  it("[] (Variante 2): lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel","symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345,"symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2).file: lehnt ab: Text verletzt die Regel /^packages\\/[a-z0-9-]+\\/src\\/.+\\.ts$/", () => {
    expect(S.safeParse([{"id":"beispiel","file":"!","symbol":"beispiel","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab ohne symbol", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: symbol mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":12345,"paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2).symbol: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"","paket":"@sigloch/a"}]).success).toBe(false);
  });
  it("[] (Variante 2).symbol: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"x","paket":"@sigloch/a"}])).toEqual([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"x","paket":"@sigloch/a"}]);
  });
  it("[] (Variante 2): lehnt ab: paket mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"beispiel","paket":12345}]).success).toBe(false);
  });
  it("[] (Variante 2).paket: lehnt ab: Text verletzt die Regel /^@sigloch\\/[a-z0-9-]+$/", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"!"}]).success).toBe(false);
  });
  it("[] (Variante 2): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":"packages/a/src/a.ts","symbol":"beispiel","paket":"@sigloch/a","__zusatz__":1}]).success).toBe(false);
  });
  it("[] (Variante 3): nimmt das Beispiel an", () => {
    expect(S.parse([{"id":"beispiel","file":".md"}])).toEqual([{"id":"beispiel","file":".md"}]);
  });
  it("[] (Variante 3): lehnt ab ohne id", () => {
    expect(S.safeParse([{"file":".md"}]).success).toBe(false);
  });
  it("[] (Variante 3): lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse([{"id":12345,"file":".md"}]).success).toBe(false);
  });
  it("[] (Variante 3).id: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"id":"","file":".md"}]).success).toBe(false);
  });
  it("[] (Variante 3).id: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"id":"x","file":".md"}])).toEqual([{"id":"x","file":".md"}]);
  });
  it("[] (Variante 3): lehnt ab ohne file", () => {
    expect(S.safeParse([{"id":"beispiel"}]).success).toBe(false);
  });
  it("[] (Variante 3): lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"id":"beispiel","file":12345}]).success).toBe(false);
  });
  it("[] (Variante 3).file: lehnt ab: Text verletzt die Regel /\\.md$/", () => {
    expect(S.safeParse([{"id":"beispiel","file":"!"}]).success).toBe(false);
  });
  it("[] (Variante 3): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse([{"id":"beispiel","file":".md","__zusatz__":1}]).success).toBe(false);
  });
  it("nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse([])).toEqual([]);
  });
});
