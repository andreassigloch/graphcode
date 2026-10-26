/**
 * TEST-constraint-ein-schreibweg (CR-GC-851) — der Constraint „Ein Schreibweg" an FUNC-graph-store.
 *
 * Inhalt kommt in den Store nur über das Apply-Gate (FLOW-graph-delta), die Import-Operation
 * (FLOW-imported-graph) und die vier Lebenszyklus-Flüsse. Ein siebter Eingang wäre ein zweiter
 * Schreibweg — und den legt ein Zug am Modell an, ohne dass sich Code ändert.
 *
 * Liest den committeten Snapshot. Eine Modelländerung kann ihn rot machen — das ist der Zweck,
 * deshalb steht er in `scripts/model-test-set.mjs` (Weg A, CR-GC-804).
 *
 * Ratsche wie `tests/import-boundaries.test.ts`: ein neuer Fluss ist rot, bis der Autor ihn in
 * ERLAUBT aufnimmt; ein entfallener ist rot, bis der Autor ihn streicht.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { OntologyGraph } from '@sigloch/contracts/se';
import { EingangsBefund, eingaengeNurAus } from '../src/kernel/measure/constraints.js';

const SNAPSHOT = fileURLToPath(new URL('../docs/graph/graphcode.graph.json', import.meta.url));
const lies = (): OntologyGraph => JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as OntologyGraph;

const STORE = 'FUNC-graph-store';

/** Die erlaubten Eingänge des Stores, geprüft am Modell (graphVersion 904). */
const ERLAUBT = [
  'FLOW-graph-delta', // FUNC-mutate — jede Änderung durch das Apply-Gate
  'FLOW-imported-graph', // FUNC-import — ein ganzer Graph ersetzt den Store
  'FLOW-store-build', // FUNC-create-harness — Store öffnen
  'FLOW-store-close', // FUNC-serve-stdio — schließen (MCP-Host)
  'FLOW-store-close-cli', // FUNC-cli-dispatch — schließen (CLI)
  'FLOW-store-close-rewind', // FUNC-rewind — schließen vor dem Zurückspulen
];

describe('CR-GC-851: Constraint „Ein Schreibweg" an FUNC-graph-store', () => {
  it('am committeten Modell: nur die sechs erlaubten Eingänge, keiner fehlt', () => {
    expect(eingaengeNurAus(lies(), STORE, ERLAUBT)).toEqual({ fremd: [], fehlend: [] });
  });

  it('Positivkontrolle: ein siebter Fluss von einer anderen FUNC ist rot und nennt den Absender', () => {
    const g = lies();
    g.elements.push({ id: 'FLOW-zweiter-schreibweg', type: 'FLOW', name: 'Zweiter Schreibweg' } as OntologyGraph['elements'][number]);
    g.traces.push(
      { source: 'FUNC-graph-suggest', target: 'FLOW-zweiter-schreibweg', type: 'io' } as OntologyGraph['traces'][number],
      { source: 'FLOW-zweiter-schreibweg', target: STORE, type: 'io' } as OntologyGraph['traces'][number],
    );
    expect(g.elements.some((e) => e.id === 'FUNC-graph-suggest')).toBe(true);

    expect(eingaengeNurAus(g, STORE, ERLAUBT)).toEqual({
      fremd: [{ fluss: 'FLOW-zweiter-schreibweg', absender: ['FUNC-graph-suggest'] }],
      fehlend: [],
    });
    // Die Ratsche: nimmt der Autor den Fluss auf, ist es wieder grün.
    expect(eingaengeNurAus(g, STORE, [...ERLAUBT, 'FLOW-zweiter-schreibweg'])).toEqual({ fremd: [], fehlend: [] });
  });

  it('Gegenrichtung: ein Fluss der Liste, der nicht mehr in den Store führt, ist rot', () => {
    const g = lies();
    g.traces = g.traces.filter((t) => !(t.source === 'FLOW-store-close-rewind' && t.target === STORE));
    expect(eingaengeNurAus(g, STORE, ERLAUBT)).toEqual({ fremd: [], fehlend: ['FLOW-store-close-rewind'] });
    // Ein Eintrag, den es im Modell nie gab, ebenso.
    expect(eingaengeNurAus(lies(), STORE, [...ERLAUBT, 'FLOW-gibt-es-nicht']).fehlend).toEqual(['FLOW-gibt-es-nicht']);
  });

  it('Vertrag EingangsBefund (SCHEMA-eingangs-befund): nimmt jede Form des Befunds an, lehnt fremde ab', () => {
    expect(EingangsBefund.parse({ fremd: [], fehlend: [] })).toEqual({ fremd: [], fehlend: [] });
    const voll = { fremd: [{ fluss: 'FLOW-a', absender: ['FUNC-b'] }], fehlend: ['FLOW-c'] };
    expect(EingangsBefund.parse(voll)).toEqual(voll);
    expect(EingangsBefund.safeParse({ fremd: [] }).success).toBe(false); // fehlend fehlt
    expect(EingangsBefund.safeParse({ fremd: [], fehlend: [], gruen: true }).success).toBe(false); // fremdes Feld
    expect(EingangsBefund.safeParse({ fremd: [{ fluss: 'FLOW-a', absender: 'FUNC-b' }], fehlend: [] }).success).toBe(false);
  });
});
