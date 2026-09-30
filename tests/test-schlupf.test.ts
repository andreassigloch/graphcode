/**
 * CR-GC-718 — Schlupf des Volllaufs gegen die Auswahl und die Zusage der Blackbox-Bindung.
 * Reine Funktionen; der Graph ist klein und synthetisch, die Kantenform die des Snapshots.
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import {
  blackboxBindung,
  schlupfFreieFolge,
  schlupfVon,
  SCHLUPF_SCHWELLE,
  type SchlupfZeile,
} from '../src/projections/test-schlupf.js';

const LEER = { total: 0, gebunden: 0, offen: [] };
function zeile(cr: string, at: string, spur: SchlupfZeile['spur'], schlupf: string[] = []): SchlupfZeile {
  return {
    cr, at, code: 'x', spur, ausgewaehlt: 1, ausGraph: 1, gesamt: 2, rot: schlupf, schlupf, schlupfNurGraph: schlupf,
    zusage: { blackbox: LEER, schnittstelle: LEER },
  };
}

describe('Schlupf (CR-GC-718)', () => {
  it('ein roter Test ausserhalb der Auswahl ist Schlupf, getrennt nach Auswahl und Graph-Anteil', () => {
    const r = schlupfVon(['tests/a.test.ts', 'tests/b.test.ts'], ['tests/a.test.ts'], []);
    expect(r.schlupf).toEqual(['tests/b.test.ts']);
    expect(r.schlupfNurGraph).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
    expect(schlupfVon([], ['tests/a.test.ts'], []).schlupf).toEqual([]);
  });

  it('die Folge zaehlt CODE-CRs ohne Schlupf rueckwaerts, VOLL ist neutral, Schlupf bricht ab, je CR die juengste Zeile', () => {
    const zeilen = [
      zeile('CR-0', '2025-12-31', 'CODE'), // vor dem Schlupf — darf nicht mehr zaehlen
      zeile('CR-1', '2026-01-01', 'CODE', ['tests/x.test.ts']),
      zeile('CR-2', '2026-01-02', 'CODE'),
      zeile('CR-3', '2026-01-03', 'VOLL'),
      zeile('CR-4', '2026-01-04', 'CODE', ['tests/y.test.ts']),
      zeile('CR-4', '2026-01-05', 'CODE'), // Nachlauf desselben CR ersetzt den ersten
      zeile('CR-5', '2026-01-06', 'CODE'),
    ];
    expect(schlupfFreieFolge(zeilen)).toBe(3);
    expect(SCHLUPF_SCHWELLE).toBe(10);
  });
});

describe('Zusage: Blackbox- und Schnittstellentests gebunden (CR-GC-718)', () => {
  const n = (uid: string, type: string, attributes: Record<string, unknown> = {}) => ({ uid, type, name: uid, description: '', attributes });
  const e = (sourceId: string, edgeType: string, targetId: string) => ({ sourceId, edgeType, targetId, attributes: {} });
  const ref = { testRefs: [{ file: 'tests/x.test.ts' }] };
  const graph = {
    nodes: [
      n('MOD-a', 'MOD'), n('FUNC-top', 'FUNC'), n('FUNC-innen', 'FUNC'),
      n('REQ-mod', 'REQ'), n('REQ-top', 'REQ'), n('REQ-innen', 'REQ'),
      n('TEST-mod', 'TEST', ref), n('TEST-top', 'TEST'), n('TEST-innen', 'TEST'),
      n('FLOW-f', 'FLOW'), n('SCHEMA-ok', 'SCHEMA'), n('SCHEMA-offen', 'SCHEMA'), n('FLOW-g', 'FLOW'),
      n('TEST-vertrag', 'TEST', ref),
    ],
    edges: [
      e('FUNC-top', 'compose', 'FUNC-innen'),
      e('MOD-a', 'satisfy', 'REQ-mod'), e('FUNC-top', 'satisfy', 'REQ-top'), e('FUNC-innen', 'satisfy', 'REQ-innen'),
      e('TEST-mod', 'verify', 'REQ-mod'), e('TEST-top', 'verify', 'REQ-top'), e('TEST-innen', 'verify', 'REQ-innen'),
      e('FLOW-f', 'relation', 'SCHEMA-ok'), e('FLOW-g', 'relation', 'SCHEMA-offen'),
      e('TEST-vertrag', 'verify', 'SCHEMA-ok'),
    ],
  } as unknown as Graph;

  it('zaehlt Tests an MOD und Wurzel-FUNC, nicht an einer inneren FUNC; ungebundene stehen offen', () => {
    const z = blackboxBindung(graph);
    expect(z.blackbox).toEqual({ total: 2, gebunden: 1, offen: ['TEST-top'] });
  });

  it('jeder Vertrag an einem FLOW braucht einen gebundenen TEST', () => {
    expect(blackboxBindung(graph).schnittstelle).toEqual({ total: 2, gebunden: 1, offen: ['SCHEMA-offen'] });
  });
});

describe('testauswahl.jsonl (CR-GC-718)', () => {
  it('liest geprueft und weist eine kaputte Zeile laut ab', async () => {
    const { leseSchlupfZeilen } = await import('../src/projections/test-schlupf.js');
    const gut = JSON.stringify(zeile('CR-GC-1', '2026-01-01', 'CODE'));
    expect(leseSchlupfZeilen(`${gut}\n`)).toHaveLength(1);
    expect(() => leseSchlupfZeilen(`${gut}\n{"cr":"x"}\n`)).toThrow();
  });
});
