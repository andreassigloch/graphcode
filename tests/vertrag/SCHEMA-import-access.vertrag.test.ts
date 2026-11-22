// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-import-access → src/kernel/harness-import.ts#ImportTargetSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ImportTargetSchema as S } from '../../src/kernel/harness-import.js';

const fn = (): number => 1;

describe('Vertrag SCHEMA-import-access', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"repoRoot":"beispiel","systemId":"beispiel","replace":fn,"clear":fn})).toEqual({"repoRoot":"beispiel","systemId":"beispiel","replace":expect.any(Function),"clear":expect.any(Function)});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne repoRoot", () => {
    expect(S.safeParse({"systemId":"beispiel","replace":fn,"clear":fn}).success).toBe(false);
  });
  it("lehnt ab: repoRoot mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":12345,"systemId":"beispiel","replace":fn,"clear":fn}).success).toBe(false);
  });
  it("repoRoot: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"repoRoot":"","systemId":"beispiel","replace":fn,"clear":fn}).success).toBe(false);
  });
  it("repoRoot: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"x","systemId":"beispiel","replace":fn,"clear":fn})).toEqual({"repoRoot":"x","systemId":"beispiel","replace":expect.any(Function),"clear":expect.any(Function)});
  });
  it("lehnt ab ohne systemId", () => {
    expect(S.safeParse({"repoRoot":"beispiel","replace":fn,"clear":fn}).success).toBe(false);
  });
  it("lehnt ab: systemId mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":12345,"replace":fn,"clear":fn}).success).toBe(false);
  });
  it("systemId: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"","replace":fn,"clear":fn}).success).toBe(false);
  });
  it("systemId: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"repoRoot":"beispiel","systemId":"x","replace":fn,"clear":fn})).toEqual({"repoRoot":"beispiel","systemId":"x","replace":expect.any(Function),"clear":expect.any(Function)});
  });
  it("lehnt ab ohne replace", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"beispiel","clear":fn}).success).toBe(false);
  });
  it("lehnt ab: replace mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"beispiel","replace":"__falsch__","clear":fn}).success).toBe(false);
  });
  it("lehnt ab ohne clear", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"beispiel","replace":fn}).success).toBe(false);
  });
  it("lehnt ab: clear mit falschem Typ", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"beispiel","replace":fn,"clear":"__falsch__"}).success).toBe(false);
  });
  it("lehnt ab: unbekanntes Zusatzfeld", () => {
    expect(S.safeParse({"repoRoot":"beispiel","systemId":"beispiel","replace":fn,"clear":fn,"__zusatz__":1}).success).toBe(false);
  });
});
