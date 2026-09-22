/**
 * CR-GC-613 — die Arbeitsmenge aus dem Audit, als reine Funktion festgenagelt.
 *
 * Sie ist die EINZIGE Stelle, an der "was habe ich in dieser Sitzung angefasst" definiert wird.
 * Weicht ein Werkzeug davon ab, liefert dieselbe Abfrage je nach Aufrufer etwas anderes — und
 * der Umfang einer Antwort waere nicht mehr pruefbar.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { arbeitsmengeAusAudit, schneide } from '../src/kernel/measure/working-set.js';

const eintrag = (over: Partial<AuditEntry>): AuditEntry =>
  ({
    id: 'a', timestamp: '2026-09-22T00:00:00.000Z', consumerId: 'c', consumerType: 'agent',
    operation: 'mutate', result: 'applied', violations: [], graphVersion: 1, ...over,
  }) as AuditEntry;

const addNode = (uid: string) => ({ op: 'add-node', node: { uid, type: 'FUNC', name: uid, attributes: {} } });
const addEdge = (s: string, t: string) => ({ op: 'add-edge', edge: { sourceId: s, targetId: t, edgeType: 'satisfy', attributes: {} } });

describe('CR-GC-613: arbeitsmengeAusAudit', () => {
  it('sammelt die uids angewandter Stapel, sortiert und ohne Dubletten', () => {
    const r = arbeitsmengeAusAudit([
      eintrag({ commands: [addNode('FUNC-b'), addNode('FUNC-a')] as never }),
      eintrag({ commands: [addNode('FUNC-a')] as never }),
    ]);
    expect(r).toEqual({ uids: ['FUNC-a', 'FUNC-b'], zuege: 2 });
  });

  it('eine Kante faerbt BEIDE Enden — sie sagt ueber beide Knoten etwas aus', () => {
    const r = arbeitsmengeAusAudit([eintrag({ commands: [addEdge('FUNC-a', 'REQ-x')] as never })]);
    expect(r.uids).toEqual(['FUNC-a', 'REQ-x']);
  });

  it('kennt jede Kommandoform — auch delete, update und merge', () => {
    const r = arbeitsmengeAusAudit([
      eintrag({ commands: [
        { op: 'delete-node', uid: 'A' },
        { op: 'update-node', node: { uid: 'B', attributes: {} } },
        { op: 'delete-edge', edge: { sourceId: 'C', targetId: 'D', edgeType: 'relation' } },
        { op: 'update-edge', edge: { sourceId: 'E', targetId: 'F', edgeType: 'relation', attributes: {} } },
        { op: 'merge-nodes', sourceUid: 'G', targetUid: 'H' },
      ] as never }),
    ]);
    expect(r.uids).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });

  it('ein VERWORFENER Preview zieht die Scheibe NICHT auf — ein Vorschlag ist kein Zug', () => {
    const r = arbeitsmengeAusAudit([eintrag({ operation: 'validate', commands: [addNode('FUNC-probe')] as never })]);
    expect(r).toEqual({ uids: [], zuege: 0 });
  });

  it('ein abgewiesener Stapel zaehlt nicht — was das Gate zurueckwies, steht nicht im Graphen', () => {
    const r = arbeitsmengeAusAudit([eintrag({ result: 'rejected', commands: [addNode('FUNC-x')] as never })]);
    expect(r).toEqual({ uids: [], zuege: 0 });
  });

  it('ein Eintrag ohne commands traegt nichts bei — und zaehlt auch nicht als Zug', () => {
    const r = arbeitsmengeAusAudit([eintrag({}), eintrag({ commands: [] as never })]);
    expect(r).toEqual({ uids: [], zuege: 0 });
  });
});

describe('CR-GC-613: schneide — der Umfang steht IN der Antwort', () => {
  const funde = [{ elementId: 'A' }, { elementId: 'B' }, { elementId: 'C' }];
  const von = (f: { elementId: string }) => f.elementId;

  it('ohne Schreibzug: das ganze Modell, unveraendertes Verhalten', () => {
    const { genommen, umfang } = schneide(funde, { uids: [], zuege: 0 }, von);
    expect(genommen).toEqual(funde);
    expect(umfang).toEqual({ art: 'ganzes-modell', uids: [], ausserhalb: 0 });
  });

  it('mit Schreibzuegen: nur die Scheibe, und der Rest als ZAHL', () => {
    const { genommen, umfang } = schneide(funde, { uids: ['A'], zuege: 1 }, von);
    expect(genommen).toEqual([{ elementId: 'A' }]);
    expect(umfang).toEqual({ art: 'arbeitsmenge', uids: ['A'], ausserhalb: 2 });
  });

  it('ein Treffer ohne Element faellt heraus und wird als ausserhalb gezaehlt, nie stillschweigend mitgenommen', () => {
    const { genommen, umfang } = schneide([{ elementId: undefined }, { elementId: 'A' }], { uids: ['A'], zuege: 1 }, (f) => f.elementId);
    expect(genommen).toEqual([{ elementId: 'A' }]);
    expect(umfang.ausserhalb).toBe(1);
  });
});
