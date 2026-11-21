// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-install-result → src/surface/scaffold.ts#InstallResultSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { InstallResultSchema as S } from '../../src/surface/scaffold.js';

interface Z { _zod: { def: Record<string, unknown> } }
const bei = (weg: Array<[string, (string | number)?]>): Z =>
  weg.reduce<Z>((s, [art, k]) => {
    const d = s._zod.def;
    if (art === 'getter') return (d.getter as () => Z)();
    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;
  }, S as unknown as Z);

describe('Vertrag SCHEMA-install-result', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne action", () => {
    expect(S.safeParse({"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: action mit falschem Typ", () => {
    expect(S.safeParse({"action":12345,"repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: action außerhalb des Enums", () => {
    expect(S.safeParse({"action":"__ausserhalb__","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("action: Werteliste unverändert", () => {
    expect(Object.values(bei([["shape","action"]])._zod.def.entries as Record<string, unknown>)).toEqual(["init","update","remove"]);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"action":"init","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":12345,"created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("lehnt ab ohne created", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: created mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":"__falsch__","updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("created[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":[12345],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("created[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":[""],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":[""],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("created: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":[],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":[],"updated":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("lehnt ab ohne updated", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: updated mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":"__falsch__","removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("updated[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[12345],"removed":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("updated[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[""],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[""],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("updated: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[],"removed":["beispiel"],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":[],"removed":["beispiel"],"preserved":["beispiel"]});
  });
  it("lehnt ab ohne removed", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: removed mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":"__falsch__","preserved":["beispiel"]}).success).toBe(false);
  });
  it("removed[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[12345],"preserved":["beispiel"]}).success).toBe(false);
  });
  it("removed[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[""],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[""],"preserved":["beispiel"]});
  });
  it("removed: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[],"preserved":["beispiel"]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":[],"preserved":["beispiel"]});
  });
  it("lehnt ab ohne preserved", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: preserved mit falschem Typ", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":"__falsch__"}).success).toBe(false);
  });
  it("preserved[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[12345]}).success).toBe(false);
  });
  it("preserved[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[""]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[""]});
  });
  it("preserved: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[]})).toEqual({"action":"init","repoRoot":"beispiel","created":["beispiel"],"updated":["beispiel"],"removed":["beispiel"],"preserved":[]});
  });
});
