// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-ontology-json → src/kernel/harness-import.ts#OntologyJsonSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { OntologyJsonSchema as S } from '../../src/kernel/harness-import.js';

describe('Vertrag SCHEMA-ontology-json', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne elements", () => {
    expect(S.safeParse({"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("lehnt ab: elements mit falschem Typ", () => {
    expect(S.safeParse({"elements":"__falsch__","traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"elements":["__falsch__"],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab ohne id", () => {
    expect(S.safeParse({"elements":[{"type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":12345,"type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].id: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":12345,"name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":12345,"description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements[]: nimmt an ohne description (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":12345}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":""}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":""}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements[]: nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","__zusatz__":1}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","__zusatz__":1}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("elements: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"elements":[],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel"}]});
  });
  it("lehnt ab ohne traces", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}]}).success).toBe(false);
  });
  it("lehnt ab: traces mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":"__falsch__"}).success).toBe(false);
  });
  it("traces[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":["__falsch__"]}).success).toBe(false);
  });
  it("traces[]: lehnt ab ohne source", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: source mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":12345,"target":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].source: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"","target":"beispiel","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"","target":"beispiel","type":"beispiel"}]});
  });
  it("traces[]: lehnt ab ohne target", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","type":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: target mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":12345,"type":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].target: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"","type":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"","type":"beispiel"}]});
  });
  it("traces[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":12345}]}).success).toBe(false);
  });
  it("traces[].type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":""}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":""}]});
  });
  it("traces[]: nimmt an: unbekanntes Zusatzfeld (offenes Objekt)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel","__zusatz__":1}]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"beispiel","__zusatz__":1}]});
  });
  it("traces: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[]})).toEqual({"elements":[{"id":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}],"traces":[]});
  });
});
