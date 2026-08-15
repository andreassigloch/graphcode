/**
 * T-C1..T-C4 (CR-GC-340) — the architecture branch of the steering proof.
 *
 * Claim c) says graphcode steers the ARCHITECTURAL SHAPE of the model. That is a
 * control-loop claim, so it is tested the way a control loop is tested: A/B over
 * ONE actuating variable, asserted on the DIFFERENCE and its SIGN, never on an
 * absolute score (an absolute assertion breaks on every fixture change and proves
 * nothing about steering).
 *
 *   T-C1  target sign          → suggestion ranking          (sign reversal)
 *   T-C2  target sign          → ℝ⁶ after a REAL mutation    (the core proof)
 *   T-C3  MetricPolicy/config  → module verdict / focus      (threshold is a knob)
 *   T-C4  directionless target → identical ranking           (placebo control)
 *
 * No LLM anywhere: `graph_suggest` ships the template edit with the finding, so
 * the actuator can be scripted and the whole chain stays deterministic.
 *
 * MEASUREMENT LAYER: `graph_suggest` ranks Δm on the layer it is asked for, so the
 * before/after ℝ⁶ here is measured on THE SAME layer. Mixing them (rank on `all`,
 * read the gate's arch-layer fitAdvisory) reads as "nothing moved" even when the
 * edit landed — the arch subgraph simply does not contain CR/UC nodes.
 *
 * Real disk Kuzu (temp dir), no mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { metrics, toArray } from '@sigloch/se-optimizer';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { toOntologyGraph } from '../src/conformance.js';
import { takeSteeringSnapshot } from '../src/steering-snapshot.js';
import { CONFIG_FILENAME, DEFAULT_FOCUS_THRESHOLD, loadGraphcodeConfig } from '../src/config.js';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';
import type { GraphSuggestResult } from '../src/tools/suggest.js';

/** Canonical ℝ⁶ order — the one `toArray` and `Suggestion.delta` both use. */
const DIMS = ['modifiability', 'faultTolerance', 'flowEfficiency', 'coherence', 'viability', 'scalability'] as const;

/**
 * The steered dimension for T-C2. `viability` is chosen deliberately:
 *  - it carries a large, unambiguous signal on this fixture, and
 *  - it is invariant under element ORDER, unlike `modifiability`, whose community
 *    detection returns a different partition for a permuted element list. A test
 *    asserting on `modifiability` would be measuring row order, not steering.
 */
const STEERED = 'viability';
const STEERED_INDEX = DIMS.indexOf(STEERED);

/** Numeric slack for float comparison — named, not magic. */
const EPS = 1e-9;

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

/** A fresh disk store with the shared fixture — one per A/B arm, never shared. */
async function makeRig(config?: Record<string, unknown>): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-arch-causality-'));
  if (config) writeFileSync(join(tmp, CONFIG_FILENAME), JSON.stringify(config, null, 2));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  // The config is an explicit constructor opt (production wiring does this in
  // `createHarness`). Writing the file without passing it loads the DEFAULT policy —
  // which would make the T-C3 arms two identical runs wearing different labels.
  const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage, undefined, {
    graphcodeConfig: loadGraphcodeConfig(tmp),
  });
  await harness.initialize();
  await harness.importGraph(ARCH_FIXTURE);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

/**
 * A COMPLETE config with one value overridden. `GraphcodeConfigSchema` requires both
 * `metricPolicy` and `focusThreshold` — a partial file is schema-invalid, and an
 * invalid file is not an A/B arm, it is the default config wearing a costume.
 */
function configWith(policy: Partial<Record<string, unknown>> = {}, focusThreshold = DEFAULT_FOCUS_THRESHOLD): Record<string, unknown> {
  return {
    metricPolicy: { ...DEFAULT_METRIC_POLICY, ...policy },
    focusThreshold,
  };
}

async function dropRig(rig: Rig): Promise<void> {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}

/** ℝ⁶ of the live graph, on the SAME layer the suggestions were ranked on. */
const fitOf = (harness: GraphCodeHarness, layer: 'all' | 'arch') =>
  toArray(metrics(toOntologyGraph(harness.getGraph()), { layer }));

const rank = (res: GraphSuggestResult) => res.suggestions.map((s) => `${s.ruleId}/${s.elementId}`);
const keyOf = (s: { ruleId: string; elementId: string }) => `${s.ruleId}/${s.elementId}`;

