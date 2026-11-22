// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-mutate-command → packages/contracts/src/harness/index.ts#MutateCommandSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { MutateCommandSchema as S } from '@sigloch/contracts/harness';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-mutate-command', () => {
  it("Variante 1: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1: lehnt ab ohne op", () => {
    expect(S.safeParse({"node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",0],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["add-node"]);
  });
  it("Variante 1: lehnt ab ohne node", () => {
    expect(S.safeParse({"op":"add-node"}).success).toBe(false);
  });
  it("Variante 1: lehnt ab: node mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":"__falsch__"}).success).toBe(false);
  });
  it("Variante 1.node: lehnt ab ohne uid", () => {
    expect(S.safeParse({"op":"add-node","node":{"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":12345,"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node.uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1.node: lehnt ab ohne type", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node.type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1.node: lehnt ab ohne name", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node.name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1.node: nimmt an ohne description (optional)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1.node: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 1.node.description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 1.node: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{}}});
  });
  it("Variante 1.node: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__"}}).success).toBe(false);
  });
  it("Variante 1.node.attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{}}})).toEqual({"op":"add-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{}}});
  });
  it("Variante 2: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2: lehnt ab ohne op", () => {
    expect(S.safeParse({"node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",1],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["update-node"]);
  });
  it("Variante 2: lehnt ab ohne node", () => {
    expect(S.safeParse({"op":"update-node"}).success).toBe(false);
  });
  it("Variante 2: lehnt ab: node mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":"__falsch__"}).success).toBe(false);
  });
  it("Variante 2.node: lehnt ab ohne uid", () => {
    expect(S.safeParse({"op":"update-node","node":{"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.node: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":{"uid":12345,"type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.node.uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: nimmt an ohne type (optional)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: lehnt ab: type mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":{"uid":"beispiel","type":12345,"name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.node.type: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"","name":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: nimmt an ohne name (optional)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":12345,"description":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.node.name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"","description":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: nimmt an ohne description (optional)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: lehnt ab: description mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":12345,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 2.node.description: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 2.node: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel"}});
  });
  it("Variante 2.node: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":"__falsch__"}}).success).toBe(false);
  });
  it("Variante 2.node.attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{}}})).toEqual({"op":"update-node","node":{"uid":"beispiel","type":"beispiel","name":"beispiel","description":"beispiel","attributes":{}}});
  });
  it("Variante 3: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"delete-node","uid":"beispiel"})).toEqual({"op":"delete-node","uid":"beispiel"});
  });
  it("Variante 3: lehnt ab ohne op", () => {
    expect(S.safeParse({"uid":"beispiel"}).success).toBe(false);
  });
  it("Variante 3: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"uid":"beispiel"}).success).toBe(false);
  });
  it("Variante 3: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","uid":"beispiel"}).success).toBe(false);
  });
  it("Variante 3.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",2],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["delete-node"]);
  });
  it("Variante 3: lehnt ab ohne uid", () => {
    expect(S.safeParse({"op":"delete-node"}).success).toBe(false);
  });
  it("Variante 3: lehnt ab: uid mit falschem Typ", () => {
    expect(S.safeParse({"op":"delete-node","uid":12345}).success).toBe(false);
  });
  it("Variante 3.uid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"delete-node","uid":""})).toEqual({"op":"delete-node","uid":""});
  });
  it("Variante 4: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 4: lehnt ab ohne op", () => {
    expect(S.safeParse({"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",3],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["add-edge"]);
  });
  it("Variante 4: lehnt ab ohne edge", () => {
    expect(S.safeParse({"op":"add-edge"}).success).toBe(false);
  });
  it("Variante 4: lehnt ab: edge mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-edge","edge":"__falsch__"}).success).toBe(false);
  });
  it("Variante 4.edge: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge.sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 4.edge: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":"beispiel","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge.targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 4.edge: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 4.edge.edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 4.edge: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}})).toEqual({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}});
  });
  it("Variante 4.edge: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":"__falsch__"}}).success).toBe(false);
  });
  it("Variante 4.edge.attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}})).toEqual({"op":"add-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel","attributes":{}}});
  });
  it("Variante 5: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}})).toEqual({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}});
  });
  it("Variante 5: lehnt ab ohne op", () => {
    expect(S.safeParse({"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",4],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["delete-edge"]);
  });
  it("Variante 5: lehnt ab ohne edge", () => {
    expect(S.safeParse({"op":"delete-edge"}).success).toBe(false);
  });
  it("Variante 5: lehnt ab: edge mit falschem Typ", () => {
    expect(S.safeParse({"op":"delete-edge","edge":"__falsch__"}).success).toBe(false);
  });
  it("Variante 5.edge: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.edge: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.edge.sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"delete-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel"}})).toEqual({"op":"delete-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel"}});
  });
  it("Variante 5.edge: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"sourceId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.edge: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.edge.targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel"}})).toEqual({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel"}});
  });
  it("Variante 5.edge: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel"}}).success).toBe(false);
  });
  it("Variante 5.edge: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345}}).success).toBe(false);
  });
  it("Variante 5.edge.edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":""}})).toEqual({"op":"delete-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":""}});
  });
  it("Variante 6: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6: lehnt ab ohne op", () => {
    expect(S.safeParse({"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",5],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["update-edge"]);
  });
  it("Variante 6: lehnt ab ohne edge", () => {
    expect(S.safeParse({"op":"update-edge","set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6: lehnt ab: edge mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":"__falsch__","set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge: lehnt ab ohne sourceId", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge: lehnt ab: sourceId mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":12345,"targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge.sourceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6.edge: lehnt ab ohne targetId", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge: lehnt ab: targetId mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":12345,"edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge.targetId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6.edge: lehnt ab ohne edgeType", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":12345},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.edge.edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":""},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":""},"set":{"edgeType":"beispiel","flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6: lehnt ab ohne set", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"}}).success).toBe(false);
  });
  it("Variante 6: lehnt ab: set mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":"__falsch__"}).success).toBe(false);
  });
  it("Variante 6.set: nimmt an ohne edgeType (optional)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6.set: lehnt ab: edgeType mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":12345,"flip":true,"attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.set.edgeType: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"","flip":true,"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"","flip":true,"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6.set: nimmt an ohne flip (optional)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 6.set: lehnt ab: flip mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":"__falsch__","attributes":{"beispiel":"beliebig"}}}).success).toBe(false);
  });
  it("Variante 6.set: nimmt an ohne attributes (optional)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true}});
  });
  it("Variante 6.set: lehnt ab: attributes mit falschem Typ", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":"__falsch__"}}).success).toBe(false);
  });
  it("Variante 6.set.attributes: nimmt einen leeren Record an", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel","flip":true,"attributes":{}}});
  });
  it("Variante 6.set: lehnt ab: keines von edgeType, flip, attributes gesetzt", () => {
    expect(S.safeParse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{}}).success).toBe(false);
  });
  it("Variante 6.set: nimmt an: nur edgeType gesetzt (mindestens eines von edgeType, flip, attributes)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel"}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"edgeType":"beispiel"}});
  });
  it("Variante 6.set: nimmt an: nur flip gesetzt (mindestens eines von edgeType, flip, attributes)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"flip":true}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"flip":true}});
  });
  it("Variante 6.set: nimmt an: nur attributes gesetzt (mindestens eines von edgeType, flip, attributes)", () => {
    expect(S.parse({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"attributes":{"beispiel":"beliebig"}}})).toEqual({"op":"update-edge","edge":{"sourceId":"beispiel","targetId":"beispiel","edgeType":"beispiel"},"set":{"attributes":{"beispiel":"beliebig"}}});
  });
  it("Variante 7: nimmt das Beispiel an", () => {
    expect(S.parse({"op":"merge-nodes","sourceUid":"beispiel","targetUid":"beispiel"})).toEqual({"op":"merge-nodes","sourceUid":"beispiel","targetUid":"beispiel"});
  });
  it("Variante 7: lehnt ab ohne op", () => {
    expect(S.safeParse({"sourceUid":"beispiel","targetUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7: lehnt ab: op mit falschem Typ", () => {
    expect(S.safeParse({"op":12345,"sourceUid":"beispiel","targetUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7: lehnt ab: op außerhalb des Enums", () => {
    expect(S.safeParse({"op":"__ausserhalb__","sourceUid":"beispiel","targetUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7.op: Werteliste unverändert", () => {
    expect(Object.values(bei([["options",6],["shape","op"]])._zod.def.values as Record<string, unknown>)).toEqual(["merge-nodes"]);
  });
  it("Variante 7: lehnt ab ohne sourceUid", () => {
    expect(S.safeParse({"op":"merge-nodes","targetUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7: lehnt ab: sourceUid mit falschem Typ", () => {
    expect(S.safeParse({"op":"merge-nodes","sourceUid":12345,"targetUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7.sourceUid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"merge-nodes","sourceUid":"","targetUid":"beispiel"})).toEqual({"op":"merge-nodes","sourceUid":"","targetUid":"beispiel"});
  });
  it("Variante 7: lehnt ab ohne targetUid", () => {
    expect(S.safeParse({"op":"merge-nodes","sourceUid":"beispiel"}).success).toBe(false);
  });
  it("Variante 7: lehnt ab: targetUid mit falschem Typ", () => {
    expect(S.safeParse({"op":"merge-nodes","sourceUid":"beispiel","targetUid":12345}).success).toBe(false);
  });
  it("Variante 7.targetUid: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"op":"merge-nodes","sourceUid":"beispiel","targetUid":""})).toEqual({"op":"merge-nodes","sourceUid":"beispiel","targetUid":""});
  });
});
