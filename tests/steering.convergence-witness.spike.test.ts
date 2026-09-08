/**
 * CR-GC-407 — Spike: Konvergenz-Zeuge über der Steering-Trajektorie.
 *
 * Frage: trennt ein skalarer Zeuge w·m(G) (ℝ⁶, layer 'arch', target-profile-
 * Gewichte, leer ⇒ Gleichgewichtung) plus Zustands-Archiv (sha256 des
 * kanonischen exportGraphJson) die drei Endzustände konvergent / zyklisch /
 * stationär?
 *
 * KEIN Produktionscode — Messung + Klassifikator leben nur in
 * tests/helpers/witness.ts. Metriken ausschließlich über toOntologyGraph +
 * se-engine metrics (derselbe Mapper wie fitAdvisory/Snapshot, CR-GC-303/324).
 *
 * Drei Sequenzen, alle durch das echte Apply-Gate (real disk Kuzu, no mocks):
 *   1. konvergent  — SSOT-Kopie, degradiert um 12 verify- + 4 satisfy-Kanten,
 *                    dann 16 Violation-schließende Mutationen (se:close-violations-Muster)
 *   2. zyklisch    — konstruierter Kreis A→B→C→A über 6 FUNCs, bei dem JEDER
 *                    Paar-Delta-Schritt mindestens eine Dimension hebt
 *   3. stationär   — No-Op-nahe Doku-Mutationen, Topologie unangetastet
 *
 * Die Messzahlen (Totzone, Monotonie-Verlauf, Revisit-Indizes) werden geloggt
 * und im CR-Ergebnis-Nachtrag zitiert.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR, type Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { computeFitAdvisory } from '../src/kernel/measure/fit-advisory.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { witnessSample, classifySequence, type WitnessSample } from './helpers/witness.js';

const REPO_ROOT = join(__dirname, '..');
const GRAPH_JSON = join(REPO_ROOT, 'docs/graph/graphcode.graph.json');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

interface TraceJson {
  source: string;
  target: string;
  type: string;
  [k: string]: unknown;
}

interface GraphJson {
  elements: Array<Record<string, unknown>>;
  traces: TraceJson[];
}

/** Zustand nach einer Gate-Mutation einfrieren (getGraph liefert die lebende Kopie). */
function freeze(harness: GraphCodeHarness): Graph {
  return structuredClone(harness.getGraph());
}

