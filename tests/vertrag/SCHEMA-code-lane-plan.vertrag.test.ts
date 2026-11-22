// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-code-lane-plan → src/kernel/measure/test-selection.ts#CodeLanePlanSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { CodeLanePlanSchema as S } from '../../src/kernel/measure/test-selection.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-code-lane-plan', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne lane", () => {
    expect(S.safeParse({"files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: lane mit falschem Typ", () => {
    expect(S.safeParse({"lane":12345,"files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: lane außerhalb des Enums", () => {
    expect(S.safeParse({"lane":"__ausserhalb__","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lane: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","lane"]])._zod.def.entries as Record<string, unknown>)).toEqual(["CODE","VOLL","KEINE"]);
  });
  it("lehnt ab ohne files", () => {
    expect(S.safeParse({"lane":"CODE","command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: files mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":"__falsch__","command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("files[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"lane":"CODE","files":[12345],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("files[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":[""],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":[""],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("files: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":[],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":[],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("lehnt ab ohne command", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: command mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":12345,"reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("command: nimmt null an", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":null,"reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":null,"reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("command: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("lehnt ab ohne reason", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: reason mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":12345,"binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("reason: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("lehnt ab ohne binding", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: binding mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":"__falsch__","unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding: lehnt ab ohne sources", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding: lehnt ab: sources mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":"__falsch__","bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding.sources: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":-1,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding.sources: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("binding.sources: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0.5,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding: lehnt ab ohne bound", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding: lehnt ab: bound mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":"__falsch__"},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding.bound: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":-1},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("binding.bound: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("binding.bound: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0.5},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne unresolvedTests", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: unresolvedTests mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":"__falsch__","manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("unresolvedTests[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":[12345],"manuell":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("unresolvedTests[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":[""],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":[""],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("unresolvedTests: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":[],"manuell":["beispiel"],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":[],"manuell":["beispiel"],"lines":["beispiel"]});
  });
  it("lehnt ab ohne manuell", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"lines":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: manuell mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":"__falsch__","lines":["beispiel"]}).success).toBe(false);
  });
  it("manuell[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":[12345],"lines":["beispiel"]}).success).toBe(false);
  });
  it("manuell[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":[""],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":[""],"lines":["beispiel"]});
  });
  it("manuell: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":[],"lines":["beispiel"]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":[],"lines":["beispiel"]});
  });
  it("lehnt ab ohne lines", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: lines mit falschem Typ", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":"__falsch__"}).success).toBe(false);
  });
  it("lines[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":[12345]}).success).toBe(false);
  });
  it("lines[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":[""]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":[""]});
  });
  it("lines: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":[]})).toEqual({"lane":"CODE","files":["beispiel"],"command":"beispiel","reason":"beispiel","binding":{"sources":0,"bound":0},"unresolvedTests":["beispiel"],"manuell":["beispiel"],"lines":[]});
  });
});
