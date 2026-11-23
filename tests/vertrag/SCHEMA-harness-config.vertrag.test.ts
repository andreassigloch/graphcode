// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-harness-config → packages/contracts/src/harness/index.ts#HarnessConfigSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { HarnessConfigSchema as S } from '@sigloch/contracts/harness';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-harness-config', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1})).toEqual({"repoRoot":"","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1});
  });
  it("lehnt ab ohne scope", () => {
    expect(S.safeParse({"repoRoot":"beispiel","consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("lehnt ab: scope mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":"__falsch__","consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("scope: lehnt ab ohne workspaceId", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("scope: lehnt ab: workspaceId mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":12345,"systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("scope.workspaceId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1});
  });
  it("scope: lehnt ab ohne systemId", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel"},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("scope: lehnt ab: systemId mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":12345},"consumerType":"human","preCommitTimeout":1}).success).toBe(false);
  });
  it("scope.systemId: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":""},"consumerType":"human","preCommitTimeout":1})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":""},"consumerType":"human","preCommitTimeout":1});
  });
  it("nimmt an ohne consumerType (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"preCommitTimeout":1})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"agent","preCommitTimeout":1});
  });
  it("lehnt ab: consumerType mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":12345,"preCommitTimeout":1}).success).toBe(false);
  });
  it("lehnt ab: consumerType außerhalb des Enums", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"__ausserhalb__","preCommitTimeout":1}).success).toBe(false);
  });
  it("consumerType: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","consumerType"],["innerType"]])._zod.def.entries as Record<string, unknown>)).toEqual(["human","agent","system"]);
  });
  it("nimmt an ohne preCommitTimeout (optional)", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human"})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":5000});
  });
  it("lehnt ab: preCommitTimeout mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":"__falsch__"}).success).toBe(false);
  });
  it("preCommitTimeout: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":0}).success).toBe(false);
  });
  it("preCommitTimeout: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1})).toEqual({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1});
  });
  it("preCommitTimeout: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"repoRoot":"beispiel","scope":{"workspaceId":"beispiel","systemId":"beispiel"},"consumerType":"human","preCommitTimeout":1.5}).success).toBe(false);
  });
});