describe('CR-GC-407 Spike: Konvergenz-Zeuge (w·m(G) + Zustands-Archiv)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  async function boot(fixture: { elements: unknown[]; traces: unknown[] }): Promise<void> {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-witness-spike-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture as Parameters<GraphCodeHarness['importGraph']>[0]);
  }

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Sequenz 1 — konvergent: SSOT-Kopie, Violation-schließende Mutationen
  // -------------------------------------------------------------------------

  it(
    'konvergente Sequenz: kein Fehlalarm; Totzone und Monotonie-Verlauf gemessen',
    async () => {
      const raw = JSON.parse(readFileSync(GRAPH_JSON, 'utf8')) as GraphJson & {
        graphVersion?: unknown;
      };
      // Degradieren: die ersten 12 verify- + 4 satisfy-Kanten entfernen — jede
      // Re-Addition schließt danach eine reale offene Violation (R-01/R-21-Klasse).
      const removedVerify = raw.traces.filter((t) => t.type === 'verify').slice(0, 12);
      const removedSatisfy = raw.traces.filter((t) => t.type === 'satisfy').slice(0, 4);
      const removed = [...removedVerify, ...removedSatisfy];
      const removedKey = new Set(removed.map((t) => `${t.source}|${t.type}|${t.target}`));
      const degraded = {
        elements: raw.elements,
        traces: raw.traces.filter((t) => !removedKey.has(`${t.source}|${t.type}|${t.target}`)),
      };
      await boot(degraded);

      const samples: WitnessSample[] = [witnessSample(freeze(harness))];
      for (const t of removed) {
        const { source, target, type, ...attrs } = t;
        const res = await harness.mutate([
          {
            op: 'add-edge',
            edge: { sourceId: source, targetId: target, edgeType: type, attributes: attrs },
          } as MutateCommand,
        ]);
        expect(res.success).toBe(true);
        samples.push(witnessSample(freeze(harness)));
      }
      expect(samples.length).toBe(removed.length + 1);

      const report = classifySequence(samples);
      console.log('[Sequenz 1 konvergent] Zeugen-Verlauf w·m:', samples.map((s) => +s.scalar.toFixed(6)));
      console.log('[Sequenz 1 konvergent] Δ je Schritt:', report.deltas.map((d) => +d.toFixed(6)));
      console.log('[Sequenz 1 konvergent] Totzonen-Anteil (|Δ|≈0):', report.deadZoneShare);
      console.log('[Sequenz 1 konvergent] Klassifikation:', report.verdict, report.revisit ?? '');

      // Kein Fehlalarm: der Zyklus-Detektor feuert NICHT auf echter Konvergenz.
      expect(report.verdict).not.toBe('cyclic');
      expect(report.revisit).toBeUndefined();

      // Die ehrliche Zahl (Kill-Kriterium "Totzone > ~50 %"): verify/satisfy-
      // Kanten liegen außerhalb des arch-Layers — der Zeuge bewegt sich auf
      // KEINEM der 16 Violation-schließenden Schritte. Totzone = 100 %.
      expect(report.deadZoneShare).toBe(1);
      // Damit ist echte Konvergenz vom Stillstand ununterscheidbar: die
      // Spec-Erwartung "Zeuge steigt" ist widerlegt, die Sequenz klassifiziert
      // als 'stationary' statt 'progressing'.
      expect(report.verdict).toBe('stationary');
    },
    180_000,
  );

  // -------------------------------------------------------------------------
  // Sequenz 2 — konstruierter Zyklus A→B→C→A (nicht-transitiv)
  // -------------------------------------------------------------------------

  // 6 FUNCs, EIN compose-Baum (a→b, a→c, c→d, d→e) + die rotierende ELTERNKANTE
  // von FUNC-f; die drei Zustände unterscheiden sich nur in ihr:
  //   A: d→f   B: c→f   C: b→f   (f wandert die Kette hinauf und zurück)
  // Gemessen (Probe auf demselben Messpfad): A→B hebt flowEfficiency, B→C hebt
  // scalability, C→A hebt modifiability+flowEfficiency+coherence — jeder
  // Paar-Delta-Schritt sieht wie Fortschritt aus, die Summe ist 0.
  //
  // CR-GC-488: die frühere Fixture rotierte eine ZUSATZkante (A: a→d, B: a→e,
  // C: b→c) und gab dem Zielknoten damit je einen ZWEITEN compose-Elternteil.
  // Seit CR-SM-283 ist das R-18 (`error`, "die compose-Bäume müssen Bäume
  // bleiben`) — das Gate wies alle drei Schritte zurück, und zwar zu Recht. Die
  // Rotation VERSCHIEBT die Kante jetzt, statt eine zweite anzulegen; jeder
  // Zustand ist ein legaler Baum (nachgemessen: 0 error-Befunde je Zustand).
  const CYCLE_FIXTURE = {
    elements: ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ({
      id: `FUNC-${n}`,
      type: 'FUNC',
      name: n,
      description: '',
    })),
    traces: [
      { source: 'FUNC-a', target: 'FUNC-b', type: 'compose' },
      { source: 'FUNC-a', target: 'FUNC-c', type: 'compose' },
      { source: 'FUNC-c', target: 'FUNC-d', type: 'compose' },
      { source: 'FUNC-d', target: 'FUNC-e', type: 'compose' },
      // Zustand A: die rotierende Elternkante von FUNC-f
      { source: 'FUNC-d', target: 'FUNC-f', type: 'compose' },
    ],
  };

  const swap = (del: [string, string], add: [string, string]): MutateCommand[] => [
    { op: 'delete-edge', edge: { sourceId: del[0], targetId: del[1], edgeType: 'compose' } },
    {
      op: 'add-edge',
      edge: { sourceId: add[0], targetId: add[1], edgeType: 'compose', attributes: {} },
    },
  ];

  it('konstruierter Zyklus: jeder Paar-Delta-Schritt positiv, Detektor erkennt den Kreis', async () => {
    await boot(CYCLE_FIXTURE);
    const states: Graph[] = [freeze(harness)]; // A
    const steps: Array<[[string, string], [string, string]]> = [
      [['FUNC-d', 'FUNC-f'], ['FUNC-c', 'FUNC-f']], // A→B
      [['FUNC-c', 'FUNC-f'], ['FUNC-b', 'FUNC-f']], // B→C
      [['FUNC-b', 'FUNC-f'], ['FUNC-d', 'FUNC-f']], // C→A
    ];
    for (const [del, add] of steps) {
      const res = await harness.mutate(swap(del, add));
      expect(res.success).toBe(true);
      states.push(freeze(harness));
    }

    // Die Paar-Delta-Sicht (computeFitAdvisory, strikt before/after): JEDER
    // Schritt hebt mindestens eine Dimension — der Kreis sieht schrittweise
    // wie Fortschritt aus.
    for (let i = 1; i < states.length; i++) {
      const adv = computeFitAdvisory(states[i - 1], states[i]);
      const positive = adv.dimensions.filter((_, q) => adv.delta[q] > 1e-9);
      console.log(`[Sequenz 2 Zyklus] Schritt ${i} Paar-Δ:`, adv.delta.map((d) => +d.toFixed(4)), '→ hebt', positive);
      expect(positive.length).toBeGreaterThan(0);
    }

    const samples = states.map((g) => witnessSample(g));
    console.log('[Sequenz 2 Zyklus] Zeugen-Verlauf w·m:', samples.map((s) => +s.scalar.toFixed(6)));

    // NEGATIV-KONTROLLE (die Blindheit, die den Spike motiviert): ohne
    // Zustands-Archiv — Hashes anonymisiert — ist der Kreis unsichtbar; die
    // Witness-only-Sicht klassifiziert 'progressing', nie 'cyclic'.
    const blind = classifySequence(samples.map((s, i) => ({ ...s, hash: `blind-${i}` })));
    console.log('[Sequenz 2 Zyklus] ohne Archiv:', blind.verdict);
    expect(blind.verdict).toBe('progressing');

    // DER DETEKTOR: mit Zustands-Archiv feuert der Hash-Wiederbesuch — Zustand
    // A (Index 0) wird bei Schritt 3 byte-identisch wieder erreicht.
    const report = classifySequence(samples);
    console.log('[Sequenz 2 Zyklus] mit Archiv:', report.verdict, report.revisit);
    expect(report.verdict).toBe('cyclic');
    expect(report.revisit).toEqual({ at: 3, seenAt: 0 });
  });

  // -------------------------------------------------------------------------
  // Sequenz 3 — stationär: No-Op-nahe Mutationen, Topologie unangetastet
  // -------------------------------------------------------------------------

  it('stationäre Sequenz: als "fertig" klassifiziert, nicht als Schleife', async () => {
    await boot(CYCLE_FIXTURE);
    const samples: WitnessSample[] = [witnessSample(freeze(harness))];
    for (let i = 1; i <= 5; i++) {
      const res = await harness.mutate([
        {
          op: 'update-node',
          node: { uid: 'FUNC-f', description: `Doku-Feinschliff ${i}, Topologie unangetastet` },
        } as MutateCommand,
      ]);
      expect(res.success).toBe(true);
      samples.push(witnessSample(freeze(harness)));
    }

    const report = classifySequence(samples);
    console.log('[Sequenz 3 stationär] Zeugen-Verlauf w·m:', samples.map((s) => +s.scalar.toFixed(6)));
    console.log('[Sequenz 3 stationär] Klassifikation:', report.verdict, 'Totzone:', report.deadZoneShare);

    // Zeuge flach, aber jeder Zustand ein NEUER Hash (die Doku ändert sich) —
    // kein Wiederbesuch ⇒ 'stationary' ("fertig"), NICHT 'cyclic'.
    expect(report.deltas.every((d) => Math.abs(d) <= 1e-9)).toBe(true);
    expect(report.verdict).toBe('stationary');
    expect(report.revisit).toBeUndefined();
  });
});
