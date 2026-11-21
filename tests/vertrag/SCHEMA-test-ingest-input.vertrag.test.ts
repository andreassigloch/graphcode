// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-test-ingest-input → src/projections/testreport.ts#GraphTestIngestInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphTestIngestInputSchema as S } from '../../src/projections/testreport.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-test-ingest-input', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne ingest", () => {
    expect(S.safeParse({"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("lehnt ab: ingest mit falschem Typ", () => {
    expect(S.safeParse({"ingest":"__falsch__","consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1): nimmt das Beispiel an", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 1): lehnt ab ohne art", () => {
    expect(S.safeParse({"ingest":{"report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1): lehnt ab: art mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":12345,"report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1): lehnt ab: art außerhalb des Enums", () => {
    expect(S.safeParse({"ingest":{"art":"__ausserhalb__","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).art: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","ingest"],["options",0],["shape","art"]])._zod.def.values as Record<string, unknown>)).toEqual(["report"]);
  });
  it("ingest (Variante 1): lehnt ab ohne report", () => {
    expect(S.safeParse({"ingest":{"art":"report","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1): lehnt ab: report mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":12345,"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).report: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 1): nimmt an ohne changeSet (optional)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel"},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel"},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 1): lehnt ab: changeSet mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":"__falsch__"},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).changeSet[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":[12345]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).changeSet[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":[""]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).changeSet[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["x"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["x"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 1).changeSet: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":[]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 1).changeSet: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 1): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"],"__zusatz__":1},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2): nimmt das Beispiel an", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2): lehnt ab ohne art", () => {
    expect(S.safeParse({"ingest":{"results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2): lehnt ab: art mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":12345,"results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2): lehnt ab: art außerhalb des Enums", () => {
    expect(S.safeParse({"ingest":{"art":"__ausserhalb__","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).art: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","ingest"],["options",1],["shape","art"]])._zod.def.values as Record<string, unknown>)).toEqual(["results"]);
  });
  it("ingest (Variante 2): lehnt ab ohne results", () => {
    expect(S.safeParse({"ingest":{"art":"results","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2): lehnt ab: results mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":"__falsch__","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":["__falsch__"],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[]: lehnt ab ohne file", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[]: lehnt ab: file mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":12345,"result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].file: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].file: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"x","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"x","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).results[]: lehnt ab ohne result", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[]: lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":12345,"tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[]: lehnt ab: result außerhalb des Enums", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"__ausserhalb__","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].result: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","ingest"],["options",1],["shape","results"],["element"],["shape","result"]])._zod.def.entries as Record<string, unknown>)).toEqual(["passed","failed","skipped","pending"]);
  });
  it("ingest (Variante 2).results[]: nimmt an ohne tool (optional)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).results[]: lehnt ab: tool mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":12345,"evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].tool: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].tool: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"x","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"x","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).results[]: nimmt an ohne evidence (optional)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).results[]: lehnt ab: evidence mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":12345}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].evidence: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":""}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results[].evidence: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"x"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"x"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).results[]: lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel","__zusatz__":1}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).results: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2): nimmt an ohne changeSet (optional)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2): lehnt ab: changeSet mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":"__falsch__"},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).changeSet[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":[12345]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).changeSet[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":[""]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).changeSet[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["x"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["x"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2).changeSet: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":[]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 2).changeSet: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 2): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ingest":{"art":"results","results":[{"file":"beispiel","result":"passed","tool":"beispiel","evidence":"beispiel"}],"changeSet":["beispiel"],"__zusatz__":1},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3): nimmt das Beispiel an", () => {
    expect(S.parse({"ingest":{"art":"withdraw","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"withdraw","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 3): lehnt ab ohne art", () => {
    expect(S.safeParse({"ingest":{"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3): lehnt ab: art mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":12345,"changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3): lehnt ab: art außerhalb des Enums", () => {
    expect(S.safeParse({"ingest":{"art":"__ausserhalb__","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3).art: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","ingest"],["options",2],["shape","art"]])._zod.def.values as Record<string, unknown>)).toEqual(["withdraw"]);
  });
  it("ingest (Variante 3): lehnt ab ohne changeSet", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw"},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3): lehnt ab: changeSet mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw","changeSet":"__falsch__"},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3).changeSet[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw","changeSet":[12345]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3).changeSet[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw","changeSet":[""]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3).changeSet[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"withdraw","changeSet":["x"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"withdraw","changeSet":["x"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 3).changeSet: lehnt ab: Liste mit 0 Elementen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw","changeSet":[]},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("ingest (Variante 3).changeSet: nimmt Liste mit 1 Elementen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"withdraw","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true})).toEqual({"ingest":{"art":"withdraw","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true});
  });
  it("ingest (Variante 3): lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ingest":{"art":"withdraw","changeSet":["beispiel"],"__zusatz__":1},"consumerId":"beispiel","dryRun":true}).success).toBe(false);
  });
  it("nimmt an ohne consumerId (optional)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"test-ingest","dryRun":true});
  });
  it("lehnt ab: consumerId mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":12345,"dryRun":true}).success).toBe(false);
  });
  it("consumerId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"","dryRun":true})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"","dryRun":true});
  });
  it("nimmt an ohne dryRun (optional)", () => {
    expect(S.parse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel"})).toEqual({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":false});
  });
  it("lehnt ab: dryRun mit falschem Typ", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":"__falsch__"}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"ingest":{"art":"report","report":"beispiel","changeSet":["beispiel"]},"consumerId":"beispiel","dryRun":true,"__zusatz__":1}).success).toBe(false);
  });
});
