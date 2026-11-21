// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-upgrade-report → src/surface/upgrade.ts#UpgradeReportSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { UpgradeReportSchema as S } from '../../src/surface/upgrade.js';

describe('Vertrag SCHEMA-upgrade-report', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne target", () => {
    expect(S.safeParse({"cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: target mit falschem Typ", () => {
    expect(S.safeParse({"target":12345,"cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("target: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne cli", () => {
    expect(S.safeParse({"target":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: cli mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":12345,"repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("cli: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("nimmt an ohne repoBefore (optional)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab: repoBefore mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":12345,"repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("repoBefore: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("nimmt an ohne repoAfter (optional)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab: repoAfter mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":12345,"hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("repoAfter: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("nimmt an ohne hostBefore (optional)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab: hostBefore mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":12345,"drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("hostBefore: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne drift", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: drift mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":"__falsch__","missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab ohne missingSkills", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: missingSkills mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":"__falsch__","staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("missingSkills[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":[12345],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("missingSkills[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":[""],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":[""],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("missingSkills: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":[],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":[],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne staleSkills", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: staleSkills mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":"__falsch__","missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleSkills[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":[12345],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleSkills[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":[""],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":[""],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("staleSkills: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":[],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":[],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne missingPolicy", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: missingPolicy mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":"__falsch__","staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("missingPolicy[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":[12345],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("missingPolicy[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":[""],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":[""],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("missingPolicy: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":[],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":[],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne staleDeps", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: staleDeps mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":"__falsch__","depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[]: lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":["__falsch__"],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[]: lehnt ab ohne name", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[]: lehnt ab: name mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":12345,"current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[].name: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("staleDeps[]: lehnt ab ohne current", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[]: lehnt ab: current mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":12345,"wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[].current: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("staleDeps[]: lehnt ab ohne wanted", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[]: lehnt ab: wanted mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":12345}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("staleDeps[].wanted: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":""}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":""}],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("staleDeps: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[],"depsChecked":true,"steps":["beispiel"],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[],"depsChecked":true,"steps":["beispiel"],"hostStopped":true});
  });
  it("lehnt ab ohne depsChecked", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: depsChecked mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":"__falsch__","steps":["beispiel"],"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab ohne steps", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"hostStopped":true}).success).toBe(false);
  });
  it("lehnt ab: steps mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":"__falsch__","hostStopped":true}).success).toBe(false);
  });
  it("steps[]: lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":[12345],"hostStopped":true}).success).toBe(false);
  });
  it("steps[]: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":[""],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":[""],"hostStopped":true});
  });
  it("steps: nimmt Liste mit 0 Elementen an (Untergrenze)", () => {
    expect(S.parse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":[],"hostStopped":true})).toEqual({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":[],"hostStopped":true});
  });
  it("lehnt ab ohne hostStopped", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"]}).success).toBe(false);
  });
  it("lehnt ab: hostStopped mit falschem Typ", () => {
    expect(S.safeParse({"target":"beispiel","cli":"beispiel","repoBefore":"beispiel","repoAfter":"beispiel","hostBefore":"beispiel","drift":true,"missingSkills":["beispiel"],"staleSkills":["beispiel"],"missingPolicy":["beispiel"],"staleDeps":[{"name":"beispiel","current":"beispiel","wanted":"beispiel"}],"depsChecked":true,"steps":["beispiel"],"hostStopped":"__falsch__"}).success).toBe(false);
  });
});