describe('T-C1 (CR-GC-340): the target direction reaches the ranking', () => {
  let rig: Rig;
  beforeEach(async () => { rig = await makeRig(); });
  afterEach(async () => { await dropRig(rig); });

  it('reverses the score sign of every shared candidate when the target flips', async () => {
    const plus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
    const minus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: -1 }, k: 20, layer: 'all' })) as GraphSuggestResult;

    // The resolved ℝ⁶ target mirrors the input, in canonical order.
    expect(plus.target[STEERED_INDEX]).toBe(1);
    expect(minus.target[STEERED_INDEX]).toBe(-1);

    const byKeyMinus = new Map(minus.suggestions.map((s) => [keyOf(s), s]));
    let compared = 0;
    for (const p of plus.suggestions) {
      const m = byKeyMinus.get(keyOf(p));
      if (!m) continue;
      expect(m.score).toBeCloseTo(-p.score, 9);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('puts a different suggestion on top when the target flips', async () => {
    const plus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
    const minus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: -1 }, k: 20, layer: 'all' })) as GraphSuggestResult;

    expect(plus.suggestions[0].score).toBeGreaterThan(0);
    expect(rank(plus)[0]).not.toBe(rank(minus)[0]);
    // ... and the winner under +d is strictly worse than the winner under -d,
    // measured in -d's own currency. Otherwise "the ranking flipped" is cosmetic.
    const plusWinnerUnderMinus = minus.suggestions.find((s) => keyOf(s) === rank(plus)[0]);
    expect(plusWinnerUnderMinus!.score).toBeLessThan(minus.suggestions[0].score);
  });

  it('is deterministic — the same target twice yields the identical ranking', async () => {
    const a = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
    const b = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
    expect(rank(a)).toEqual(rank(b));
  });
});

describe('T-C2 (CR-GC-340): an applied suggestion moves ℝ⁶ in the target direction', () => {
  it('the top edit-carrying suggestion for +d really raises component d', async () => {
    const rig = await makeRig();
    try {
      const res = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
      const pick = res.suggestions.find((s) => s.edit);
      expect(pick, 'no suggestion carried an applicable template edit').toBeDefined();

      // It is the best-scoring suggestion that can actually be APPLIED, and it scores
      // positively toward the target. Deliberately not "the top suggestion overall":
      // only four rules ship a fix template today (CR-R01, CR-R04, MS-03, UC-02), so
      // the highest-scoring FINDING is often one a driver cannot act on. That is a
      // real limitation of the current template catalogue, and stating it here beats
      // an assertion that would quietly break the day a template is added.
      const appliable = res.suggestions.filter((s) => s.edit);
      expect(pick!.score).toBe(Math.max(...appliable.map((s) => s.score)));
      expect(pick!.score).toBeGreaterThan(0);

      const before = fitOf(rig.harness, 'all');
      const applied = await rig.harness.mutate([
        { op: 'add-edge', edge: { sourceId: pick!.edit!.source, targetId: pick!.edit!.target, edgeType: pick!.edit!.type, attributes: {} } },
      ]);
      expect(applied.success).toBe(true);
      const after = fitOf(rig.harness, 'all');

      // (1) The steered component moved WITH the target's sign — the claim itself.
      const realised = after[STEERED_INDEX] - before[STEERED_INDEX];
      expect(realised).toBeGreaterThan(0);

      // (2) The move is the one the ranker predicted, not a lucky coincidence:
      //     realised Δ == predicted Δm on the steered component.
      expect(realised).toBeCloseTo(pick!.delta[STEERED_INDEX], 6);

      // (3) The collateral is DECLARED, not hidden. A greedy ranker may trade other
      //     components away; what must hold is that it said so up front — every
      //     component that really regressed was predicted to regress.
      for (let i = 0; i < DIMS.length; i++) {
        if (i === STEERED_INDEX) continue;
        const realDelta = after[i] - before[i];
        if (realDelta < -EPS) {
          expect(pick!.delta[i], `component ${DIMS[i]} regressed unannounced`).toBeLessThan(EPS);
        }
      }
    } finally {
      await dropRig(rig);
    }
  });

  it('with the inverted target the same edit is no longer chosen, and its score is negated', async () => {
    const rig = await makeRig();
    try {
      const plus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
      const minus = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: -1 }, k: 20, layer: 'all' })) as GraphSuggestResult;

      const chosenUnderPlus = plus.suggestions.find((s) => s.edit)!;
      const sameUnderMinus = minus.suggestions.find((s) => keyOf(s) === keyOf(chosenUnderPlus))!;

      // Same candidate, opposite currency: the edit that helped now hurts.
      expect(sameUnderMinus.score).toBeCloseTo(-chosenUnderPlus.score, 9);
      expect(sameUnderMinus.score).toBeLessThan(0);

      // And the driver would not pick it: something else now leads.
      expect(rank(minus)[0]).not.toBe(keyOf(chosenUnderPlus));

      // Applying it anyway moves the steered component the WRONG way relative to
      // the -d target — which is exactly why the ranking demoted it.
      const before = fitOf(rig.harness, 'all');
      await rig.harness.mutate([
        { op: 'add-edge', edge: { sourceId: chosenUnderPlus.edit!.source, targetId: chosenUnderPlus.edit!.target, edgeType: chosenUnderPlus.edit!.type, attributes: {} } },
      ]);
      const after = fitOf(rig.harness, 'all');
      const realised = after[STEERED_INDEX] - before[STEERED_INDEX];
      expect(realised * minus.target[STEERED_INDEX]).toBeLessThan(0);
    } finally {
      await dropRig(rig);
    }
  });
});

