/**
 * T-0 (CR-GC-340) — ONE measurement path.
 *
 * `nextStep()`, `generationStep()` and the `steeringDelta` branch of the dryRun
 * verdict must return the SAME violation set, the SAME per-dimension readiness
 * scores and the SAME blocking-error count for the SAME graph. If they drift,
 * claims a), b) and c) are all void no matter how green their own tests are:
 * every one of them is stated in these numbers.
 *
 * Regression guard for the bug class CR-GC-303/324. The flat export encoding
 * (CR-216/219) lifts `attributes.*` to the top level, while the contracts rules
 * read `element.attributes?.x`. Any surface that measures via
 * `JSON.parse(exportGraphJson(...))` therefore sees R-19/R-20/R-26/VR-01/AF-01..05
 * differently from the surfaces that go through `takeSteeringSnapshot` — which
 * silently reorders the focus dimensions. `ARCH_FIXTURE` carries `realRef`,
 * `testRefs` and `SYS.analysisFreshness` precisely so that divergence is visible
 * here instead of in production.
 *
 * Real disk Kuzu (temp dir), no mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { nextStep } from '../src/steering.js';
import { generationStep } from '../src/generate.js';
import { takeSteeringSnapshot } from '../src/steering-snapshot.js';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';
import type { SteeringDelta } from '../src/steering-snapshot.js';

/** The attribute-borne bindings whose judgement flips on a flattened encoding. */
const ATTRIBUTE_BORNE_RULES = ['R-19', 'R-20', 'R-26', 'VR-01', 'AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05'];

describe('T-0 (CR-GC-340): every steering surface measures the same graph', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-measure-path-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(ARCH_FIXTURE);
    tools = bindToolsToHarness(harness);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const snapshot = () =>
    takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());

  it('the fixture actually exercises the attribute-borne rules (otherwise this file proves nothing)', () => {
    const snap = snapshot();
    const fired = new Set(snap.violations.map((v) => v.rule_id));
    // Not all of them may fire — but the fixture must put BOTH sides of the
    // attribute question on the table, or a flattening regression stays invisible.
    const exercised = ATTRIBUTE_BORNE_RULES.filter((r) => fired.has(r));
    expect(exercised.length).toBeGreaterThan(0);

    // The satisfied side: FUNC-parse carries realRef, TEST-parse carries testRefs,
    // so R-20/R-19 must NOT fire on them. On a flattened encoding they would.
    const offenders = snap.violations
      .filter((v) => (v.rule_id === 'R-20' && v.element_id === 'FUNC-parse') || (v.rule_id === 'R-19' && v.element_id === 'TEST-parse'))
      .map((v) => `${v.rule_id}/${v.element_id}`);
    expect(offenders).toEqual([]);

    // ... and the unsatisfied side must fire, or the rules are simply off.
    const unbound = snap.violations
      .filter((v) => (v.rule_id === 'R-20' && v.element_id === 'FUNC-render') || (v.rule_id === 'R-19' && v.element_id === 'TEST-render'))
      .map((v) => v.rule_id)
      .sort();
    expect(unbound).toEqual(['R-19', 'R-20']);
  });

  it('nextStep and generationStep report the same blocking errors and the same dimension scores', async () => {
    const snap = snapshot();
    const step = nextStep(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());
    const gen = generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());

    expect(step.blocking.errors).toBe(snap.blockingErrors);
    expect(gen.blockingErrors).toBe(snap.blockingErrors);

    // Same dimensions, same scores — generationStep exposes the applicable ones.
    const fromSnapshot = new Map(
      snap.report.scores.filter((s) => s.applicable > 0).map((s) => [s.dimension as string, s.score]),
    );
    const fromGen = new Map(gen.readiness.map((r) => [r.dimension, r.score]));
    expect([...fromGen.keys()].sort()).toEqual([...fromSnapshot.keys()].sort());
    for (const [dim, score] of fromGen) expect(score).toBe(fromSnapshot.get(dim));

    // The focus dimension nextStep names must be one the snapshot actually scores.
    if (step.nextStep) expect(fromSnapshot.has(step.nextStep.dimension)).toBe(true);
  });

  it('the dryRun steeringDelta measures from the same before-state as the other two', async () => {
    const snap = snapshot();

    // A no-op-shaped preview: adding an edge that is already there changes nothing,
    // so `before` and `after` of the delta must both equal the standing measurement.
    const res = (await tools.graph_mutate.handler({
      commands: [{ op: 'add-edge', edge: { sourceId: 'FUNC-parse', targetId: 'MOD-parsing', edgeType: 'allocate', attributes: {} } }],
      dryRun: true,
      consumerId: 't-0',
    })) as { steeringDelta?: SteeringDelta };

    const delta = res.steeringDelta;
    expect(delta).toBeDefined();
    expect(delta!.blockingErrors.before).toBe(snap.blockingErrors);

    const scored = new Map(
      snap.report.scores.filter((s) => s.applicable > 0).map((s) => [s.dimension as string, s.score]),
    );
    for (const [dim, d] of Object.entries(delta!.dimensions)) {
      if (!scored.has(dim)) continue;
      expect(d.before).toBe(scored.get(dim));
    }
  });

  it('the graph is unchanged by measuring it — all three surfaces are read-only', async () => {
    const before = harness.getGraph();
    const nodes = before.nodes.length;
    const edges = before.edges.length;

    nextStep(harness.getGraph(), harness.getMetricPolicy(), harness.getFocusThreshold());
    generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering fixture', harness.getFocusThreshold());
    await tools.graph_readiness.handler({});

    expect(harness.getGraph().nodes.length).toBe(nodes);
    expect(harness.getGraph().edges.length).toBe(edges);
  });

  it('is deterministic: two consecutive snapshots of an untouched graph are identical', () => {
    const a = snapshot();
    const b = snapshot();
    const key = (s: typeof a) =>
      JSON.stringify({
        violations: s.violations.map((v) => `${v.rule_id}/${v.element_id}/${v.severity}`).sort(),
        blockingErrors: s.blockingErrors,
        scores: s.report.scores.map((x) => `${x.dimension}=${x.score}/${x.applicable}`).sort(),
      });
    expect(key(a)).toBe(key(b));
  });
});
