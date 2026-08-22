/**
 * SPIKE-GC-advisory-roundtrip-latency — wall-clock for the four real steps of
 * FCHAIN-advisory-roundtrip (read -> status -> propose -> apply), measured
 * in-process against a real disk Kuzu store (never :memory:, no mocks).
 *
 * Answers the open question behind REQ-responsiveness's <0.2s budget: that
 * REQ is scoped to "Draft-Apply + betroffener Subgraph" only (apply step,
 * bounded slice). This spike measures the FULL round an agent actually pays
 * per turn -- including status (evaluateRules, whole graph) and propose
 * (graph_suggest's suggestEdits, which re-evaluates ALL rules + the 6D
 * metric vector once per firing Operator-class rule) -- neither of which is
 * bounded to "the affected subgraph".
 *
 * Two data points, with DIFFERENT jobs (CR-GC-400):
 *
 *   ① the live SSOT at whatever size it has today -- REPORTS ONLY, no
 *      threshold. Its size is by definition moving; every node anyone adds
 *      makes it slower without the engine changing. A wall-clock bound here
 *      measures model growth and blames the engine for it.
 *   ② a FIXED-SIZE input (FIXED_NODES, built from the real graph's shape but
 *      cut to an exact node count) -- this one asserts, normalised to
 *      ms/node. Same input every run, so a regression is the engine's.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { targetFor, suggestEdits } from '@sigloch/se-engine';
import { GraphCodeHarness } from '../src/harness.js';
import { exportGraphJson } from '../src/exporter.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { OntologyGraph } from '@sigloch/contracts/se';

/** Fixed scaling point. ~3x the live SSOT of 2026-08-22 (667 nodes) -- far
 *  enough out to expose the superlinear rule-evaluation cost, small enough
 *  to stay well inside the test timeout. */
const FIXED_NODES = 2000;

/** Zweiter fester Punkt, 4x kleiner — er dient als MASCHINEN-EICHUNG (siehe
 *  MAX_GROWTH_FACTOR), nicht als eigener Messwert. */
const SMALL_NODES = 500;

/**
 * ZWEI Schranken, weil zwei verschiedene Regressionen existieren — und weil eine
 * einzige Wanduhr-Zahl auf der falschen Maschine geeicht wird.
 *
 * Belegt (CI-Historie, drei Läufe am 2026-08-19/20): der GitHub-Runner brauchte
 * fuer denselben Eingang 33 416 / 40 391 / 44 633 ms, wo diese Maschine 31 745 ms
 * mass — Faktor 1,05 bis 1,41. Eine absolute ms/Knoten-Schranke, hier eng geeicht,
 * geht dort rot, ohne dass sich an der Engine etwas geaendert hat. Genau der Fehler,
 * den CR-GC-400 abschaffen will, nur eine Ebene hoeher.
 *
 * (1) MAX_GROWTH_FACTOR — die eigentliche Aussage. Kosten pro Knoten bei
 *     FIXED_NODES geteilt durch die bei SMALL_NODES, BEIDE in DIESEM Lauf auf
 *     DIESER Maschine gemessen: die Maschinengeschwindigkeit kuerzt sich heraus.
 *     Gemessen 2026-08-22: 4,60 / 2,27 = 2,03 bei 4x Groesse. Schranke 3,0.
 *     Faengt eine Verschlechterung der SKALIERUNG (die Regelauswertung wird
 *     ueberlinearer) — unabhaengig davon, wie schnell die Maschine ist.
 *
 * (2) MAX_MS_PER_NODE — grobe Deckelung gegen einen Konstant-Faktor, den ein
 *     Verhaeltnis per Konstruktion NICHT sieht (ein gleichmaessig 2x langsamerer
 *     Regelpfad laesst das Verhaeltnis unveraendert). Geeicht auf die LANGSAMSTE
 *     Maschine, die den Test faehrt: 4,60 lokal x 1,41 (CI, schlechtester
 *     beobachteter Fall) = 6,5 -> Schranke 10.
 *     EHRLICHE GRENZE: bei 1,4x Maschinen-Streuung kann diese Schranke nur
 *     Regressionen groesser als rund 2x melden. Das Feine leistet (1).
 *
 * Beide sind ENGINE-Schranken, keine Produktziele, und beide haengen an festen
 * Eingangsgroessen — kein Knoten, den jemand anlegt, bewegt sie.
 */
const MAX_GROWTH_FACTOR = 3.0;
const MAX_MS_PER_NODE = 10;

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'spike-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

interface RawGraph {
  elements: any[];
  traces: any[];
}

