// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-ontology-graph → packages/contracts/src/se/ontology.ts#OntologyGraph. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { OntologyGraph as S } from '@sigloch/contracts/se';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-ontology-graph', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne elements", () => {
    expect(S.safeParse({"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("lehnt ab: elements mit falschem Typ", () => {
    expect(S.safeParse({"elements":"__falsch__","traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"elements":["__falsch__"],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab ohne id", () => {
    expect(S.safeParse({"elements":[{"type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: id mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":12345,"type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].id: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":12345,"name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: type außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"__ausserhalb__","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].type: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","elements"],["element"],["shape","type"]])._zod.def.entries as Record<string, unknown>)).toEqual(["SYS","UC","ACTOR","FCHAIN","FUNC","FLOW","REQ","TEST","MOD","SCHEMA","CR","MS"]);
  });
  it("elements[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":12345,"description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab ohne description", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":12345,"method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: nimmt an ohne method (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab: method mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":12345,"kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: method außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"__ausserhalb__","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].method: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","elements"],["element"],["shape","method"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["test","inspection","analysis","demonstration"]);
  });
  it("elements[]: nimmt an ohne kinds (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab: kinds mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":"__falsch__","attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].kinds[]: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","elements"],["element"],["shape","kinds"],["innerType"],["element"]])._zod.def.entries as Record<string, unknown>)).toEqual(["functional","non-functional"]);
  });
  it("elements[].kinds[]: nimmt functional an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[].kinds[]: nimmt non-functional an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["non-functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["non-functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[].kinds[]: lehnt einen Wert außerhalb ab", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["__ausserhalb__"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].kinds: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":[],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":[],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":"__falsch__","status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: nimmt an ohne status (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab: status mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":12345,"created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: status außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"__ausserhalb__","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].status: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","elements"],["element"],["shape","status"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["draft","reviewed","open","done"]);
  });
  it("elements[]: lehnt ab ohne created_at", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: created_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":12345,"updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].created_at: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: nimmt an ohne updated_at (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements[]: lehnt ab: updated_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":12345}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[].updated_at: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":""}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":""}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("elements: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"elements":[],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("lehnt ab ohne traces", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}]}).success).toBe(false);
  });
  it("lehnt ab: traces mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":"__falsch__"}).success).toBe(false);
  });
  it("traces[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":["__falsch__"]}).success).toBe(false);
  });
  it("traces[]: lehnt ab ohne source", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: source mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":12345,"target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].source: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab ohne target", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: target mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":12345,"type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].target: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":12345,"label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: type außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"__ausserhalb__","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].type: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","traces"],["element"],["shape","type"]])._zod.def.entries as Record<string, unknown>)).toEqual(["compose","io","satisfy","verify","allocate","relation"]);
  });
  it("traces[]: nimmt an ohne label (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab: label mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":12345,"weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].label: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: nimmt an ohne weight (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab: weight mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":"__falsch__","attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":"__falsch__","created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{},"created_at":"beispiel","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{},"created_at":"beispiel","verified_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab ohne created_at", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: created_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":12345,"verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[].created_at: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"","verified_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"","verified_at":"beispiel"}]});
  });
  it("traces[]: nimmt an ohne verified_at (optional)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel"}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel"}]});
  });
  it("traces[]: lehnt ab: verified_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":12345}]}).success).toBe(false);
  });
  it("traces[].verified_at: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":""}]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":""}]});
  });
  it("traces: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[]})).toEqual({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[]});
  });
});
