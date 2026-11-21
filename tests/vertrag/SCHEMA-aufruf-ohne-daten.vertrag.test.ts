// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-aufruf-ohne-daten → src/surface/aufruf-ohne-daten-contract.ts#AufrufOhneDatenSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { AufrufOhneDatenSchema as S } from '../../src/surface/aufruf-ohne-daten-contract.js';

describe('Vertrag SCHEMA-aufruf-ohne-daten', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse(undefined)).toEqual(undefined);
  });
  it("lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse("__falsch__").success).toBe(false);
  });
});
