// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-ontology-graph → packages/contracts/src/se/ontology.ts#OntologyGraph. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { OntologyGraph as S } from '@sigloch/contracts/se';

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
  it("elements[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":12345,"name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: type außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"__ausserhalb__","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":12345,"description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab ohne description", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":12345,"method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: method mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":12345,"kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: method außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"__ausserhalb__","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: kinds mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":"__falsch__","attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
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
  it("elements[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":"__falsch__","status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: status mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":12345,"created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: status außerhalb des Enums", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"__ausserhalb__","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab ohne created_at", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: created_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":12345,"updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("elements[]: lehnt ab: updated_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":12345}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
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
  it("traces[]: lehnt ab ohne target", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: target mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":12345,"type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
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
  it("traces[]: lehnt ab: label mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":12345,"weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: weight mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":"__falsch__","attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":"__falsch__","created_at":"beispiel","verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab ohne created_at", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: created_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":12345,"verified_at":"beispiel"}]}).success).toBe(false);
  });
  it("traces[]: lehnt ab: verified_at mit falschem Typ", () => {
    expect(S.safeParse({"elements":[{"id":"beispiel","type":"SYS","name":"beispiel","description":"beispiel","method":"test","kinds":["functional"],"attributes":{"beispiel":"beliebig"},"status":"draft","created_at":"beispiel","updated_at":"beispiel"}],"traces":[{"source":"beispiel","target":"beispiel","type":"compose","label":"beispiel","weight":1,"attributes":{"beispiel":"beliebig"},"created_at":"beispiel","verified_at":12345}]}).success).toBe(false);
  });
});
