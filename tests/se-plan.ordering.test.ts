/**
 * TEST-se-plan-ordering (CR-GC-209) — the graph-derived implementation-plan order.
 *
 * Skill-agnostic: pins the topological derivation against a seeded graph, not the
 * prompt text. A `depends-on` chain must order so every prerequisite precedes its
 * dependent; an intentional forward dependency must be REPORTED (not silently
 * ordered); a cycle must be reported and its nodes left out of the order.
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { deriveImplPlan } from '../src/loop/se-plan.js';

const node = (uid: string) => ({ uid, type: 'MS', name: uid, description: '', attributes: {} });
const dep = (from: string, to: string) => ({
  // `from depends-on to` — to is the prerequisite.
  sourceId: from,
  targetId: to,
  edgeType: 'relation',
  attributes: { label: 'depends-on' },
});

describe('TEST-se-plan-ordering (CR-GC-209): graph-derived plan order', () => {
  it('orders a depends-on chain so every prerequisite precedes its dependent', () => {
    // MS-2 depends-on MS-1, MS-3 depends-on MS-2  +  forward anomaly: MS-1 depends-on MS-4.
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-1', 'MS-2', 'MS-3', 'MS-4'].map(node),
      edges: [dep('MS-2', 'MS-1'), dep('MS-3', 'MS-2'), dep('MS-1', 'MS-4')],
    };
    const plan = deriveImplPlan(graph);
    const pos = (u: string) => plan.order.indexOf(u);

    // Every depends-on edge respected: target before source.
    for (const e of graph.edges) {
      expect(pos(e.targetId)).toBeGreaterThanOrEqual(0);
      expect(pos(e.targetId)).toBeLessThan(pos(e.sourceId));
    }
    // The forward anomaly (MS-1 depends on higher-numbered MS-4) is the prerequisite —
    // so MS-4 lands first despite its id; the plan does not follow naive id order.
    expect(plan.order[0]).toBe('MS-4');
    expect(plan.cycles).toEqual([]);
  });

  it('REPORTS a forward dependency (lower id depends on higher id), not silently', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-1', 'MS-2', 'MS-3', 'MS-4'].map(node),
      edges: [dep('MS-2', 'MS-1'), dep('MS-3', 'MS-2'), dep('MS-1', 'MS-4')],
    };
    const plan = deriveImplPlan(graph);
    expect(plan.forwardViolations).toContainEqual({ from: 'MS-1', to: 'MS-4' });
    // The clean backward deps (MS-2→MS-1, MS-3→MS-2) are NOT flagged.
    expect(plan.forwardViolations).toHaveLength(1);
  });

  it('reports a cycle and refuses to silently order its nodes', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-5', 'MS-6', 'MS-7'].map(node),
      edges: [dep('MS-5', 'MS-6'), dep('MS-6', 'MS-5'), dep('MS-7', 'MS-6')],
    };
    const plan = deriveImplPlan(graph);
    expect(plan.cycles.length).toBeGreaterThan(0);
    expect(plan.cycles[0]).toEqual(expect.arrayContaining(['MS-5', 'MS-6']));
    // Cyclic nodes are not in the order (not vacuously "ordered").
    expect(plan.order).not.toContain('MS-5');
    expect(plan.order).not.toContain('MS-6');
  });

  it('ignores non-depends-on relation edges (CR→MS assignment is not a dependency)', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['CR-a', 'MS-1'].map(node),
      edges: [{ sourceId: 'CR-a', targetId: 'MS-1', edgeType: 'relation', attributes: {} }],
    };
    const plan = deriveImplPlan(graph);
    // No depends-on edges → empty plan, nothing to order, no false cycle.
    expect(plan.order).toEqual([]);
    expect(plan.cycles).toEqual([]);
    expect(plan.forwardViolations).toEqual([]);
  });
});

/**
 * CR-GC-550 — die Deckung zaehlt ueber REQ, nicht ueber FUNC-Blaetter.
 *
 * Der Befund (Fremdlauf sigllm, 17./18.09.): der Plan meldete "20 von 20 geordnet, keine Zyklen"
 * und hatte damit eine Vollstaendigkeitsaussage ueber die Menge gemacht, die er sich selbst
 * gewaehlt hatte. Die Ontologie kennt VIER Traeger fuer ein REQ — RD-01 akzeptiert `satisfy` von
 * FUNC, FCHAIN, MOD und SYS. Im gemessenen Lauf: 64 Blatt-REQ, getragen von FUNC 32, MOD 20,
 * FCHAIN 7, SYS 5. Der Plan sah ein Viertel davon.
 *
 * Nachgerechnet am echten Lauf (2026-09-22): am committeten sigllm-Stand **v101 liefert
 * `reqCoverage` 40 von 64** — genau die Zahl, die der CR vorab genannt hat. (v99 ist kein
 * Export; v98 liest 27 von 64, v101 ist der naechste committete Stand.) Am heutigen Stand v302
 * sind es 65 von 65 — die Luecke hat CR-SL-050 geschlossen.
 *
 * Die Deckungsdefinition ist woertlich die von CR-SM-343. Weicht eine der beiden ab, ist die Zahl
 * wieder zwei Wahrheiten.
 */
