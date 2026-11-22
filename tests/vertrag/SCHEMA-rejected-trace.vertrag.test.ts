// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-rejected-trace → src/kernel/harness-import.ts#RejectedTraceSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RejectedTraceSchema as S } from '../../src/kernel/harness-import.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-rejected-trace', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"source":"beispiel","target":"beispiel","type":"beispiel","reason":"no-pattern"})).toEqual({"source":"beispiel","target":"beispiel","type":"beispiel","reason":"no-pattern"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne source", () => {
    expect(S.safeParse({"target":"beispiel","type":"beispiel","reason":"no-pattern"}).success).toBe(false);
  });
  it("lehnt ab: source mit falschem Typ", () => {
    expect(S.safeParse({"source":12345,"target":"beispiel","type":"beispiel","reason":"no-pattern"}).success).toBe(false);
  });
  it("source: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"source":"","target":"beispiel","type":"beispiel","reason":"no-pattern"})).toEqual({"source":"","target":"beispiel","type":"beispiel","reason":"no-pattern"});
  });
  it("lehnt ab ohne target", () => {
    expect(S.safeParse({"source":"beispiel","type":"beispiel","reason":"no-pattern"}).success).toBe(false);
  });
  it("lehnt ab: target mit falschem Typ", () => {
    expect(S.safeParse({"source":"beispiel","target":12345,"type":"beispiel","reason":"no-pattern"}).success).toBe(false);
  });
  it("target: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"source":"beispiel","target":"","type":"beispiel","reason":"no-pattern"})).toEqual({"source":"beispiel","target":"","type":"beispiel","reason":"no-pattern"});
  });
  it("lehnt ab ohne type", () => {
    expect(S.safeParse({"source":"beispiel","target":"beispiel","reason":"no-pattern"}).success).toBe(false);
  });
  it("lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"source":"beispiel","target":"beispiel","type":12345,"reason":"no-pattern"}).success).toBe(false);
  });
  it("type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"source":"beispiel","target":"beispiel","type":"","reason":"no-pattern"})).toEqual({"source":"beispiel","target":"beispiel","type":"","reason":"no-pattern"});
  });
  it("lehnt ab ohne reason", () => {
    expect(S.safeParse({"source":"beispiel","target":"beispiel","type":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: reason mit falschem Typ", () => {
    expect(S.safeParse({"source":"beispiel","target":"beispiel","type":"beispiel","reason":12345}).success).toBe(false);
  });
  it("lehnt ab: reason außerhalb des Enums", () => {
    expect(S.safeParse({"source":"beispiel","target":"beispiel","type":"beispiel","reason":"__ausserhalb__"}).success).toBe(false);
  });
  it("reason: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","reason"]])._zod.def.values as Record<string, unknown>)).toEqual(["no-pattern"]);
  });
});
