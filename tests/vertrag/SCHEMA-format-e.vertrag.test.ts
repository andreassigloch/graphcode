// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-format-e → packages/graph-api-core/src/format-e-door.ts#FormatEInputSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { FormatEInputSchema as S } from '@sigloch/graph-api-core';

describe('Vertrag SCHEMA-format-e', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne text", () => {
    expect(S.safeParse({"bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("lehnt ab: text mit falschem Typ", () => {
    expect(S.safeParse({"text":12345,"bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("text: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("lehnt ab ohne bestand", () => {
    expect(S.safeParse({"text":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: bestand mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":"__falsch__"}).success).toBe(false);
  });
  it("bestand: lehnt ab ohne nodes", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand: lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":"__falsch__","edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":["__falsch__"],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[]: lehnt ab ohne uid", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[]: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":12345,"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: nimmt an ohne description (optional)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__","createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: nimmt an ohne createdAt (optional)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab: createdAt mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":12345,"updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].createdAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: nimmt an ohne updatedAt (optional)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes[]: lehnt ab: updatedAt mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":12345}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.nodes[].updatedAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":""}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":""}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.nodes: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand: lehnt ab ohne edges", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}]}}).success).toBe(false);
  });
  it("bestand: lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":"__falsch__"}}).success).toBe(false);
  });
  it("bestand.edges[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":["__falsch__"]}}).success).toBe(false);
  });
  it("bestand.edges[]: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[]: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[].sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.edges[]: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[]: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[].targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.edges[]: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[]: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345,"attributes":{"beispiel":"beliebig"}}]}}).success).toBe(false);
  });
  it("bestand.edges[].edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]}});
  });
  it("bestand.edges[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]}});
  });
  it("bestand.edges[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":"__falsch__"}]}}).success).toBe(false);
  });
  it("bestand.edges[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]}});
  });
  it("bestand.edges: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[]}})).toEqual({"text":"beispiel","bestand":{"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel"}],"edges":[]}});
  });
});
