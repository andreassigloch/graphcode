// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-code-urteil → src/projections/kongruenz.ts#CodeVerdictSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { CodeVerdictSchema as S } from '../../src/projections/kongruenz.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-code-urteil', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}})).toEqual({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne verdict", () => {
    expect(S.safeParse({"why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab: verdict mit falschem Typ", () => {
    expect(S.safeParse({"verdict":12345,"why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab: verdict außerhalb des Enums", () => {
    expect(S.safeParse({"verdict":"__ausserhalb__","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("verdict: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","verdict"]])._zod.def.entries as Record<string, unknown>)).toEqual(["kongruent","gedriftet","nicht pruefbar"]);
  });
  it("lehnt ab ohne why", () => {
    expect(S.safeParse({"verdict":"kongruent","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab: why mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":12345,"reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("why: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"verdict":"kongruent","why":"","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}})).toEqual({"verdict":"kongruent","why":"","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}});
  });
  it("lehnt ab ohne reach", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab: reach mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":"__falsch__","binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab ohne endpoints", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab: endpoints mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":"__falsch__","assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach.endpoints: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1.5,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab ohne assigned", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab: assigned mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":"__falsch__","pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach.assigned: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1.5,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab ohne pct", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("reach: lehnt ab: pct mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":"__falsch__"},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab ohne binding", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("lehnt ab: binding mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":"__falsch__","rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab ohne leafFuncs", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab: leafFuncs mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":"__falsch__","bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding.leafFuncs: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1.5,"bound":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab ohne bound", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab: bound mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":"__falsch__","pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding.bound: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1.5,"pct":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab ohne pct", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding: lehnt ab: pct mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":"__falsch__"},"rcViolations":{"beispiel":1}}).success).toBe(false);
  });
  it("binding.pct: nimmt null an", () => {
    expect(S.parse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":null},"rcViolations":{"beispiel":1}})).toEqual({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":null},"rcViolations":{"beispiel":1}});
  });
  it("lehnt ab ohne rcViolations", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1}}).success).toBe(false);
  });
  it("lehnt ab: rcViolations mit falschem Typ", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":"__falsch__"}).success).toBe(false);
  });
  it("rcViolations: nimmt einen leeren Record an", () => {
    expect(S.parse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{}})).toEqual({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{}});
  });
  it("rcViolations{}: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":"__falsch__"}}).success).toBe(false);
  });
  it("rcViolations{}: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"verdict":"kongruent","why":"beispiel","reach":{"endpoints":1,"assigned":1,"pct":1},"binding":{"leafFuncs":1,"bound":1,"pct":1},"rcViolations":{"beispiel":1.5}}).success).toBe(false);
  });
});
