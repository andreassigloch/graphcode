/**
 * CR-GC-983 — RC-04 in loop und projections: der Erzeuger parst sein Ergebnis an der Grenze.
 *
 * Rot-zuerst: jeder Fall gibt dem Erzeuger Eingaben, aus denen ein Wert ausserhalb des Vertrags
 * entsteht. Vor der Aenderung lief der Wert durch bis in die Werkzeug-Antwort bzw. in das
 * Lauf-Urteil; danach lehnt der Erzeuger ihn ab.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import { generationStep } from '../src/loop/generate.js';
import { laufUrteil } from '../src/projections/test-schlupf.js';

const LEER: Graph = { nodes: [], edges: [] };

describe('CR-GC-983: generationStep parst den Schritt', () => {
  it('lehnt einen Schritt mit Schwelle NaN ab', () => {
    expect(() => generationStep(LEER, DEFAULT_METRIC_POLICY, undefined, Number.NaN)).toThrow();
  });

  it('liefert fuer eine gueltige Schwelle den Schritt', () => {
    const step = generationStep(LEER, DEFAULT_METRIC_POLICY, undefined, 0.5);
    expect(step.threshold).toBe(0.5);
    expect(step.phase).toBe('seed');
  });
});

describe('CR-GC-983: laufUrteil parst das Urteil', () => {
  const lauf = { status: 1, signal: null, bericht: JSON.stringify({ testResults: [{ name: '/r/a.test.ts', status: 'failed' }] }) };

  it('lehnt ein Urteil ab, dessen rote Dateien keine Texte sind', () => {
    expect(() => laufUrteil(lauf, (() => 42) as unknown as (abs: string) => string)).toThrow();
  });

  it('liefert fuer eine gueltige Abbildung das Urteil', () => {
    expect(laufUrteil(lauf, (abs) => abs.replace('/r/', ''))).toEqual({ beleg: true, rot: ['a.test.ts'], gesamt: 1 });
  });
});
