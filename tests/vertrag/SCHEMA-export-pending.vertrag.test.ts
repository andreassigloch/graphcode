// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-export-pending → src/kernel/export-pending-contract.ts#ExportPending. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { ExportPending as S } from '../../src/kernel/export-pending-contract.js';

describe('Vertrag SCHEMA-export-pending', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse({"since":"beispiel","versionsBehind":1})).toEqual({"since":"beispiel","versionsBehind":1});
  });
  it("lehnt einen Wert ab, der kein Objekt ist", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
  it("lehnt ab ohne since", () => {
    expect(S.safeParse({"versionsBehind":1}).success).toBe(false);
  });
  it("lehnt ab: since mit falschem Typ", () => {
    expect(S.safeParse({"since":12345,"versionsBehind":1}).success).toBe(false);
  });
  it("since: lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse({"since":"","versionsBehind":1}).success).toBe(false);
  });
  it("since: nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse({"since":"x","versionsBehind":1})).toEqual({"since":"x","versionsBehind":1});
  });
  it("lehnt ab ohne versionsBehind", () => {
    expect(S.safeParse({"since":"beispiel"}).success).toBe(false);
  });
  it("lehnt ab: versionsBehind mit falschem Typ", () => {
    expect(S.safeParse({"since":"beispiel","versionsBehind":"__falsch__"}).success).toBe(false);
  });
  it("versionsBehind: lehnt ab: 0 auf der ausgeschlossenen Untergrenze 0", () => {
    expect(S.safeParse({"since":"beispiel","versionsBehind":0}).success).toBe(false);
  });
  it("versionsBehind: nimmt 1 an (kleinster erlaubter Wert, Untergrenze 0)", () => {
    expect(S.parse({"since":"beispiel","versionsBehind":1})).toEqual({"since":"beispiel","versionsBehind":1});
  });
  it("versionsBehind: lehnt ab: 1.5 ist keine ganze Zahl", () => {
    expect(S.safeParse({"since":"beispiel","versionsBehind":1.5}).success).toBe(false);
  });
});
