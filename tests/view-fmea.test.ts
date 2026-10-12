/**
 * TEST-view-fmea (CR-GC-801) — die Sicht `fmea.md` zeigt, was das Modell über ein Risiko weiß.
 *
 * Vor diesem CR war die Sicht ein Register: Satz, S/O/D, RPN, Gegenmaßnahme, ein Haken. Kette,
 * Träger, Priorität, Nachweis und der Stand der Gegenmaßnahme standen im Modell und nicht in der
 * Sicht; die Zeilen standen in uid-Reihenfolge, das höchste Risiko an sechster Stelle.
 *
 * Reine Projektion auf einem Graphen im Speicher — die Sicht liest keinen Store.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { exportMarkdown } from '../src/projections/exporter.js';

const n = (uid: string, type: string, name: string, attributes: Record<string, unknown> = {}, description = `${name}.`) => ({
  uid,
  type,
  name,
  description,
  attributes,
});
const e = (sourceId: string, edgeType: string, targetId: string) => ({ sourceId, targetId, edgeType, attributes: {} });

/**
 * REQ-risk-klein (S 4, RPN 32, Low) steht in uid-Reihenfolge VOR REQ-risk-ueber (S 8, RPN 280, High).
 * Das hohe Risiko hat eine gebaute Gegenmaßnahme mit Träger und bestandenem Test; das kleine eine
 * Gegenmaßnahme ohne Funktion und einen ungebundenen Test.
 */
const GRAPH: Graph = {
  nodes: [
    n('SYS-s', 'SYS', 'System'),
    n('UC-u', 'UC', 'Anwendungsfall'),
    n('FCHAIN-k', 'FCHAIN', 'Kette K'),
    n('MOD-m', 'MOD', 'Modul'),
    n('FUNC-t', 'FUNC', 'Traeger'),
    n('REQ-risk-klein', 'REQ', 'Kleines Risiko', { role: 'risk', kinds: ['non-functional'], severity: 4, occurrence: 4, detection: 2 }),
    n('REQ-m-offen', 'REQ', 'Massnahme ohne Funktion', { role: 'mitigation', kinds: ['functional'] }),
    n(
      'REQ-risk-ueber',
      'REQ',
      'Grosses Risiko',
      { role: 'risk', kinds: ['non-functional'], severity: 8, occurrence: 5, detection: 7, rationale: 'Befund aus der Analyse' },
      'Ein Ergebnis gilt weiter.',
    ),
    n('REQ-m-gebaut', 'REQ', 'Gebaute Massnahme', { role: 'mitigation', kinds: ['functional'] }),
    n('TEST-gruen', 'TEST', 'Gruener Test', {
      testRefs: [{ file: 'tests/gruen.test.ts', tool: 'vitest', result: 'passed', ranAt: '2026-10-12T15:36:10.000Z' }],
    }),
    n('TEST-lose', 'TEST', 'Ungebundener Test'),
    n('CR-A-1', 'CR', 'Analyse', { status: 'done' }, 'docs/cr/done/CR-A-1-analyse.md'),
  ],
  edges: [
    e('UC-u', 'compose', 'FCHAIN-k'),
    e('UC-u', 'compose', 'REQ-risk-ueber'),
    e('FCHAIN-k', 'compose', 'FUNC-t'),
    e('FUNC-t', 'allocate', 'MOD-m'),
    e('FCHAIN-k', 'satisfy', 'REQ-risk-ueber'),
    e('FCHAIN-k', 'satisfy', 'REQ-risk-klein'),
    e('REQ-risk-ueber', 'compose', 'REQ-m-gebaut'),
    e('REQ-risk-klein', 'compose', 'REQ-m-offen'),
    e('FUNC-t', 'satisfy', 'REQ-m-gebaut'),
    e('TEST-gruen', 'verify', 'REQ-risk-ueber'),
    e('TEST-gruen', 'verify', 'REQ-m-gebaut'),
    e('TEST-lose', 'verify', 'REQ-risk-klein'),
    e('TEST-lose', 'verify', 'REQ-m-offen'),
    e('CR-A-1', 'relation', 'REQ-risk-ueber'),
  ],
};

describe('TEST-view-fmea: die Sicht zeigt Ort, Prioritaet, Traeger und Nachweis (CR-GC-801)', () => {
  const md = exportMarkdown(GRAPH, 'fmea', 'x');

  it('sortiert nach Prioritaet, nicht nach uid: das hohe Risiko steht zuerst', () => {
    expect(md.indexOf('Grosses Risiko')).toBeGreaterThan(-1);
    expect(md.indexOf('Grosses Risiko')).toBeLessThan(md.indexOf('Kleines Risiko'));
  });

  it('die Uebersicht nennt je Risiko Kette, Bewertung, Prioritaet, Traeger und Nachweis', () => {
    expect(md).toContain('| 1 | Grosses Risiko | `FCHAIN-k` | 8 | 5 | 7 | 280 | High | `FUNC-t` | ✓ |');
    expect(md).toContain('| 2 | Kleines Risiko | `FCHAIN-k` | 4 | 4 | 2 | 32 | Low | — | ✗ |');
  });

  it('der Kopf zaehlt Risiken, hohe Prioritaet, Verifizierte und Gegenmassnahmen ohne Funktion', () => {
    expect(md).toContain('2 Risiken, 1 mit hoher Priorität, 1 verifiziert, 1 Gegenmaßnahme ohne Funktion');
  });

  it('je Risiko: Wortlaut, Befund, Anwendungsfall und der Analyse-CR', () => {
    expect(md).toContain('### 1. Grosses Risiko');
    expect(md).toContain('Ein Ergebnis gilt weiter.');
    expect(md).toContain('Befund aus der Analyse');
    expect(md).toContain('`UC-u`');
    expect(md).toContain('`CR-A-1` (docs/cr/done/CR-A-1-analyse.md)');
  });

  it('eine Gegenmassnahme ohne Erfueller heisst so, eine gebaute nennt ihren Erfueller', () => {
    expect(md).toContain('| `REQ-m-gebaut` | Gebaute Massnahme. | `FUNC-t` |');
    expect(md).toContain('| `REQ-m-offen` | Massnahme ohne Funktion. | **Funktion fehlt** |');
  });

  it('der Nachweis nennt Test, Datei, Ergebnis und Datum; ein ungebundener Test steht als solcher da', () => {
    expect(md).toContain('| `TEST-gruen` | tests/gruen.test.ts | passed | 2026-10-12 |');
    expect(md).toContain('| `TEST-lose` | ungebunden | — | — |');
  });

  it('sagt, dass die Sicht nur die Risiken im Modell zeigt, und nennt kein abgeschafftes Attribut', () => {
    expect(md).toContain('Fehlerarten, die die Analyse bewertet und nicht als Anforderung geschrieben hat');
    expect(md).not.toContain('testResult');
  });

  it('ohne Risiko im Modell steht das da (kein leeres Dokument)', () => {
    const leer = exportMarkdown({ nodes: [n('SYS-s', 'SYS', 'System')], edges: [] }, 'fmea', 'x');
    expect(leer).toContain('keine REQ role=risk im Graph');
  });
});
