// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-init-report → src/surface/init-verb.ts#InitReportSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { InitReportSchema as S } from '../../src/surface/init-verb.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-init-report', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne result", () => {
    expect(S.safeParse({"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: result mit falschem Typ", () => {
    expect(S.safeParse({"result":"__falsch__","installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab ohne action", () => {
    expect(S.safeParse({"result":{"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: action mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":12345,"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: action außerhalb des Enums", () => {
    expect(S.safeParse({"result":{"action":"__ausserhalb__","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.action: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","result"],["shape","action"]])._zod.def.entries as Record<string, unknown>)).toEqual(["init","update","remove"]);
  });
  it("result: lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"result":{"action":"init","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":12345,"created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result: lehnt ab ohne created", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: created mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":"__falsch__","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.created[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":[12345],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.created[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":[""],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":[""],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result.created: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":[],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":[],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result: lehnt ab ohne updated", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: updated mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":"__falsch__","removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.updated[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[12345],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.updated[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[""],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[""],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result.updated: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result: lehnt ab ohne removed", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: removed mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":"__falsch__","preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.removed[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[12345],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.removed[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[""],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[""],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result.removed: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result: lehnt ab ohne preserved", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result: lehnt ab: preserved mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":"__falsch__"},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.preserved[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[12345]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("result.preserved[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[""]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[""]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("result.preserved: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("lehnt ab ohne installCommand", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installCommand mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":12345,"installOk":true,"installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("installCommand: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"","installOk":true,"installError":"beispiel","agentHosts":["beispiel"]});
  });
  it("lehnt ab ohne installOk", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installOk mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":"__falsch__","installError":"beispiel","agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab ohne installError", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: installError mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":12345,"agentHosts":["beispiel"]}).success).toBe(false);
  });
  it("installError: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"","agentHosts":["beispiel"]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"","agentHosts":["beispiel"]});
  });
  it("lehnt ab ohne agentHosts", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: agentHosts mit falschem Typ", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":"__falsch__"}).success).toBe(false);
  });
  it("agentHosts[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":[12345]}).success).toBe(false);
  });
  it("agentHosts[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":[""]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":[""]});
  });
  it("agentHosts: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":[]})).toEqual({"result":{"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]},"installCommand":"beispiel","installOk":true,"installError":"beispiel","agentHosts":[]});
  });
});
