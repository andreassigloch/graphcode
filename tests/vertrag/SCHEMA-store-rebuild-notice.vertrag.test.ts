// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-store-rebuild-notice → src/kernel/store-rebuild-notice.ts#StoreRebuildNoticeSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { StoreRebuildNoticeSchema as S } from '../../src/kernel/store-rebuild-notice.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-store-rebuild-notice', () => {
  it("Variante 1: nimmt das Beispiel an", () => {
    expect(S.parse({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":"beispiel"})).toEqual({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":"beispiel"});
  });
  it("Variante 1: lehnt ab ohne cause", () => {
    expect(S.safeParse({"from":"0000000000000000","to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: cause mit falschem Typ", () => {
    expect(S.safeParse({"cause":12345,"from":"0000000000000000","to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: cause außerhalb des Enums", () => {
    expect(S.safeParse({"cause":"__ausserhalb__","from":"0000000000000000","to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1.cause: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",0],["shape","cause"]])._zod.def.values as Record<string, unknown>)).toEqual(["schema"]);
  });
  it("Variante 1: lehnt ab ohne from", () => {
    expect(S.safeParse({"cause":"schema","to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: from mit falschem Typ", () => {
    expect(S.safeParse({"cause":"schema","from":12345,"to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1.from: lehnt ab: Text verletzt die Regel /^[0-9a-f]{16}$/", () => {
    expect(S.safeParse({"cause":"schema","from":"!","to":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab ohne to", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: to mit falschem Typ", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","to":12345,"source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1.to: lehnt ab: Text verletzt die Regel /^[0-9a-f]{16}$/", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","to":"!","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab ohne source", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","to":"0000000000000000"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: source mit falschem Typ", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":12345}).success).toBe(false);
  });
  it("Variante 1.source: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":""}).success).toBe(false);
  });
  it("Variante 1.source: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":"x"})).toEqual({"cause":"schema","from":"0000000000000000","to":"0000000000000000","source":"x"});
  });
  it("Variante 2: nimmt das Beispiel an", () => {
    expect(S.parse({"cause":"unreadable","error":"beispiel","source":"beispiel"})).toEqual({"cause":"unreadable","error":"beispiel","source":"beispiel"});
  });
  it("Variante 2: lehnt ab ohne cause", () => {
    expect(S.safeParse({"error":"beispiel","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: cause mit falschem Typ", () => {
    expect(S.safeParse({"cause":12345,"error":"beispiel","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: cause außerhalb des Enums", () => {
    expect(S.safeParse({"cause":"__ausserhalb__","error":"beispiel","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2.cause: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",1],["shape","cause"]])._zod.def.values as Record<string, unknown>)).toEqual(["unreadable"]);
  });
  it("Variante 2: lehnt ab ohne error", () => {
    expect(S.safeParse({"cause":"unreadable","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: error mit falschem Typ", () => {
    expect(S.safeParse({"cause":"unreadable","error":12345,"source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2.error: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"cause":"unreadable","error":"","source":"beispiel"}).success).toBe(false);
  });
  it("Variante 2.error: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"cause":"unreadable","error":"x","source":"beispiel"})).toEqual({"cause":"unreadable","error":"x","source":"beispiel"});
  });
  it("Variante 2: lehnt ab ohne source", () => {
    expect(S.safeParse({"cause":"unreadable","error":"beispiel"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: source mit falschem Typ", () => {
    expect(S.safeParse({"cause":"unreadable","error":"beispiel","source":12345}).success).toBe(false);
  });
  it("Variante 2.source: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"cause":"unreadable","error":"beispiel","source":""}).success).toBe(false);
  });
  it("Variante 2.source: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"cause":"unreadable","error":"beispiel","source":"x"})).toEqual({"cause":"unreadable","error":"beispiel","source":"x"});
  });
});
