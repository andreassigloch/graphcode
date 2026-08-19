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
 * Two data points: the real graphcode SSOT (current size) and a 5x clone of
 * it (scaling trend). Reports numbers; does NOT assert a target threshold --
 * that's the REQ this spike is meant to inform, not assume.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { targetFor, suggestEdits } from '@sigloch/se-optimizer';
import { GraphCodeHarness } from '../src/harness.js';
import { exportGraphJson } from '../src/exporter.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { OntologyGraph } from '@sigloch/contracts/se';

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

/** Clone the real graph N times with disambiguated uids -- same shape/density, N x the size. */
function cloneGraph(base: RawGraph, times: number): RawGraph {
  const elements: any[] = [];
  const traces: any[] = [];
  for (let i = 0; i < times; i++) {
    const suffix = i === 0 ? '' : `-c${i}`;
    const remap = (id: string) => `${id}${suffix}`;
    for (const e of base.elements) elements.push({ ...e, id: remap(e.id) });
    for (const t of base.traces) traces.push({ ...t, source: remap(t.source), target: remap(t.target) });
  }
  return { elements, traces };
}

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

describe('SPIKE-GC-advisory-roundtrip-latency', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  afterEach(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('real graphcode SSOT size (382 nodes / 785 edges): 5 rounds, report median', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-spike-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(loadRealGraph() as any);

    const rounds: Awaited<ReturnType<typeof measureRound>>[] = [];
    for (let i = 0; i < 5; i++) rounds.push(await measureRound(harness, 'FUNC-mutate'));

    const totals = rounds.map((r) => r.totalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[SPIKE real-size] median total=${median(totals).toFixed(1)}ms ` +
        `(read=${median(rounds.map((r) => r.readMs)).toFixed(1)}, ` +
        `status=${median(rounds.map((r) => r.statusMs)).toFixed(1)}, ` +
        `propose=${median(rounds.map((r) => r.proposeMs)).toFixed(1)}, ` +
        `apply=${median(rounds.map((r) => r.applyMs)).toFixed(1)}) ` +
        `suggestions=${rounds[0].suggestionCount}`,
    );
    // Sanity ceiling only -- catches a true hang/regression, not a target.
    expect(median(totals)).toBeLessThan(10_000);
  }, 60_000);

  it('5x cloned SSOT (~1910 nodes / ~3925 edges): 3 rounds, report median (scaling data point)', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-spike-big-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    const big = cloneGraph(loadRealGraph(), 5);
    await harness.importGraph(big as any);

    const rounds: Awaited<ReturnType<typeof measureRound>>[] = [];
    for (let i = 0; i < 3; i++) rounds.push(await measureRound(harness, 'FUNC-mutate'));

    const totals = rounds.map((r) => r.totalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[SPIKE 5x-clone, ${big.elements.length} nodes / ${big.traces.length} edges] median total=${median(totals).toFixed(1)}ms ` +
        `(read=${median(rounds.map((r) => r.readMs)).toFixed(1)}, ` +
        `status=${median(rounds.map((r) => r.statusMs)).toFixed(1)}, ` +
        `propose=${median(rounds.map((r) => r.proposeMs)).toFixed(1)}, ` +
        `apply=${median(rounds.map((r) => r.applyMs)).toFixed(1)}) ` +
        `suggestions=${rounds[0].suggestionCount}`,
    );
    expect(median(totals)).toBeLessThan(30_000);
  }, 90_000);
});
