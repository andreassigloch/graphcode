// erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-schema-fingerprint → src/kernel/schema-fingerprint-contract.ts#SchemaFingerprintSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { SchemaFingerprintSchema as S } from '../../src/kernel/schema-fingerprint-contract.js';

describe('Vertrag SCHEMA-schema-fingerprint', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("0000000000000000")).toEqual("0000000000000000");
  });
  it("lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse(12345).success).toBe(false);
  });
  it("lehnt ab: Text verletzt die Regel /^[0-9a-f]{16}$/", () => {
    expect(S.safeParse("!").success).toBe(false);
  });
});