function loadRealGraph(): RawGraph {
  const raw = readFileSync(join(process.cwd(), 'docs/graph/graphcode.graph.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * Build a graph of EXACTLY `targetNodes` nodes from the real graph's shape:
 * repeat disambiguated copies until the count is reached, cut at the target,
 * keep only traces whose both endpoints survived the cut.
 *
 * Copy 0 is always complete (the live SSOT is smaller than FIXED_NODES), so
 * every id the test addresses -- e.g. FUNC-mutate -- is present untouched.
 * The node count is invariant to the live SSOT's size; edge count still
 * follows its density, which is why the assertion is per NODE and the edge
 * count is printed rather than bounded.
 */
function buildFixedSizeGraph(base: RawGraph, targetNodes: number): RawGraph {
  const elements: any[] = [];
  const traces: any[] = [];
  const copies = Math.ceil(targetNodes / base.elements.length);
  for (let i = 0; i < copies; i++) {
    const suffix = i === 0 ? '' : `-c${i}`;
    const remap = (id: string) => `${id}${suffix}`;
    for (const e of base.elements) elements.push({ ...e, id: remap(e.id) });
    for (const t of base.traces) traces.push({ ...t, source: remap(t.source), target: remap(t.target) });
  }
  const kept = elements.slice(0, targetNodes);
  const ids = new Set(kept.map((e) => e.id));
  return { elements: kept, traces: traces.filter((t) => ids.has(t.source) && ids.has(t.target)) };
}

// Loaded once at collection time so the test titles can name the size that is
// actually measured instead of a count inherited from an older model state.
const REAL_GRAPH = loadRealGraph();
const FIXED_GRAPH = buildFixedSizeGraph(REAL_GRAPH, FIXED_NODES);

async function measureRound(harness: GraphCodeHarness, impactRootId: string) {
  // ① read -- graph_impact's own engine call
  const t0 = performance.now();
  await harness.impact(impactRootId, 2);
  const readMs = performance.now() - t0;

  // ② status -- evaluateRules() against the whole in-memory graph
  const t1 = performance.now();
  harness.evaluateRules();
  const statusMs = performance.now() - t1;

  // ③ propose -- graph_suggest's actual internals (targetFor + suggestEdits),
  // same call graph_suggest's handler makes, minus the per-edit dryRun-gate
  // loop (that's ④ apply's cost, measured separately below).
  const t2 = performance.now();
  const og = JSON.parse(exportGraphJson(harness.getGraph())) as OntologyGraph;
  const target = targetFor({ scalability: 1 });
  const suggestions = suggestEdits(og, target, { k: 5, layer: 'arch' });
  const proposeMs = performance.now() - t2;

  // ④ apply -- one dryRun mutate (gate-checks a trivial no-op-shaped edit,
  // nothing persisted) -- the same dryRun preview graph_suggest itself runs
  // per suggestion before ever reaching a real graph_mutate.
  const t3 = performance.now();
  await harness.mutate(
    [{ op: 'update-node', node: { uid: impactRootId, attributes: {} } }],
    { dryRun: true },
  );
  const applyMs = performance.now() - t3;

  return { readMs, statusMs, proposeMs, applyMs, totalMs: readMs + statusMs + proposeMs + applyMs, suggestionCount: suggestions.length };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function report(label: string, rounds: Awaited<ReturnType<typeof measureRound>>[], nodes: number): number {
  const total = median(rounds.map((r) => r.totalMs));
  // eslint-disable-next-line no-console
  console.log(
    `[SPIKE ${label}] median total=${total.toFixed(1)}ms (${(total / nodes).toFixed(2)} ms/node) ` +
      `(read=${median(rounds.map((r) => r.readMs)).toFixed(1)}, ` +
      `status=${median(rounds.map((r) => r.statusMs)).toFixed(1)}, ` +
      `propose=${median(rounds.map((r) => r.proposeMs)).toFixed(1)}, ` +
      `apply=${median(rounds.map((r) => r.applyMs)).toFixed(1)}) ` +
      `suggestions=${rounds[0].suggestionCount}`,
  );
  return total;
}

describe('SPIKE-GC-advisory-roundtrip-latency', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  afterEach(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it(`live SSOT (${REAL_GRAPH.elements.length} nodes / ${REAL_GRAPH.traces.length} edges): 5 rounds, REPORT ONLY`, async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-spike-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(REAL_GRAPH as any);

    const rounds: Awaited<ReturnType<typeof measureRound>>[] = [];
    for (let i = 0; i < 5; i++) rounds.push(await measureRound(harness, 'FUNC-mutate'));

    // No threshold, by design: this input grows with the model, so any bound
    // here would be a bound on model growth. The 60s test timeout is the hang
    // guard; the number itself belongs in the log, not in an assertion.
    report(`live-size, ${REAL_GRAPH.elements.length} nodes`, rounds, REAL_GRAPH.elements.length);
  }, 60_000);

  /** Ein Messpunkt fester Groesse: eigener Store, messen, aufraeumen. */
  async function measureAt(nodes: number, label: string): Promise<number> {
    tmp = mkdtempSync(join(tmpdir(), `graphcode-spike-${nodes}-`));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(buildFixedSizeGraph(REAL_GRAPH, nodes) as any);
    const rounds: Awaited<ReturnType<typeof measureRound>>[] = [];
    for (let i = 0; i < 3; i++) rounds.push(await measureRound(harness, 'FUNC-mutate'));
    const total = report(label, rounds, nodes);
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
    tmp = '';
    return total / nodes;
  }

  it(`Skalierung ${SMALL_NODES} -> ${FIXED_NODES} Knoten: feste Eingaenge, Maschine kuerzt sich raus`, async () => {
    const small = await measureAt(SMALL_NODES, `calibration, ${SMALL_NODES} nodes`);
    const big = await measureAt(FIXED_NODES, `fixed, ${FIXED_NODES} nodes`);
    const growth = big / small;
    // eslint-disable-next-line no-console
    console.log(
      `[SPIKE scaling] ${small.toFixed(2)} -> ${big.toFixed(2)} ms/node ` +
        `= Faktor ${growth.toFixed(2)} bei ${FIXED_NODES / SMALL_NODES}x Groesse ` +
        `(Schranken: Faktor < ${MAX_GROWTH_FACTOR}, absolut < ${MAX_MS_PER_NODE} ms/Knoten)`,
    );
    expect(growth).toBeLessThan(MAX_GROWTH_FACTOR);
    expect(big).toBeLessThan(MAX_MS_PER_NODE);
  }, 240_000);
});
