// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-impact-slice → packages/graph-api-core/src/impact-slice.ts#ImpactSliceSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ImpactSliceSchema as S } from '@sigloch/graph-api-core';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

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
  it("seeds[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":[""],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":[""],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("seeds: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"seeds":[],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":[],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
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
  it("nodes[].uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab ohne type", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: nimmt an ohne description (optional)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__","createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: nimmt an ohne createdAt (optional)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab: createdAt mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":12345,"updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].createdAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: nimmt an ohne updatedAt (optional)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("nodes[]: lehnt ab: updatedAt mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":12345,"role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[].updatedAt: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
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
  it("nodes[].role: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","nodes"],["element"],["shape","role"]])._zod.def.entries as Record<string, unknown>)).toEqual(["seed","whitebox","blackbox"]);
  });
  it("nodes[]: lehnt ab ohne distance", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes[]: lehnt ab: distance mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":"__falsch__"}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("nodes: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
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
  it("edges[].sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("edges[]: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[].targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}]});
  });
  it("edges[]: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[]: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345,"attributes":{"beispiel":"beliebig"}}]}).success).toBe(false);
  });
  it("edges[].edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}]});
  });
  it("edges[]: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]});
  });
  it("edges[]: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":"__falsch__"}]}).success).toBe(false);
  });
  it("edges[].attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}]});
  });
  it("edges: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[]})).toEqual({"seeds":["beispiel"],"depth":1,"nodes":[{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"},"createdAt":"beispiel","updatedAt":"beispiel","role":"seed","distance":1}],"edges":[]});
  });
});
