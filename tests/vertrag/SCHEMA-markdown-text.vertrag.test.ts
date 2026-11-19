// erzeugt aus dem Modell (graphanalyze/werkzeuge/vertragstest) — SCHEMA-markdown-text → src/projections/exporter.ts#MarkdownTextSchema. Nicht von Hand ändern, neu erzeugen.
import { describe, it, expect } from 'vitest';
import { MarkdownTextSchema as S } from '../../src/projections/exporter.js';

describe('Vertrag SCHEMA-markdown-text', () => {
  it("nimmt das Beispiel an", () => {
    expect(S.parse("beispiel")).toEqual("beispiel");
  });
  it("lehnt einen Wert vom falschen Typ ab", () => {
    expect(S.safeParse(12345).success).toBe(false);
  });
});
