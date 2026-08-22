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

/**
 * Cost ceiling at FIXED_NODES, in ms per node, for the whole four-step round.
 *
 * Derivation. The round is superlinear in node count -- measured 2026-08-22,
 * this machine, disk Kuzu:
 *    667 nodes / 1746 edges ->  1182 ms = 1.77 ms/node   (live SSOT)
 *   2000 nodes / 5232 edges ->  9205 ms = 4.60 ms/node   (FIXED_NODES)
 *   3335 nodes / 8730 edges -> 31745 ms = 9.52 ms/node   (5x clone, CR-GC-400)
 * 5x the nodes cost 22x the time (n^1.93) -- which is exactly why a per-node
 * figure is only comparable AT A FIXED SIZE, and why this ceiling is bound to
 * FIXED_NODES rather than to whatever the live model happens to be.
 *
 * 7 = the 4.60 ms/node measured at FIXED_NODES x ~1.5 for machine variance.
 * Deliberately tight: a rule path that gets 2x slower lands at ~7.6 ms/node
 * and MUST fail here (verified by running the rule step 4x -- CR-GC-400 AK
 * "rot gesehen"). A looser bound would pass that regression silently.
 *
 * This is an ENGINE ceiling, not a product target. It cannot drift with the
 * model: the input is FIXED_NODES nodes whatever the live SSOT does.
 */
const MAX_MS_PER_NODE = 7;

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

  it(`fixed ${FIXED_NODES} nodes / ${FIXED_GRAPH.traces.length} edges: 3 rounds, assert ms/node`, async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-spike-fixed-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXED_GRAPH as any);

    const rounds: Awaited<ReturnType<typeof measureRound>>[] = [];
    for (let i = 0; i < 3; i++) rounds.push(await measureRound(harness, 'FUNC-mutate'));

    const total = report(`fixed, ${FIXED_NODES} nodes`, rounds, FIXED_NODES);
    expect(total / FIXED_NODES).toBeLessThan(MAX_MS_PER_NODE);
  }, 120_000);
});
