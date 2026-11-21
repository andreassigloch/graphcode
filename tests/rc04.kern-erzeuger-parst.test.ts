/**
 * CR-GC-982 — RC-04 im Kern: der Erzeuger parst sein Ergebnis an der Grenze.
 *
 * Rot-zuerst: jeder Fall gibt dem Erzeuger Eingaben, aus denen ein Wert ausserhalb des Vertrags
 * entsteht (NaN, Zod `z.number()` weist ihn ab). Vor der Aenderung lief der Wert durch und stand in
 * der Werkzeug-Antwort; danach lehnt der Erzeuger ihn ab.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { computeSteeringDelta, type SteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';

function snapshot(blockingErrors: number): SteeringSnapshot {
  return { og: { elements: [], traces: [] }, violations: [], focus: [], blockingErrors, stages: [] } as unknown as SteeringSnapshot;
}

describe('CR-GC-982: der Erzeuger parst', () => {
  it('computeSteeringDelta lehnt ein Delta mit NaN ab', () => {
    expect(() => computeSteeringDelta(snapshot(Number.NaN), snapshot(0))).toThrow();
  });

  it('computeSteeringDelta liefert fuer gueltige Staende das Delta unveraendert', () => {
    expect(computeSteeringDelta(snapshot(2), snapshot(1))).toEqual({
      blockingErrors: { before: 2, after: 1 },
      stages: {},
    });
  });
});
