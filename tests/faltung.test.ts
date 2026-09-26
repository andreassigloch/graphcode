/**
 * CR-GC-682 — die Compose-Faltung (src/loop/faltung.ts), rein: Knoten und Kanten rein, Sicht raus.
 */
import { describe, it, expect } from 'vitest';
import { elternBaum, falten, faltung, type FaltKante, type FaltKnoten } from '../src/loop/faltung.js';

const k = (uid: string, description = `Text ${uid}`): FaltKnoten => ({ uid, type: uid.split('-')[0], name: uid, description });
const e = (sourceId: string, edgeType: string, targetId: string): FaltKante => ({ sourceId, edgeType, targetId });

// SYS › UC-a › REQ-a1 ; SYS › UC-b › REQ-b1 ; SYS › MOD-m › MOD-m1 ; TEST-a1 verify REQ-a1 ; ACTOR frei
const KNOTEN = ['SYS-s', 'UC-a', 'UC-b', 'REQ-a1', 'REQ-b1', 'MOD-m', 'MOD-m1', 'TEST-a1', 'ACTOR-x'].map((u) => k(u));
const KANTEN = [
  e('SYS-s', 'compose', 'UC-a'),
  e('SYS-s', 'compose', 'UC-b'),
  e('UC-a', 'compose', 'REQ-a1'),
  e('UC-b', 'compose', 'REQ-b1'),
  e('SYS-s', 'compose', 'MOD-m'),
  e('MOD-m', 'compose', 'MOD-m1'),
  e('TEST-a1', 'verify', 'REQ-a1'),
  e('ACTOR-x', 'io', 'UC-a'),
];

describe('Compose-Faltung (CR-GC-682)', () => {
  it('Baum: compose zuerst, TEST haengt ueber verify am REQ', () => {
    const b = elternBaum(KNOTEN, KANTEN);
    expect(b.eltern.get('REQ-a1')).toBe('UC-a');
    expect(b.eltern.get('MOD-m1')).toBe('MOD-m');
    expect(b.eltern.get('TEST-a1')).toBe('REQ-a1');
    expect(b.eltern.has('SYS-s')).toBe(false);
  });

  it('offen: Saat, Teilbaum, Vorfahren — Box: Geschwister auf dem Weg — Rest verborgen', () => {
    const b = elternBaum(KNOTEN, KANTEN);
    const { offen, box } = falten(KNOTEN.map((n) => n.uid), b, ['UC-a']);
    // ACTOR-x hat keinen compose-Elternteil und haengt ueber io an UC-a — also in dessen Teilbaum.
    expect([...offen].sort()).toEqual(['ACTOR-x', 'REQ-a1', 'SYS-s', 'TEST-a1', 'UC-a']);
    expect(box.has('UC-b')).toBe(true);
    expect(box.has('MOD-m')).toBe(true);
    expect(offen.has('REQ-b1') || box.has('REQ-b1')).toBe(false);
    expect(offen.has('MOD-m1') || box.has('MOD-m1')).toBe(false);
  });

  it('der uid-Index traegt jeden verborgenen Knoten, Kanten nur zwischen sichtbaren', () => {
    const f = faltung(KNOTEN, KANTEN, ['UC-a']);
    const sichtbar = new Set([...f.offen, ...f.box].map((n) => n.uid));
    expect(f.index.sort()).toEqual(['MOD-m1', 'REQ-b1']);
    expect(sichtbar.size + f.index.length).toBe(KNOTEN.length);
    for (const kante of f.kanten) {
      expect(sichtbar.has(kante.sourceId) && sichtbar.has(kante.targetId)).toBe(true);
    }
    expect(f.kanten).not.toContainEqual(e('UC-b', 'compose', 'REQ-b1'));
  });

  it('ein compose-Zyklus wird zur Wurzel, statt die Faltung zu blockieren', () => {
    const zyklus = [k('FUNC-a'), k('FUNC-b')];
    const f = faltung(zyklus, [e('FUNC-a', 'compose', 'FUNC-b'), e('FUNC-b', 'compose', 'FUNC-a')], ['FUNC-a']);
    expect(f.offen.map((n) => n.uid)).toContain('FUNC-a');
    expect(f.offen.length + f.box.length + f.index.length).toBe(2);
  });

  it('unbekannte Saat faellt weg — alles Wurzelnahe ist Box, der Rest Index', () => {
    const f = faltung(KNOTEN, KANTEN, ['UC-gibtsnicht']);
    expect(f.offen).toEqual([]);
    expect(f.box.map((n) => n.uid)).toContain('SYS-s');
    expect(f.index).toContain('REQ-a1');
  });
});
