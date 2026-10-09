/**
 * CR-GC-575 — die Rangfolge der Steuerungskanaele steht an EINER Stelle.
 *
 * Bis hierher entschied verstreuter Code, welcher Kanal gewinnt: zwei Ternaere in
 * `generate.ts` vierzig Zeilen auseinander. Jeder Konflikt musste durch einen
 * Lauf gefunden werden — viermal in der Serie CR-GC-560..568.
 *
 * Diese Abnahme haelt beides fest: die Ordnung selbst, und dass die Stelle, die sie
 * anwendet (`generate.ts`), sie wirklich aus `channel-rank.ts` bezieht und nicht noch
 * einmal selbst entscheidet. Die zweite anwendende Stelle, der Rundenprompt des
 * eingebetteten Executors, ist mit CR-GC-775 ausgelagert.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHANNEL_ORDER, rankOf, outranks, winner } from '../src/loop/channel-rank.js';
import { generationStep, RULE_CLAUSE, GENERATION_TEMPLATE, STAGE_FOCUS_TYPES } from '../src/loop/generate.js';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';

describe('die Ordnung selbst (CR-GC-575)', () => {
  it('ist absteigend nach Verbindlichkeit', () => {
    expect([...CHANNEL_ORDER]).toEqual([
      'gate-truth', 'rule-clause', 'grammar', 'inventory', 'guidance', 'proposal',
    ]);
  });

  it('Gate-Wahrheit schlaegt alles, ein Vorschlag schlaegt nichts', () => {
    for (const other of CHANNEL_ORDER.filter((c) => c !== 'gate-truth')) {
      expect(outranks('gate-truth', other)).toBe(true);
      expect(outranks(other, 'gate-truth')).toBe(false);
    }
    for (const other of CHANNEL_ORDER.filter((c) => c !== 'proposal')) {
      expect(outranks('proposal', other)).toBe(false);
    }
    expect(rankOf('rule-clause')).toBeLessThan(rankOf('guidance'));
    // Der Kern der CR: Anleitung ist verbindlicher als ein Vorschlag.
    expect(rankOf('guidance')).toBeLessThan(rankOf('proposal'));
  });

  it('winner nimmt den verbindlichsten Kanal, der ueberhaupt etwas zu sagen hat', () => {
    expect(winner([
      { channel: 'proposal', value: 'Vorschlag' },
      { channel: 'rule-clause', value: 'Imperativ' },
    ])).toEqual({ channel: 'rule-clause', value: 'Imperativ' });
    // Schweigt der hoehere Rang, uebernimmt der naechste — nicht der Zufall der Reihenfolge.
    expect(winner([
      { channel: 'rule-clause', value: null },
      { channel: 'proposal', value: 'Vorschlag' },
    ])).toEqual({ channel: 'proposal', value: 'Vorschlag' });
    expect(winner([{ channel: 'rule-clause', value: undefined }])).toBeNull();
  });
});

describe('die Ordnung wird angewandt, nicht ein zweites Mal entschieden (CR-GC-575)', () => {
  const node = (uid: string, type: string, name: string, description = ''): unknown =>
    ({ uid, type, name, description, attributes: {} });
  const edge = (sourceId: string, targetId: string, edgeType: string): unknown =>
    ({ sourceId, targetId, edgeType, attributes: {} });
  /** SYS + ACTOR + UC: der Kaltstart ist durch, die Runde steht in der expand-Phase. */
  const GRAPH = {
    nodes: [
      node('SYS-shop', 'SYS', 'shop', 'Ein Bestellsystem fuer Ersatzteile.'),
      node('ACTOR-kunde', 'ACTOR', 'Kunde'),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt ein Ersatzteil.'),
    ],
    edges: [edge('SYS-shop', 'UC-bestellen', 'compose')],
  } as unknown as Graph;

  it('stellt eine Regel das Fenster, gewinnt ihre Klausel — fuer TEXT und Fokus-Typen zugleich', () => {
    const step = generationStep(GRAPH, DEFAULT_METRIC_POLICY, undefined, 0.8);
    expect(step.phase).toBe('expand');
    const [stufe, regel] = (step.focusKey as string).split(':');
    // CR-GC-757: der Schluessel beginnt mit dem Namen der Stufe, und die Stufe traegt eine Vorlage.
    expect(step.focusStage).toBe(stufe);
    expect(GENERATION_TEMPLATE[stufe], `Stufe ${stufe} ohne Vorlage`).toBeTruthy();
    const klausel = RULE_CLAUSE[regel];
    // Vorbedingung der Aussage: dieses Fenster wird WIRKLICH von einer Regel mit Klausel
    // gestellt. Ohne diese Kontrolle prueft der Rest nichts.
    expect(klausel, `Fenster ${step.focusKey} stellt keine Klausel-Regel`).toBeTruthy();
    // Die Klausel liest den Bestand (ITEM-2026-625: FCHAIN und ACTOR aus dem Graphen) — derselbe Ausschnitt wie im Schritt.
    const bestand = {
      elements: (GRAPH.nodes as { uid: string; type: string }[]).map((n) => ({ id: n.uid, type: n.type })),
      traces: (GRAPH.edges as { sourceId: string; targetId: string; edgeType: string }[]).map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })),
    };
    expect(step.prompt).toContain(klausel.text(['UC-bestellen'], bestand));
    expect(step.focusTypes).toEqual([...klausel.types]);
    // Und die Vorlage der Stufe (Rang 6) steht NICHT daneben — ein Imperativ je Runde.
    expect(step.prompt).not.toContain(GENERATION_TEMPLATE[stufe]);
    expect(step.focusTypes).not.toEqual(STAGE_FOCUS_TYPES[stufe]);
  });

  it('die anwendende Stelle bezieht die Ordnung aus channel-rank, statt sie zu wiederholen', () => {
    // Kriterium 1 der CR: "an genau einer Stelle im Code, nicht in fuenf Bedingungen".
    // Prueflicher Stellvertreter: `generate.ts` importiert die Ordnung und traegt keine
    // eigene Vorrang-Verzweigung auf `klausel` mehr.
    const generate = readFileSync(new URL('../src/loop/generate.ts', import.meta.url), 'utf8');
    expect(generate).toContain("from './channel-rank.js'");
    // Der alte Ternaer: `klausel ? [...klausel.types] : ...` — die zweite Entscheidung
    // derselben Frage. Sie darf nicht zurueckkehren.
    expect(generate).not.toMatch(/klausel\s*\n?\s*\?\s*\[\.\.\.klausel\.types\]/);
  });
});
