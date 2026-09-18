/**
 * zugverlauf.replay.test.ts — der Rechenkern von scripts/zugverlauf.mjs (CR-GC-549).
 *
 * Was hier bewiesen wird: aus den Kommandos im Audit-Log laesst sich der Graph JE VERSION
 * wiederherstellen. Das ist die Voraussetzung dafuer, dass ein Kennzahlen-Verlauf
 * rekonstruierbar ist statt mitgeschrieben werden zu muessen — und damit dafuer, dass ein
 * Lauf, den niemand mitgemessen hat, nachtraeglich noch eine Messbasis bekommt.
 *
 * Die Feldpruefung laeuft gegen einen echten Snapshot (`--verify`); hier steht die Mechanik,
 * damit ein Bruch im CI auffaellt und nicht erst am naechsten Fremdlauf.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { replayZuege, pruefeGegenSnapshot, laufKennzahlen } from '../scripts/zugverlauf.mjs';

/** Ein Log, wie der Gate-Pfad es schreibt: Kommandos am Datensatz, Version nur bei applied. */
const log = [
  {
    timestamp: '2026-01-01T00:00:00.000Z',
    consumerId: 'test',
    operation: 'mutate',
    result: 'applied',
    graphVersion: 1,
    violations: [],
    consultedTools: [],
    editSource: 'authored',
    commands: [
      { op: 'add-node', node: { uid: 'SYS-a', type: 'SYS', name: 'A', description: 'Systemblackbox A', attributes: {} } },
      { op: 'add-node', node: { uid: 'UC-b', type: 'UC', name: 'B', description: 'Anwendungsfall B', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'SYS-a', targetId: 'UC-b', edgeType: 'compose', attributes: {} } },
    ],
  },
  {
    // Ein abgelehnter Stapel darf den Zustand NICHT bewegen — sonst waere jede spaetere
    // Version falsch, und der Verlauf eine Erfindung.
    timestamp: '2026-01-01T00:01:00.000Z',
    consumerId: 'test',
    operation: 'mutate',
    result: 'rejected',
    graphVersion: 1,
    violations: [{ ruleId: 'R-18', severity: 'error', message: 'nope' }],
    consultedTools: ['graph_readiness'],
    editSource: 'authored',
    commands: [{ op: 'add-node', node: { uid: 'FUNC-ghost', type: 'FUNC', name: 'G', description: 'darf nie entstehen', attributes: {} } }],
  },
  {
    timestamp: '2026-01-01T00:02:00.000Z',
    consumerId: 'test',
    operation: 'mutate',
    result: 'applied',
    graphVersion: 2,
    violations: [],
    consultedTools: ['graph_elements', 'graph_get_node'],
    respondsTo: [{ ruleId: 'UC-02', elementId: 'UC-b' }],
    editSource: 'authored',
    commands: [
      { op: 'add-node', node: { uid: 'ACTOR-c', type: 'ACTOR', name: 'C', description: 'Akteur C', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'ACTOR-c', targetId: 'UC-b', edgeType: 'io', attributes: {} } },
      { op: 'delete-edge', edge: { sourceId: 'SYS-a', targetId: 'UC-b', edgeType: 'compose' } },
    ],
  },
];

describe('zugverlauf — Replay aus dem Audit-Log', () => {
  it('stellt den Graphen je Version her und laesst abgelehnte Stapel wirkungslos', () => {
    const { zeilen, standBeiVersion } = replayZuege(log);

    expect(zeilen).toHaveLength(3);
    // v1: zwei Knoten, eine Kante.
    expect(standBeiVersion.get(1)!.elements.map((e) => e.id).sort()).toEqual(['SYS-a', 'UC-b']);
    expect(standBeiVersion.get(1)!.traces).toHaveLength(1);
    // Der abgelehnte Stapel hat den Geisterknoten nicht angelegt.
    expect(zeilen[1].knoten).toBe(2);
    expect(standBeiVersion.has(2)).toBe(true);
    expect(standBeiVersion.get(2)!.elements.map((e) => e.id)).not.toContain('FUNC-ghost');
    // v2: Knoten dazu, compose-Kante weg, io-Kante da.
    const v2 = standBeiVersion.get(2)!;
    expect(v2.elements.map((e) => e.id).sort()).toEqual(['ACTOR-c', 'SYS-a', 'UC-b']);
    expect(v2.traces.map((t) => `${t.source}|${t.type}|${t.target}`)).toEqual(['ACTOR-c|io|UC-b']);
  });

  it('trennt den Stand des Graphen vom Gate-Befund des Stapels', () => {
    const { zeilen } = replayZuege(log);
    // Der letzte Stapel meldete NICHTS (violations: []), der Graph traegt trotzdem Befunde —
    // genau die Differenz, wegen der der Verlauf neu gerechnet wird statt abgeschrieben.
    expect(zeilen[2].gateError).toBe(0);
    expect(zeilen[2].error + zeilen[2].warning).toBeGreaterThan(0);
  });

  it('meldet gemessen-leer und nicht-erfasst getrennt', () => {
    const { zeilen } = replayZuege(log);
    expect(zeilen[0].consultedTools).toEqual([]); // gemessen: keine Lesung
    expect(zeilen[0].respondsTo).toBeNull(); // nicht erfasst
    expect(zeilen[2].consultedTools).toEqual(['graph_elements', 'graph_get_node']);
    expect(zeilen[2].respondsTo).toEqual(['UC-02']);
    const k = laufKennzahlen(zeilen);
    expect(k.nutzung.mutationenMitVorherigerLesung).toBe(2); // Zug 2 (abgelehnt) und Zug 3
    expect(k.nutzung.konsultationsrate).toBeCloseTo(2 / 3, 4);
    expect(k.waste.kommandosVerworfen).toBe(1);
  });

  it('verweigert ein Log, dessen Anfang nicht im Log steht', () => {
    // Ein applied-mutate bei v7 setzt auf v6 auf — und v6 kennt niemand.
    expect(() => replayZuege([{ ...log[0], graphVersion: 7 }])).toThrow(/graphVersion 6/);
    // Ein applied-mutate bei v1 setzt dagegen auf dem LEEREN Graphen auf: rekonstruierbar.
    expect(() => replayZuege(log)).not.toThrow();
  });

  it('erkennt eine Abweichung gegen den Snapshot, statt sie zu schoenen', () => {
    const { standBeiVersion } = replayZuege(log);
    const gut = pruefeGegenSnapshot(standBeiVersion, {
      graphVersion: 2,
      elements: [{ id: 'ACTOR-c' }, { id: 'SYS-a' }, { id: 'UC-b' }],
      traces: [{ source: 'ACTOR-c', type: 'io', target: 'UC-b' }],
    });
    expect(gut.ok).toBe(true);

    const schlecht = pruefeGegenSnapshot(standBeiVersion, {
      graphVersion: 2,
      elements: [{ id: 'SYS-a' }, { id: 'UC-b' }],
      traces: [{ source: 'ACTOR-c', type: 'io', target: 'UC-b' }],
    });
    expect(schlecht.ok).toBe(false);
    expect(schlecht.nurIst).toEqual(['ACTOR-c']);
  });
});
