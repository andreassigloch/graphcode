// Von Hand ergänzt: Wertregeln und Grenzfälle, die der Generator nicht ableitet (er prüft Pflichtfeld, Typ, Enum und Zusatzfeld auf jeder Ebene, CR-GC-980) — SCHEMA-export-answer → src/projections/export.ts#GraphExportAnswerSchema.
// TEST-vertrag-export-answer
import { describe, it, expect } from 'vitest';
import { GraphExportAnswerSchema as S } from '../../src/projections/export.js';

const antwort = {
  graphJson: { path: 'docs/graph/x.graph.json', bytes: 10, nodes: 2, edges: 1 },
  views: [{ view: 'architecture', path: 'docs/views/architecture.md', bytes: 5 }],
  stubs: [] as string[],
};

describe('Vertrag SCHEMA-export-answer: Wertregeln', () => {
  it('nimmt die Antwort ohne unfedMutations und mit leeren Listen an', () => {
    expect(S.parse({ ...antwort, views: [] })).toEqual({ ...antwort, views: [] });
  });
  it('nimmt unfedMutations ab 1 an', () => {
    expect(S.parse({ ...antwort, unfedMutations: 1 }).unfedMutations).toBe(1);
  });
  it('lehnt unfedMutations 0 ab: die Zahl steht nur, wenn sie größer als 0 ist', () => {
    expect(S.safeParse({ ...antwort, unfedMutations: 0 }).success).toBe(false);
  });
  it('lehnt negative Bytes in graphJson ab', () => {
    expect(S.safeParse({ ...antwort, graphJson: { ...antwort.graphJson, bytes: -1 } }).success).toBe(false);
  });
  it('lehnt einen leeren Sicht-Pfad ab', () => {
    expect(S.safeParse({ ...antwort, views: [{ view: 'srs', path: '', bytes: 1 }] }).success).toBe(false);
  });
  it('lehnt einen leeren Stub-Pfad ab', () => {
    expect(S.safeParse({ ...antwort, stubs: [''] }).success).toBe(false);
  });
});
