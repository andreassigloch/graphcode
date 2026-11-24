// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-typbindung-ergebnis → src/projections/typbindung.ts#TypbindungErgebnisSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TypbindungErgebnisSchema as S } from '../../src/projections/typbindung.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-typbindung-ergebnis', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]})).toEqual({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne text", () => {
    expect(S.safeParse({"befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]}).success).toBe(false);
  });
  it("lehnt ab: text mit falschem Typ", () => {
    expect(S.safeParse({"text":12345,"befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]}).success).toBe(false);
  });
  it("text: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]})).toEqual({"text":"","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}]});
  });
  it("lehnt ab ohne befunde", () => {
    expect(S.safeParse({"text":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: befunde mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","befunde":"__falsch__"}).success).toBe(false);
  });
  it("befunde[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"text":"beispiel","befunde":["__falsch__"]}).success).toBe(false);
  });
  it("befunde[]: lehnt ab ohne func", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"klasse":"gebunden","grund":"beispiel"}]}).success).toBe(false);
  });
  it("befunde[]: lehnt ab: func mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":12345,"klasse":"gebunden","grund":"beispiel"}]}).success).toBe(false);
  });
  it("befunde[].func: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","befunde":[{"func":"","klasse":"gebunden","grund":"beispiel"}]})).toEqual({"text":"beispiel","befunde":[{"func":"","klasse":"gebunden","grund":"beispiel"}]});
  });
  it("befunde[]: lehnt ab ohne klasse", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","grund":"beispiel"}]}).success).toBe(false);
  });
  it("befunde[]: lehnt ab: klasse mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":12345,"grund":"beispiel"}]}).success).toBe(false);
  });
  it("befunde[]: lehnt ab: klasse außerhalb des Enums", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"__ausserhalb__","grund":"beispiel"}]}).success).toBe(false);
  });
  it("befunde[].klasse: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","befunde"],["element"],["shape","klasse"]])._zod.def.entries as Record<string, unknown>)).toEqual(["gebunden","altlast","nicht prüfbar"]);
  });
  it("befunde[]: nimmt an ohne grund (optional)", () => {
    expect(S.parse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden"}]})).toEqual({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden"}]});
  });
  it("befunde[]: lehnt ab: grund mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":12345}]}).success).toBe(false);
  });
  it("befunde[].grund: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":""}]})).toEqual({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":""}]});
  });
  it("befunde[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel","__zusatz__":1}]}).success).toBe(false);
  });
  it("befunde: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","befunde":[]})).toEqual({"text":"beispiel","befunde":[]});
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"text":"beispiel","befunde":[{"func":"beispiel","klasse":"gebunden","grund":"beispiel"}],"__zusatz__":1}).success).toBe(false);
  });
});
