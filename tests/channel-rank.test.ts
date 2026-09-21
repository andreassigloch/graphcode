/**
 * CR-GC-575 — die Rangfolge der Steuerungskanaele steht an EINER Stelle.
 *
 * Bis hierher entschied verstreuter Code, welcher Kanal gewinnt: zwei Ternaere in
 * `generate.ts` vierzig Zeilen auseinander, und die Blockreihenfolge in
 * `executor-prompt.ts`, die niemand erklaert hat. Jeder Konflikt musste durch einen
 * Lauf gefunden werden — viermal in der Serie CR-GC-560..568.
 *
 * Diese Abnahme haelt beides fest: die Ordnung selbst, und dass die beiden Stellen,
 * die sie anwenden, sie wirklich aus `channel-rank.ts` beziehen und nicht noch einmal
 * selbst entscheiden.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHANNEL_ORDER, CHANNEL_REASON, rankOf, outranks, winner, byRank } from '../src/loop/channel-rank.js';
import { generationStep, RULE_CLAUSE, GENERATION_TEMPLATE, DIMENSION_FOCUS_TYPES } from '../src/loop/generate.js';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';

describe('die Ordnung selbst (CR-GC-575)', () => {
  it('ist absteigend nach Verbindlichkeit und vollstaendig begruendet', () => {
    expect([...CHANNEL_ORDER]).toEqual([
      'gate-truth', 'rule-clause', 'grammar', 'inventory', 'guidance', 'proposal',
    ]);
    // Ein Rang ohne Begruendung ist Geschmack — genau das, was die CR ausschliesst.
    for (const channel of CHANNEL_ORDER) expect(CHANNEL_REASON[channel]).toBeTruthy();
    expect(Object.keys(CHANNEL_REASON).sort()).toEqual([...CHANNEL_ORDER].sort());
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

  it('byRank sortiert stabil — zwei Bloecke desselben Kanals behalten ihre Folge', () => {
    const sortiert = byRank([
      { channel: 'proposal' as const, id: 'p1' },
      { channel: 'guidance' as const, id: 'g' },
      { channel: 'proposal' as const, id: 'p2' },
      { channel: 'grammar' as const, id: 'gr' },
    ]);
    expect(sortiert.map((b) => b.id)).toEqual(['gr', 'g', 'p1', 'p2']);
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
    const [dimension, regel] = (step.focusKey as string).split(':');
    const klausel = RULE_CLAUSE[regel];
    // Vorbedingung der Aussage: dieses Fenster wird WIRKLICH von einer Regel mit Klausel
    // gestellt. Ohne diese Kontrolle prueft der Rest nichts.
    expect(klausel, `Fenster ${step.focusKey} stellt keine Klausel-Regel`).toBeTruthy();
    expect(step.prompt).toContain(klausel.text(['UC-bestellen']));
    expect(step.focusTypes).toEqual([...klausel.types]);
    // Und die Dimensions-Vorlage (Rang 6) steht NICHT daneben — ein Imperativ je Runde.
    expect(step.prompt).not.toContain(GENERATION_TEMPLATE[dimension]);
    expect(step.focusTypes).not.toEqual(DIMENSION_FOCUS_TYPES[dimension]);
  });

  it('die beiden anwendenden Stellen beziehen die Ordnung aus channel-rank, statt sie zu wiederholen', () => {
    // Kriterium 1 der CR: "an genau einer Stelle im Code, nicht in fuenf Bedingungen".
    // Prueflicher Stellvertreter: beide Stellen importieren die Ordnung, und keine von
    // beiden traegt noch eine eigene Vorrang-Verzweigung auf `klausel`/Blockreihenfolge.
    const generate = readFileSync(new URL('../src/loop/generate.ts', import.meta.url), 'utf8');
    const prompt = readFileSync(new URL('../src/loop/executor-prompt.ts', import.meta.url), 'utf8');
    expect(generate).toContain("from './channel-rank.js'");
    expect(prompt).toContain("from './channel-rank.js'");
    // Der alte Ternaer: `klausel ? [...klausel.types] : ...` — die zweite Entscheidung
    // derselben Frage. Sie darf nicht zurueckkehren.
    expect(generate).not.toMatch(/klausel\s*\n?\s*\?\s*\[\.\.\.klausel\.types\]/);
    expect(prompt).toContain('byRank(blocks)');
  });
});
