// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-impact-slice → packages/graph-api-core/src/impact-slice.ts#ImpactSliceSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ImpactSliceSchema as S } from '@sigloch/graph-api-core';

describe('Vertrag SCHEMA-impact-slice', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne seeds", () => {
    expect(S.safeParse({"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab: seeds mit falschem Typ", () => {
    expect(S.safeParse({"seeds":"__falsch__","depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("seeds[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"seeds":[12345],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab ohne depth", () => {
    expect(S.safeParse({"seeds":["beispiel"],"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab: depth mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":"__falsch__","nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab ohne nodes", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab: nodes mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":"__falsch__","edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":["__falsch__"],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab ohne uid", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":12345,"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__","createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: createdAt mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":12345,"updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: updatedAt mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":12345,"role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab ohne role", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: role mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":12345,"distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: role außerhalb des Enums", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"__ausserhalb__","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab ohne distance", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: distance mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":"__falsch__"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("lehnt ab ohne edges", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}]}).success).toBe(false);
  });
  it("lehnt ab: edges mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":"__falsch__"}).success).toBe(false);
  });
  it("edges[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":["__falsch__"]}).success).toBe(false);
  });
  it("edges[]: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345,"attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":"__falsch__"}]}).success).toBe(false);
  });
});
