// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-render-summary → src/surface/render-verb.ts#RenderSummarySchema.
// TEST-vertrag-render-summary
import { describe, it, expect } from 'vitest';
import { RenderSummarySchema as S } from '../../src/surface/render-verb.js';

const zusammenfassung = { view: 'srs', format: 'pdf', out: '/tmp/srs.pdf', bytes: 1234, vorlage: 'docs/vorlagen/srs.css' };

describe('Vertrag SCHEMA-render-summary: Wertregeln', () => {
  it('nimmt jedes Format und eine Zusammenfassung ohne Vorlage (null) an', () => {
    for (const format of ['md', 'docx', 'pdf']) expect(S.safeParse({ ...zusammenfassung, format }).success).toBe(true);
    expect(S.safeParse({ ...zusammenfassung, vorlage: null }).success).toBe(true);
  });
  it('lehnt ein unbekanntes Format und eine unbekannte Sicht ab', () => {
    expect(S.safeParse({ ...zusammenfassung, format: 'html' }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, view: 'gibt-es-nicht' }).success).toBe(false);
  });
  it('lehnt negative und gebrochene Größen ab; eine leere Datei (0) gilt', () => {
    expect(S.safeParse({ ...zusammenfassung, bytes: -1 }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, bytes: 1.5 }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, bytes: 0 }).success).toBe(true);
  });
  it('lehnt einen leeren Pfad und eine leere Vorlage ab; undefined statt null gilt nicht', () => {
    expect(S.safeParse({ ...zusammenfassung, out: '' }).success).toBe(false);
    expect(S.safeParse({ ...zusammenfassung, vorlage: '' }).success).toBe(false);
    const { vorlage: _v, ...ohne } = zusammenfassung;
    expect(S.safeParse(ohne).success).toBe(false);
  });
});
