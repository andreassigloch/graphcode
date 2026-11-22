// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-update-event → packages/contracts/src/harness/index.ts#LiveUpdateEventSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { LiveUpdateEventSchema as S } from '@sigloch/contracts/harness';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-update-event', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne type", () => {
    expect(S.safeParse({"domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"type":12345,"domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: type außerhalb des Enums", () => {
    expect(S.safeParse({"type":"__ausserhalb__","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("type: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","type"]])._zod.def.entries as Record<string, unknown>)).toEqual(["invalidate","reset"]);
  });
  it("lehnt ab ohne domains", () => {
    expect(S.safeParse({"type":"invalidate","ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: domains mit falschem Typ", () => {
    expect(S.safeParse({"type":"invalidate","domains":"__falsch__","ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("domains[]: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","domains"],["element"]])._zod.def.entries as Record<string, unknown>)).toEqual(["graph","rules","readiness","suggestions"]);
  });
  it("domains[]: nimmt graph an", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("domains[]: nimmt rules an", () => {
    expect(S.parse({"type":"invalidate","domains":["rules"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["rules"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("domains[]: nimmt readiness an", () => {
    expect(S.parse({"type":"invalidate","domains":["readiness"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["readiness"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("domains[]: nimmt suggestions an", () => {
    expect(S.parse({"type":"invalidate","domains":["suggestions"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["suggestions"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("domains[]: lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse({"type":"invalidate","domains":["__ausserhalb__"],"ts":"beispiel","version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("domains: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"type":"invalidate","domains":[],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":[],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("lehnt ab ohne ts", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: ts mit falschem Typ", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"ts":12345,"version":0,"formatE":"beispiel"}).success).toBe(false);
  });
  it("ts: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["graph"],"ts":"","version":0,"formatE":"beispiel"});
  });
  it("nimmt an ohne version (optional)", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","formatE":"beispiel"});
  });
  it("lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":"__falsch__","formatE":"beispiel"}).success).toBe(false);
  });
  it("version: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":-1,"formatE":"beispiel"}).success).toBe(false);
  });
  it("version: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":"beispiel"});
  });
  it("version: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0.5,"formatE":"beispiel"}).success).toBe(false);
  });
  it("nimmt an ohne formatE (optional)", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0});
  });
  it("lehnt ab: formatE mit falschem Typ", () => {
    expect(S.safeParse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":12345}).success).toBe(false);
  });
  it("formatE: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":""})).toEqual({"type":"invalidate","domains":["graph"],"ts":"beispiel","version":0,"formatE":""});
  });
});