describe('T-C3 (CR-GC-340): the judging threshold is a knob in the config, not a literal in the rule', () => {
  it('the same graph flips a moduleMetrics verdict when MetricPolicy moves', async () => {
    // Same graph, same rules — only the instability threshold differs.
    // `null` is the documented "measure, do not judge" setting: MT-01 never fires.
    const lenient = await makeRig(configWith({ instability: null }));
    const strict = await makeRig(configWith({ instability: 0.1 }));
    try {
      const mt01 = (rig: Rig) =>
        takeSteeringSnapshot(rig.harness.getGraph(), rig.harness.getMetricPolicy(), rig.harness.getFocusThreshold())
          .violations.filter((v) => v.rule_id === 'MT-01');

      expect(mt01(lenient)).toEqual([]);
      expect(mt01(strict).length).toBeGreaterThan(0);

      // The measurement itself is unchanged — only the judgement moved. If the
      // module rows differed too, this would be two graphs, not one knob.
      const modulesOf = (rig: Rig) =>
        (rig.tools.graph_metrics.handler({}) as Promise<{ modules: { moduleId: string; instability: number | null }[] }>);
      const a = await modulesOf(lenient);
      const b = await modulesOf(strict);
      expect(a.modules.map((m) => `${m.moduleId}:${m.instability}`)).toEqual(b.modules.map((m) => `${m.moduleId}:${m.instability}`));
    } finally {
      await dropRig(lenient);
      await dropRig(strict);
    }
  });

  it('moving focusThreshold moves the focus verdict without touching the violations', async () => {
    const low = await makeRig(configWith({}, 0.05));
    const high = await makeRig(configWith({}, 0.99));
    try {
      const snap = (rig: Rig) =>
        takeSteeringSnapshot(rig.harness.getGraph(), rig.harness.getMetricPolicy(), rig.harness.getFocusThreshold());
      const a = snap(low);
      const b = snap(high);

      // Same findings — the threshold judges, it does not detect.
      const ids = (s: typeof a) => s.violations.map((v) => `${v.rule_id}/${v.element_id}`).sort();
      expect(ids(a)).toEqual(ids(b));
      expect(a.blockingErrors).toBe(b.blockingErrors);

      // But the ready-verdict differs: at 0.05 dimensions count as ready that are
      // not ready at 0.99. The knob is what decides "is this dimension too weak".
      const readyCount = (s: typeof a) => s.report.scores.filter((x) => x.applicable > 0 && x.ready).length;
      expect(readyCount(a)).toBeGreaterThan(readyCount(b));
    } finally {
      await dropRig(low);
      await dropRig(high);
    }
  });
});

describe('T-C4 (CR-GC-340): placebo — a target with nothing to pull on changes nothing', () => {
  let rig: Rig;
  beforeEach(async () => { rig = await makeRig(); });
  afterEach(async () => { await dropRig(rig); });

  it('a directionless target scores every suggestion at zero and still ranks deterministically', async () => {
    const a = (await rig.tools.graph_suggest.handler({ target: {}, k: 20, layer: 'all' })) as GraphSuggestResult;
    const b = (await rig.tools.graph_suggest.handler({ target: {}, k: 20, layer: 'all' })) as GraphSuggestResult;
    expect(a.target).toEqual([0, 0, 0, 0, 0, 0]);
    expect(a.suggestions.every((s) => Math.abs(s.score) < EPS)).toBe(true);
    expect(rank(a)).toEqual(rank(b));
  });

  it('scaling the target changes the scores but NOT the order — direction steers, magnitude does not', async () => {
    // The negative control for T-C1. Without it, "the ranking moved when I changed
    // the target" could just mean the ranking is unstable under any perturbation.
    // Here the target is perturbed in a way that must NOT reorder anything.
    const unit = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;
    const scaled = (await rig.tools.graph_suggest.handler({ target: { [STEERED]: 0.4 }, k: 20, layer: 'all' })) as GraphSuggestResult;

    expect(rank(scaled)).toEqual(rank(unit));

    // Stronger than "same order": the SCORES are identical too. The result echoes
    // the raw target back (0.4 stays 0.4), but the score is Δm against the
    // NORMALIZED direction, so magnitude is not a gain — it has no effect at all.
    // Only the direction steers.
    expect(scaled.target[STEERED_INDEX]).toBe(0.4);
    const byKey = new Map(unit.suggestions.map((s) => [keyOf(s), s.score]));
    for (const s of scaled.suggestions) {
      expect(s.score).toBeCloseTo(byKey.get(keyOf(s))!, 9);
    }
  });

  it('no dimension on this fixture is leverage-free — so the placebo cannot be a dead dimension', async () => {
    // Documents why the control above is a rescaling and not "steer toward a
    // dimension nothing can move": on this graph every ℝ⁶ component has at least
    // one suggestion with non-zero Δm. Asserting the opposite would be a test that
    // passes because the fixture is too poor to say anything.
    const none = (await rig.tools.graph_suggest.handler({ target: {}, k: 20, layer: 'all' })) as GraphSuggestResult;
    const leverage = DIMS.map((_, i) => Math.max(...none.suggestions.map((s) => Math.abs(s.delta[i]))));
    expect(leverage.every((l) => l > EPS)).toBe(true);
  });
});
