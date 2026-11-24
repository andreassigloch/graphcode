// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-test-impact-anfrage → src/kernel/measure/test-selection.ts#TestImpactAnfrageSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { TestImpactAnfrageSchema as S } from '../../src/kernel/measure/test-selection.js';

describe('Vertrag SCHEMA-test-impact-anfrage', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne graph", () => {
    expect(S.safeParse({"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("lehnt ab: graph mit falschem Typ", () => {
    expect(S.safeParse({"graph":"__falsch__","changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"graph":{"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":"__falsch__","edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"graph":{"nodes":["__falsch__"],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[]: lehnt ab ohne uid", () => {
    expect(S.safeParse({"graph":{"nodes":[{"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[]: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":12345,"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: nimmt an ohne description (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__","createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: nimmt an ohne createdAt (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab: createdAt mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":12345,"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].createdAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: nimmt an ohne updatedAt (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes[]: lehnt ab: updatedAt mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":12345}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.nodes[].updatedAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":""}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":""}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.nodes: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph: lehnt ab ohne edges", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":"__falsch__"},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":["__falsch__"]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[]: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[]: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[].sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.edges[]: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[]: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[].targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.edges[]: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[]: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345,"attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[].edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.edges[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.edges[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":"__falsch__"}]},"changeSet":["beispiel"],"depth":0}).success).toBe(false);
  });
  it("graph.edges[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("graph.edges: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[]},"changeSet":["beispiel"],"depth":0});
  });
  it("lehnt ab ohne changeSet", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"depth":0}).success).toBe(false);
  });
  it("lehnt ab: changeSet mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":"__falsch__","depth":0}).success).toBe(false);
  });
  it("changeSet[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":[12345],"depth":0}).success).toBe(false);
  });
  it("changeSet[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":[""],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":[""],"depth":0});
  });
  it("changeSet: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":[],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":[],"depth":0});
  });
  it("nimmt an ohne depth (optional)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"]})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":4});
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":"__falsch__"}).success).toBe(false);
  });
  it("depth: lehnt ab: -1 unter der Untergrenze 0", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":-1}).success).toBe(false);
  });
  it("depth: nimmt 0 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0})).toEqual({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0});
  });
  it("depth: lehnt ab: 0.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0.5}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"graph":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]},"changeSet":["beispiel"],"depth":0,"__zusatz__":1}).success).toBe(false);
  });
});
