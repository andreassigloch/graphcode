// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-repo-pfad → src/surface/repo-pfad-contract.ts#RepoPfadSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { RepoPfadSchema as S } from '../../src/surface/repo-pfad-contract.js';

describe('Vertrag SCHEMA-repo-pfad', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("beispiel")).toEqual("beispiel");
  });
  it("lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse(12345).success).toBe(false);
  });
  it("lehnt ab: Text mit 0 Zeichen (unter der Mindestlänge 1)", () => {
    expect(S.safeParse("").success).toBe(false);
  });
  it("nimmt Text mit 1 Zeichen an (Untergrenze)", () => {
    expect(S.parse("x")).toEqual("x");
  });
});
