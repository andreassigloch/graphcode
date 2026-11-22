// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-lock-owner → src/kernel/lock-owner-contract.ts#LockOwner. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { LockOwner as S } from '../../src/kernel/lock-owner-contract.js';

describe('Vertrag SCHEMA-lock-owner', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne pid", () => {
    expect(S.safeParse({"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: pid mit falschem Typ", () => {
    expect(S.safeParse({"pid":"__falsch__","hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("pid: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"pid":0,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("pid: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("pid: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"pid":1.5,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab ohne hostname", () => {
    expect(S.safeParse({"pid":1,"startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: hostname mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":12345,"startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("hostname: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"pid":1,"hostname":"","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("hostname: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"x","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"x","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("lehnt ab ohne startedAt", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("lehnt ab: startedAt mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":12345,"version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("startedAt: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("startedAt: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"x","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"x","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("nimmt an ohne version (optional)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("lehnt ab: version mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":12345,"boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("version: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("nimmt an ohne boot (optional)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel"})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel"});
  });
  it("lehnt ab: boot mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":"__falsch__"}).success).toBe(false);
  });
  it("boot: lehnt ab ohne codeRoot", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("boot: lehnt ab: codeRoot mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":12345,"codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("boot.codeRoot: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"","codeMtimeMs":1,"contracts":"beispiel"}}).success).toBe(false);
  });
  it("boot.codeRoot: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"x","codeMtimeMs":1,"contracts":"beispiel"}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"x","codeMtimeMs":1,"contracts":"beispiel"}});
  });
  it("boot: lehnt ab ohne codeMtimeMs", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","contracts":"beispiel"}}).success).toBe(false);
  });
  it("boot: lehnt ab: codeMtimeMs mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":"__falsch__","contracts":"beispiel"}}).success).toBe(false);
  });
  it("boot: nimmt an ohne contracts (optional)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1}});
  });
  it("boot: lehnt ab: contracts mit falschem Typ", () => {
    expect(S.safeParse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":12345}}).success).toBe(false);
  });
  it("boot.contracts: nimmt Text mit 0 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":""}})).toEqual({"pid":1,"hostname":"beispiel","startedAt":"beispiel","version":"beispiel","boot":{"codeRoot":"beispiel","codeMtimeMs":1,"contracts":""}});
  });
});
