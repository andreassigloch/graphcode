/**
 * TEST-readiness-completeness — eine leere Pflichtmenge ist ein Befund, nie „erreicht".
 *
 * Bis CR-GC-748 pruefte diese Datei die Vollstaendigkeits-Beine je Gate (CR-GC-250,
 * `COMPLETENESS_SLICES`/`scoreCompleteness`): eine eigene Rechnung „x von y" neben den Regeln, die
 * dasselbe schon melden. Mit contracts 11 / graphcode-client 2 (CR-SM-395) ist sie entfallen. Die
 * Aussage, fuer die sie gebaut wurde — graph-view-edit las gruen, waehrend eine verlangte Kette leer
 * war (irr-3e4e26c A2/A12/A13) —, traegt jetzt die Existenz-Regel der Stufe davor: sie meldet die
 * fehlende Menge, und ihr Befund haelt die Marke. Genau das steht hier, an echten Regellaeufen statt an
 * handgebauten Befunden.
 *
 * Bewusst NICHT festgeschrieben: welche Regel-ID eine Marke haelt, wo der Katalog dazu offene Fragen
 * fuehrt (CR-SM-395 §10). Die Faelle fragen nach der Rolle der haltenden Regel und nach dem Element.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { ALL_RULE_DEFS, DEFAULT_METRIC_POLICY, Mark } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import { computeReadiness, summarizeReadiness, type ReadinessMark } from '../src/kernel/measure/readiness.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';

const node = (uid: string, type: string, attributes: Record<string, unknown> = {}): Graph['nodes'][number] =>
  ({ uid, type, name: uid, description: `Das System muss ${uid} leisten.`, attributes }) as Graph['nodes'][number];
const edge = (sourceId: string, targetId: string, edgeType: string, label?: string) =>
  ({ sourceId, targetId, edgeType, attributes: label ? { label } : {} }) as Graph['edges'][number];

/** Der echte Regellauf des Steuerkatalogs, in der Form, die `computeReadiness` liest. */
function befunde(g: Graph): RuleViolation[] {
  return takeSteeringSnapshot(g, DEFAULT_METRIC_POLICY).violations.map((v) => ({
    ruleId: v.rule_id, severity: v.severity, elementId: v.element_id, message: v.message,
  }));
}
const marken = (g: Graph): ReadinessMark[] => computeReadiness(befunde(g), g).marks;
const marke = (g: Graph, id: string): ReadinessMark => marken(g).find((m) => m.id === id)!;
const ROLLE = new Map(ALL_RULE_DEFS.map((r) => [r.id, r.role]));

/** Eine Spezifikation ohne Luecke bis zur Testbereitschaft: nichts gebunden, kein Auftrag. */
function entwurf(extra: Graph['nodes'] = [], kanten: Graph['edges'] = []): Graph {
  return {
    nodes: [
      node('SYS-x', 'SYS'), node('UC-x', 'UC'), node('ACTOR-a', 'ACTOR'), node('FLOW-in', 'FLOW'), node('FLOW-out', 'FLOW'),
      node('SCHEMA-in', 'SCHEMA'), node('SCHEMA-out', 'SCHEMA'), node('FUNC-f', 'FUNC'), node('FCHAIN-c', 'FCHAIN'),
      node('REQ-r', 'REQ', { kinds: ['functional'] }), node('TEST-t', 'TEST'), node('TEST-s', 'TEST'), node('MOD-m', 'MOD'), ...extra,
    ],
    edges: [
      edge('SYS-x', 'UC-x', 'compose'), edge('UC-x', 'FCHAIN-c', 'compose'), edge('UC-x', 'REQ-r', 'compose'),
      edge('FCHAIN-c', 'FUNC-f', 'compose'), edge('ACTOR-a', 'FLOW-in', 'io'), edge('FLOW-in', 'FUNC-f', 'io'),
      edge('FUNC-f', 'FLOW-out', 'io'), edge('FLOW-out', 'ACTOR-a', 'io'), edge('FLOW-in', 'SCHEMA-in', 'relation'),
      edge('FLOW-out', 'SCHEMA-out', 'relation'), edge('FUNC-f', 'REQ-r', 'satisfy'), edge('TEST-t', 'REQ-r', 'verify'),
      edge('FUNC-f', 'MOD-m', 'allocate'), edge('SYS-x', 'MOD-m', 'compose'),
      edge('TEST-s', 'SCHEMA-in', 'verify'), edge('TEST-s', 'SCHEMA-out', 'verify'), ...kanten,
    ],
  };
}
const ohne = (g: Graph, ...uids: string[]): Graph => ({
  nodes: g.nodes.filter((n) => !uids.includes(n.uid)),
  edges: g.edges.filter((e) => !uids.includes(e.sourceId) && !uids.includes(e.targetId)),
});