describe('TEST-se-plan-ordering (CR-GC-550): die Deckung zaehlt ueber Blatt-REQ', () => {
  const el = (uid: string, type: string) => ({ uid, type, name: uid, description: '', attributes: {} });
  const rel = (from: string, to: string) => ({ sourceId: from, targetId: to, edgeType: 'relation', attributes: {} });
  const kante = (from: string, to: string, edgeType: string) => ({ sourceId: from, targetId: to, edgeType, attributes: {} });

  it('alle vier Traeger kommen vor — der Plan nennt vier Auftraege, nicht einen', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [
        el('CR-1', 'CR'), el('CR-2', 'CR'), el('CR-3', 'CR'), el('CR-4', 'CR'),
        el('FUNC-a', 'FUNC'), el('FCHAIN-b', 'FCHAIN'), el('MOD-c', 'MOD'), el('SYS-d', 'SYS'),
        el('REQ-func', 'REQ'), el('REQ-chain', 'REQ'), el('REQ-mod', 'REQ'), el('REQ-sys', 'REQ'),
      ],
      edges: [
        kante('FUNC-a', 'REQ-func', 'satisfy'), kante('FCHAIN-b', 'REQ-chain', 'satisfy'),
        kante('MOD-c', 'REQ-mod', 'satisfy'), kante('SYS-d', 'REQ-sys', 'satisfy'),
        // Vier Bauauftraege: zwei am Traeger (FUNC/FCHAIN decken), zwei DIREKT am REQ
        // (die Konvention aus CR-SM-343 fuer MOD/SYS-Traeger).
        rel('CR-1', 'FUNC-a'), rel('CR-2', 'FCHAIN-b'), rel('CR-3', 'REQ-mod'), rel('CR-4', 'REQ-sys'),
      ],
    };
    const { reqCoverage } = deriveImplPlan(graph);
    expect(reqCoverage.leaf).toEqual(['REQ-chain', 'REQ-func', 'REQ-mod', 'REQ-sys']);
    expect(reqCoverage.uncovered).toEqual([]);
    expect(reqCoverage.covered).toHaveLength(4);
  });

  it('ein CR auf dem MODUL deckt das REQ NICHT — erst die direkte CR→REQ-Kante schliesst es', () => {
    // Die tragende Entscheidung aus CR-SM-343: rechnet man MOD/SYS mit, liest dieselbe Stelle
    // am selben Graphstand 55 von 64 statt 40 von 64 und sieht gesund aus, waehrend 24 REQ
    // keinen Auftrag haben. Ein Modul ist ein Behaelter.
    const basis: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [el('CR-1', 'CR'), el('MOD-c', 'MOD'), el('REQ-mod', 'REQ')],
      edges: [kante('MOD-c', 'REQ-mod', 'satisfy'), rel('CR-1', 'MOD-c')],
    };
    expect(deriveImplPlan(basis).reqCoverage.uncovered).toEqual(['REQ-mod']);

    const mitDirekt = { ...basis, edges: [...basis.edges, rel('CR-1', 'REQ-mod')] };
    expect(deriveImplPlan(mitDirekt).reqCoverage.uncovered).toEqual([]);
  });

  it('Nicht-Blatt-REQ zaehlen nicht — die Kinder tragen die Deckung, wie bei RD-01', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [el('CR-1', 'CR'), el('REQ-elter', 'REQ'), el('REQ-kind', 'REQ'), el('FUNC-a', 'FUNC')],
      edges: [
        kante('REQ-elter', 'REQ-kind', 'compose'),
        kante('FUNC-a', 'REQ-kind', 'satisfy'),
        rel('CR-1', 'FUNC-a'),
      ],
    };
    const { reqCoverage } = deriveImplPlan(graph);
    expect(reqCoverage.leaf).toEqual(['REQ-kind']); // der Elter ist nicht in der Grundgesamtheit
    expect(reqCoverage.uncovered).toEqual([]);
  });

  it('`depends-on` ist Reihenfolge, kein Umfang — eine CR→CR-Abhaengigkeit beauftragt nichts', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [el('CR-1', 'CR'), el('REQ-a', 'REQ')],
      edges: [{ sourceId: 'CR-1', targetId: 'REQ-a', edgeType: 'relation', attributes: { label: 'depends-on' } }],
    };
    expect(deriveImplPlan(graph).reqCoverage.uncovered).toEqual(['REQ-a']);
  });

  it('Regression: order, cycles und forwardViolations bleiben unberuehrt', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: ['MS-1', 'MS-2', 'MS-3'].map(node),
      edges: [dep('MS-2', 'MS-1'), dep('MS-3', 'MS-2')],
    };
    const plan = deriveImplPlan(graph);
    expect(plan.order).toEqual(['MS-1', 'MS-2', 'MS-3']);
    expect(plan.cycles).toEqual([]);
    expect(plan.forwardViolations).toEqual([]);
    // Ein Graph ohne REQ hat eine leere Grundgesamtheit — und damit nichts Ungedecktes.
    expect(plan.reqCoverage).toEqual({ leaf: [], covered: [], uncovered: [] });
  });
});
