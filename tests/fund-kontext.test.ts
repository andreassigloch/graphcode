/**
 * CR-GC-652 — die Element-Liste aus dem Kontext des Funds: gerichtet hinauf zum Besitzer (UC/SYS),
 * hinunter durch seine Realisierung. Rein, ohne Store — der Weg ist eine Funktion des Graphen.
 *
 * Die Faelle sind die fuenf Lagen, die an den RD-01-Funden des eigenen Modells gemessen wurden:
 * REQ unter einem UC, REQ direkt am SYS, REQ unter einer REQ, dazu der Fund, der selbst Besitzer
 * ist (UC-01), und die Waise.
 */
import { describe, it, expect } from 'vitest';
import { fundKontext, type KontextKante, type KontextKnoten } from '../src/loop/fund-kontext.js';

const k = (uid: string): KontextKnoten => ({ uid, type: uid.split('-')[0], name: uid.toLowerCase() });
const e = (sourceId: string, edgeType: string, targetId: string): KontextKante => ({ sourceId, edgeType, targetId });

// SYS → UC-a → FCHAIN-a → FUNC-a1/-a2 → MOD-x ; SYS → UC-b → FCHAIN-b → FUNC-b1 ; SYS → MOD-x/-y
const GRAPH = {
  nodes: [
    'SYS-s', 'UC-a', 'UC-b', 'FCHAIN-a', 'FCHAIN-b', 'FUNC-a1', 'FUNC-a2', 'FUNC-b1', 'MOD-x', 'MOD-y',
    'REQ-ua', 'REQ-ub', 'REQ-sys', 'REQ-kind', 'REQ-waise', 'TEST-ua',
  ].map(k),
  edges: [
    e('SYS-s', 'compose', 'UC-a'), e('SYS-s', 'compose', 'UC-b'),
    e('SYS-s', 'compose', 'MOD-x'), e('SYS-s', 'compose', 'MOD-y'),
    e('UC-a', 'compose', 'FCHAIN-a'), e('UC-b', 'compose', 'FCHAIN-b'),
    e('FCHAIN-a', 'compose', 'FUNC-a1'), e('FCHAIN-a', 'compose', 'FUNC-a2'), e('FCHAIN-b', 'compose', 'FUNC-b1'),
    e('FUNC-a1', 'allocate', 'MOD-x'),
    e('UC-a', 'compose', 'REQ-ua'), e('UC-b', 'compose', 'REQ-ub'),
    e('SYS-s', 'compose', 'REQ-sys'),
    e('REQ-ua', 'compose', 'REQ-kind'),
    e('TEST-ua', 'verify', 'REQ-ua'),
  ],
};
const ERFUELLER = ['REQ', 'FUNC', 'FCHAIN', 'MOD', 'SYS'];
const uids = (r: { knoten: KontextKnoten[] }): string[] => r.knoten.map((n) => n.uid);

describe('fundKontext (CR-GC-652)', () => {
  it('REQ unter einem UC: die Realisierung GENAU dieses Szenarios, nicht die des Nachbar-UC', () => {
    const r = fundKontext(GRAPH, ['REQ-ua'], ERFUELLER);
    expect(uids(r)).toEqual(['FCHAIN-a', 'FUNC-a1', 'FUNC-a2', 'MOD-x', 'REQ-ua']);
    expect(r.ohneBesitzer).toEqual([]);
  });

  it('REQ am SYS: der Modulbaum — aber kein UC, keine Nachbar-REQ (sonst Hub-Fan-out)', () => {
    const r = fundKontext(GRAPH, ['REQ-sys'], ERFUELLER);
    expect(uids(r)).toEqual(['MOD-x', 'MOD-y', 'REQ-sys', 'SYS-s']);
  });

  it('REQ unter einer REQ: der Weg laeuft ueber die Eltern-REQ weiter bis zum UC', () => {
    const r = fundKontext(GRAPH, ['REQ-kind'], ERFUELLER);
    expect(uids(r)).toEqual(['FCHAIN-a', 'FUNC-a1', 'FUNC-a2', 'MOD-x', 'REQ-kind', 'REQ-ua']);
  });

  it('der Fund ist selbst Besitzer (UC-01): nach unten, nicht hinauf zum SYS', () => {
    const r = fundKontext(GRAPH, ['UC-b'], ['UC', 'FCHAIN', 'FUNC', 'MOD', 'SYS']);
    expect(uids(r)).toEqual(['FCHAIN-b', 'FUNC-b1', 'UC-b']);
  });

  it('Waise: KEINE Ersatzliste — der fehlende Besitzer wird genannt', () => {
    const r = fundKontext(GRAPH, ['REQ-waise'], ERFUELLER);
    expect(uids(r)).toEqual(['REQ-waise']);
    expect(r.ohneBesitzer).toEqual(['REQ-waise']);
  });

  it('mehrere Funde: die Vereinigung, eine Waise daneben wird trotzdem benannt', () => {
    const r = fundKontext(GRAPH, ['REQ-ua', 'REQ-waise'], ERFUELLER);
    expect(uids(r)).toContain('FUNC-a1');
    expect(r.ohneBesitzer).toEqual(['REQ-waise']);
  });

  it('gefiltert auf die Fokus-Typen; ein unbekannter Fund faellt weg statt zu werfen', () => {
    const r = fundKontext(GRAPH, ['REQ-ua', 'REQ-gibt-es-nicht'], ['FUNC']);
    expect(uids(r)).toEqual(['FUNC-a1', 'FUNC-a2']);
    expect(r.ohneBesitzer).toEqual([]);
  });
});