describe('eine leere Pflichtmenge haelt die Marke — „0 von 0" liest nie als erreicht', () => {
  it('der leere Graph: keine Marke ist erreicht, und was sie haelt, ist ein Existenz-Befund', () => {
    const alle = marken({ nodes: [], edges: [] });
    expect(alle.map((m) => m.id)).toEqual(Mark.options);
    for (const m of alle) {
      expect(m.reached, m.id).toBe(false);
      expect(m.holding.length, m.id).toBeGreaterThan(0);
      expect(m.holding.every((h) => ROLLE.get(h.ruleId) === 'existence'), m.id).toBe(true);
    }
  });

  it('ein UC ohne Wirkkette haelt SRR, obwohl kein Fehler meldet (der Anlass von CR-GC-250)', () => {
    const g: Graph = { nodes: [node('SYS-x', 'SYS'), node('UC-x', 'UC')], edges: [edge('SYS-x', 'UC-x', 'compose')] };
    const srr = marke(g, 'SRR');
    expect(srr.reached).toBe(false);
    expect(srr.holding.some((h) => h.elementId === 'UC-x')).toBe(true);
    expect(srr.holding.every((h) => h.severity !== 'error')).toBe(true);
  });

  it('die lueckenlose Spezifikation erreicht SRR, PDR, CDR und TRR — die Positivkontrolle', () => {
    const g = entwurf();
    for (const id of ['SRR', 'PDR', 'CDR', 'TRR']) expect(marke(g, id).holding.map((h) => h.ruleId), id).toEqual([]);
  });

  it('eine Funktion ohne Modul haelt PDR, nicht SRR', () => {
    const g = ohne(entwurf(), 'MOD-m');
    expect(marke(g, 'SRR').reached).toBe(true);
    const pdr = marke(g, 'PDR');
    expect(pdr.reached).toBe(false);
    expect(pdr.holding.some((h) => h.elementId === 'FUNC-f')).toBe(true);
  });

  it('ein Datenfluss ohne Schema haelt CDR; mit Schema ist sie erreicht', () => {
    const g = ohne(entwurf(), 'SCHEMA-out');
    const cdr = marke(g, 'CDR');
    expect(cdr.reached).toBe(false);
    expect(cdr.holding.some((h) => h.elementId === 'FLOW-out')).toBe(true);
    expect(marke(entwurf(), 'CDR').reached).toBe(true);
  });

  it('eine Anforderung ohne Test haelt TRR, nicht CDR', () => {
    const g = ohne(entwurf(), 'TEST-t');
    expect(marke(g, 'CDR').reached).toBe(true);
    const trr = marke(g, 'TRR');
    expect(trr.reached).toBe(false);
    expect(trr.holding.some((h) => h.elementId === 'REQ-r')).toBe(true);
  });

  it('ein Schema ohne Vertragstest haelt TRR — auch ungebunden (CR-SM-396)', () => {
    const g = ohne(entwurf(), 'TEST-s');
    expect(marke(g, 'CDR').reached).toBe(true);
    expect(marke(g, 'TRR').holding.map((h) => `${h.ruleId}:${h.elementId}`).sort()).toEqual(['R-32:SCHEMA-in', 'R-32:SCHEMA-out']);
  });

  it('eine Marke bleibt offen, solange eine fruehere es ist', () => {
    const g = ohne(entwurf(), 'FCHAIN-c');
    const erreicht = marken(g).map((m) => m.reached);
    expect(erreicht[0]).toBe(false);
    // nie „offen, dann erreicht": was SRR haelt, haelt jede spaetere Marke.
    expect(erreicht.join(',')).not.toMatch(/false,(false,)*true/);
  });
});

