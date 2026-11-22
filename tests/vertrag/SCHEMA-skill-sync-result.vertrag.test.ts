// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-skill-sync-result → src/surface/scaffold.ts#SkillSyncResultSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SkillSyncResultSchema as S } from '../../src/surface/scaffold.js';

describe('Vertrag SCHEMA-skill-sync-result', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("lehnt ab ohne added", () => {
    expect(S.safeParse({"repoRoot":"beispiel","updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: added mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":"__falsch__","updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("added[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":[12345],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("added[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":[""],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":[""],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("added: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":[],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":[],"updated":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("lehnt ab ohne updated", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: updated mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":"__falsch__","unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("updated[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":[12345],"unchanged":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("updated[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":[""],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":[""],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("updated: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":[],"unchanged":["beispiel"],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":[],"unchanged":["beispiel"],"removed":["beispiel"]});
  });
  it("lehnt ab ohne unchanged", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"removed":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: unchanged mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":"__falsch__","removed":["beispiel"]}).success).toBe(false);
  });
  it("unchanged[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":[12345],"removed":["beispiel"]}).success).toBe(false);
  });
  it("unchanged[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":[""],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":[""],"removed":["beispiel"]});
  });
  it("unchanged: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":[],"removed":["beispiel"]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":[],"removed":["beispiel"]});
  });
  it("lehnt ab ohne removed", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: removed mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":"__falsch__"}).success).toBe(false);
  });
  it("removed[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":[12345]}).success).toBe(false);
  });
  it("removed[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":[""]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":[""]});
  });
  it("removed: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":[]})).toEqual({"repoRoot":"beispiel","added":["beispiel"],"updated":["beispiel"],"unchanged":["beispiel"],"removed":[]});
  });
});
