// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-export-answer → src/projections/export.ts#GraphExportAnswerSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { GraphExportAnswerSchema as S } from '../../src/projections/export.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-export-answer', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne graphJson", () => {
    expect(S.safeParse({"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: graphJson mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":"__falsch__","views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne path", () => {
    expect(S.safeParse({"graphJson":{"bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: path mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":12345,"bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.path: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"graphJson":{"path":"","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.path: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graphJson":{"path":"x","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"x","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("graphJson: lehnt ab ohne bytes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":"__falsch__","nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.bytes: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":-1,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.bytes: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("graphJson.bytes: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0.5,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":"__falsch__","edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.nodes: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":-1,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.nodes: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("graphJson.nodes: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0.5,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab ohne edges", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":"__falsch__"},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.edges: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":-1},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("graphJson.edges: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("graphJson.edges: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0.5},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab ohne views", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: views mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":"__falsch__","stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":["__falsch__"],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab ohne view", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: view mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":12345,"path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: view außerhalb des Enums", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"__ausserhalb__","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[].view: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","views"],["element"],["shape","view"]])._zod.def.entries as Record<string, unknown>)).toEqual(["architecture","references","srs","nfr","rtm","icd","testconcept","testmatrix","intplan","changelog","fmea","conops","implplan"]);
  });
  it("views[]: lehnt ab ohne path", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: path mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":12345,"bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[].path: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"","bytes":0}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[].path: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"x","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"x","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("views[]: lehnt ab ohne bytes", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel"}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[]: lehnt ab: bytes mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":"__falsch__"}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[].bytes: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":-1}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views[].bytes: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("views[].bytes: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0.5}],"stubs":["beispiel"],"unfedMutations":1}).success).toBe(false);
  });
  it("views: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("lehnt ab ohne stubs", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"unfedMutations":1}).success).toBe(false);
  });
  it("lehnt ab: stubs mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":"__falsch__","unfedMutations":1}).success).toBe(false);
  });
  it("stubs[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":[12345],"unfedMutations":1}).success).toBe(false);
  });
  it("stubs[]: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":[""],"unfedMutations":1}).success).toBe(false);
  });
  it("stubs[]: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["x"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["x"],"unfedMutations":1});
  });
  it("stubs: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":[],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":[],"unfedMutations":1});
  });
  it("nimmt an ohne unfedMutations (optional)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"]})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"]});
  });
  it("lehnt ab: unfedMutations mit falschem Typ", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":"__falsch__"}).success).toBe(false);
  });
  it("unfedMutations: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":0}).success).toBe(false);
  });
  it("unfedMutations: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1})).toEqual({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1});
  });
  it("unfedMutations: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graphJson":{"path":"beispiel","bytes":0,"nodes":0,"edges":0},"views":[{"view":"architecture","path":"beispiel","bytes":0}],"stubs":["beispiel"],"unfedMutations":1.5}).success).toBe(false);
  });
});