describe('die Marke Bau: Plan, Bindung, Abgleich', () => {
  const bindungsRegeln = ALL_RULE_DEFS.filter((r) => r.stage === 11).map((r) => r.id);

  it('Entwurf ohne Auftrag und ohne Bindung: keine Bindungsregel meldet, Bau ist trotzdem nicht erreicht', () => {
    const g = entwurf();
    expect(befunde(g).filter((v) => bindungsRegeln.includes(v.ruleId))).toEqual([]);
    const bau = marke(g, 'Bau');
    expect(bau.reached).toBe(false); // es gibt Ungebautes ohne Auftrag — der Bauplan ist faellig
    expect(bau.holding.length).toBeGreaterThan(0);
  });

  it('ein offener Auftrag macht die Bindungsregeln faellig — ihre Befunde halten Bau', () => {
    const g = entwurf([node('CR-1', 'CR', { status: 'open' })], [edge('CR-1', 'FUNC-f', 'relation')]);
    const gemeldet = befunde(g).filter((v) => bindungsRegeln.includes(v.ruleId));
    expect(gemeldet.some((v) => v.elementId === 'FUNC-f')).toBe(true);
    expect(gemeldet.some((v) => v.elementId === 'TEST-t')).toBe(true);
    const bau = marke(g, 'Bau');
    expect(bau.reached).toBe(false);
    expect(bau.holding.some((h) => bindungsRegeln.includes(h.ruleId))).toBe(true);
    // die Marken der Spezifikation beruehrt das nicht
    for (const id of ['SRR', 'PDR', 'CDR', 'TRR']) expect(marke(g, id).reached, id).toBe(true);
  });

  it('eine Entscheidung ist ein ERLEDIGTER Auftrag und eroeffnet den Bau nicht; ein Etikett an der Kante aendert nichts (CR-SM-400)', () => {
    const erledigt = entwurf([node('CR-1', 'CR', { status: 'done' })], [edge('CR-1', 'REQ-r', 'relation')]);
    expect(befunde(erledigt).filter((v) => bindungsRegeln.includes(v.ruleId))).toEqual([]);
    expect(marke(erledigt, 'Bau').holding.map((h) => h.ruleId)).toContain('AF-05'); // der Bauplan bleibt faellig
    // offen ist offen: das Etikett `decides` nimmt einen offenen Auftrag nicht mehr aus
    const offen = entwurf([node('CR-1', 'CR', { status: 'open' })], [edge('CR-1', 'REQ-r', 'relation', 'decides')]);
    expect(befunde(offen).filter((v) => bindungsRegeln.includes(v.ruleId)).length).toBeGreaterThan(0);
  });

  it('eine Bindung von Hand, ohne Auftrag, zaehlt genauso', () => {
    const g = entwurf();
    g.nodes.find((n) => n.uid === 'TEST-t')!.attributes = { testRefs: [{ file: 'tests/x.test.ts', tool: 'vitest' }] };
    const gemeldet = befunde(g).filter((v) => bindungsRegeln.includes(v.ruleId));
    expect(gemeldet.some((v) => v.elementId === 'FUNC-f')).toBe(true);
    expect(gemeldet.some((v) => v.elementId === 'TEST-t' && v.severity !== 'info')).toBe(false); // der gebundene Test meldet nicht
  });
});

describe('ein Wert je Marke, das Warum auf Anfrage (REQ-completeness-single-value)', () => {
  it('die Kurzform behaelt `reached` und laesst `holding` weg', () => {
    const g: Graph = { nodes: [node('SYS-x', 'SYS'), node('UC-x', 'UC')], edges: [] };
    const voll = computeReadiness(befunde(g), g);
    const kurz = summarizeReadiness(voll);
    expect(kurz.marks.map((m) => [m.id, m.reached])).toEqual(voll.marks.map((m) => [m.id, m.reached]));
    expect(voll.marks[0]!.holding.length).toBeGreaterThan(0);
    expect(kurz.marks.every((m) => m.holding.length === 0)).toBe(true);
  });
});
