/**
 * helfer-vertraege.test.ts — die Vertraege der drei Executor-Helfer (CR-GC-773).
 *
 * Faltung, Fund-Kontext und Dublettensuche waren Funktionen ohne eigenen Vertrag: ihr Ergebnis
 * war ein TypeScript-Typ, im Modell gab es dafuer keinen Fluss, und die Kette des Executors war
 * deshalb nicht bewertbar. Hier steht je Helfer: das echte Ergebnis kommt durch sein Schema, ein
 * Ergebnis mit fehlendem Feld wird abgewiesen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { faltung, Faltung } from '../src/loop/faltung.js';
import { fundKontext, FundKontext } from '../src/loop/fund-kontext.js';
import { duplicateHits, DuplicateHit } from '../src/kernel/measure/nd-similarity.js';

const KNOTEN = [
  { uid: 'UC-a', type: 'UC', name: 'Anwendungsfall A' },
  { uid: 'REQ-a1', type: 'REQ', name: 'Messwert wird alle fuenf Minuten gelesen', description: 'Der Messwert wird alle fuenf Minuten gelesen.' },
  { uid: 'FCHAIN-a', type: 'FCHAIN', name: 'Kette A' },
  { uid: 'FUNC-a1', type: 'FUNC', name: 'lesen' },
];
const KANTEN = [
  { sourceId: 'UC-a', targetId: 'REQ-a1', edgeType: 'compose' },
  { sourceId: 'UC-a', targetId: 'FCHAIN-a', edgeType: 'compose' },
  { sourceId: 'FCHAIN-a', targetId: 'FUNC-a1', edgeType: 'compose' },
];

describe('Vertraege der Executor-Helfer (CR-GC-773)', () => {
  it('Faltung: die gefaltete Sicht kommt durch ihr Schema, ohne Index nicht', () => {
    const f = faltung(KNOTEN, KANTEN, ['REQ-a1']);
    expect(f.offen.map((n) => n.uid)).toContain('REQ-a1');
    expect(Faltung.parse(f)).toEqual(f);
    expect(Faltung.safeParse({ offen: f.offen, box: f.box, kanten: f.kanten }).success).toBe(false);
  });

  it('Fund-Kontext: die Auswahl kommt durch ihr Schema, ohne die Liste der Waisen nicht', () => {
    const r = fundKontext({ nodes: KNOTEN, edges: KANTEN }, ['REQ-a1'], ['FUNC']);
    expect(r.knoten.map((n) => n.uid)).toEqual(['FUNC-a1']);
    expect(FundKontext.parse(r)).toEqual(r);
    expect(FundKontext.safeParse({ knoten: r.knoten }).success).toBe(false);
  });

  it('Dublettensuche: jeder Treffer kommt durch sein Schema, ein Treffer ohne Gegenstueck nicht', () => {
    const hits = duplicateHits(
      { commands: [{ op: 'add-node', node: { uid: 'REQ-neu', type: 'REQ', name: KNOTEN[1].name, description: KNOTEN[1].description } }] },
      KNOTEN,
    );
    expect(hits).toHaveLength(1);
    expect(DuplicateHit.array().parse(hits)).toEqual(hits);
    expect(DuplicateHit.safeParse({ uid: 'REQ-neu', score: 1 }).success).toBe(false);
  });
});
