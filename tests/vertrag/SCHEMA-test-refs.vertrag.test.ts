// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-test-refs → packages/contracts/src/se/ontology.ts#TestRefsSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TestRefsSchema as S } from '@sigloch/contracts/se';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-test-refs', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("lehnt einen Wert ab, der keine Liste ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse(["__falsch__"]).success).toBe(false);
  });
  it("[]: lehnt ab ohne file", () => {
    expect(S.safeParse([{"case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse([{"file":12345,"case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].file: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"file":"","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].file: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"file":"x","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"x","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[].file: lehnt ab: Text passt auf das verbotene Muster /\\\\/", () => {
    expect(S.safeParse([{"file":"\\","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].file: lehnt ab: Text passt auf das verbotene Muster /^[/~]/", () => {
    expect(S.safeParse([{"file":"/","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].file: lehnt ab: Text passt auf das verbotene Muster /^[A-Za-z]:/", () => {
    expect(S.safeParse([{"file":"A:","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].file: lehnt ab: Text passt auf das verbotene Muster /(^|\\/)\\.\\.(\\/|$)/", () => {
    expect(S.safeParse([{"file":"../","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[]: nimmt an ohne case (optional)", () => {
    expect(S.parse([{"file":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: lehnt ab: case mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":12345,"tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].case: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"file":"beispiel","case":"","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: lehnt ab ohne tool", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[]: lehnt ab: tool mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":12345,"level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].tool: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: nimmt an ohne level (optional)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: lehnt ab: level mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":12345,"result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].level: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: nimmt an ohne result (optional)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
  it("[]: lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":12345,"ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[]: lehnt ab: result außerhalb des Enums", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"__ausserhalb__","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].result: Werteliste unverändert", () => {
    expect(Object.values(bei([["element"],["shape","result"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["passed","failed","skipped","pending"]);
  });
  it("[]: nimmt an ohne ranAt (optional)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","evidence":"beispiel"}]);
  });
  it("[]: lehnt ab: ranAt mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":12345,"evidence":"beispiel"}]).success).toBe(false);
  });
  it("[].ranAt: lehnt ab: Text ohne das Format datetime", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"__kein_format__","evidence":"beispiel"}]).success).toBe(false);
  });
  it("[]: nimmt an ohne evidence (optional)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z"}]);
  });
  it("[]: lehnt ab: evidence mit falschem Typ", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":12345}]).success).toBe(false);
  });
  it("[].evidence: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":""}]).success).toBe(false);
  });
  it("[].evidence: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"x"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"x"}]);
  });
  it("[].evidence: lehnt ab: Text passt auf das verbotene Muster /\\\\/", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"\\"}]).success).toBe(false);
  });
  it("[].evidence: lehnt ab: Text passt auf das verbotene Muster /^[/~]/", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"/"}]).success).toBe(false);
  });
  it("[].evidence: lehnt ab: Text passt auf das verbotene Muster /^[A-Za-z]:/", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"A:"}]).success).toBe(false);
  });
  it("[].evidence: lehnt ab: Text passt auf das verbotene Muster /(^|\\/)\\.\\.(\\/|$)/", () => {
    expect(S.safeParse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"../"}]).success).toBe(false);
  });
  it("lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse([]).success).toBe(false);
  });
  it("nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}])).toEqual([{"file":"beispiel","case":"beispiel","tool":"beispiel","level":"beispiel","result":"passed","ranAt":"2026-01-01T00:00:00.000Z","evidence":"beispiel"}]);
  });
});
