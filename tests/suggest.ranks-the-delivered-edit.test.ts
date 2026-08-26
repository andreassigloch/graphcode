/**
 * CR-GC-431 — the published ranking number must belong to the edit that ships.
 *
 * `graph_suggest` publishes a `score` per suggestion and, where a fix template
 * exists, an `edit` with the gate's own `verdict.fitDelta`. Before this CR those
 * two numbers measured DIFFERENT changes: `score` was the Δm of se-engine's
 * generic operator probe (`applyRule`), `fitDelta` the Δm of the template edit
 * actually handed out. They disagreed up to the SIGN, and the wrong one sat in
 * the prominent field — so a consumer that believes the tool's own ranking
 * barely moves (CR-GC-430 measured 1 / 0 steps against 5 / 5).
 *
 * TWO ASSERTIONS, both on the CR-GC-430 fixture (real disk Kuzu, real gate):
 *
 *   1. the CONTRACT — for every applicable suggestion, `score` is exactly
 *      `verdict.fitDelta · t̂`, and nothing non-applicable outranks an
 *      applicable suggestion with a positive Δm.
 *   2. the CONSEQUENCE — the CR-GC-430 greedy driver, run once believing the
 *      published `score` and once believing `verdict.fitDelta`, gets to the SAME
 *      place. That is the number the fix exists for; without it the contract
 *      above could hold on paper and the loop still stall.
 *
 * Independent of the repo SSOT on purpose: the fixture is written against the
 * loaded `@sigloch/contracts/se`, so the CR-GC-429 grammar drift cannot make
 * this test red or green for the wrong reason.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/tools/mcp-tools.js';
import { makeSteeringConfig } from './fixtures/steering-graphs.js';
import { DIVERGENCE_FIXTURE } from './fixtures/divergence-graph.js';
import type { GraphSuggestResult } from '../src/tools/suggest.js';

const DIMS = ['modifiability', 'faultTolerance', 'flowEfficiency', 'coherence', 'viability', 'scalability'] as const;
type Weights = Partial<Record<(typeof DIMS)[number], number>>;

/** The two opposed profiles of CR-GC-430 — a documented conflict pair. */
const COHESIVE: Weights = { coherence: 1, modifiability: 0.5 };
const SCALABLE: Weights = { scalability: 1, flowEfficiency: 0.5 };

/** Numeric slack — a score below this is "flat", not "an improvement". */
const EPS = 1e-9;
const MAX_STEPS = 40;

/** Which number the driver believes. The ONLY difference between the two runs. */
type Ranking = 'published' | 'advisory';

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-suggest-rank-'));
  // Disk Kuzu, never :memory: — the chain has to survive the real store.
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
  await harness.initialize();
  await harness.importGraph(DIVERGENCE_FIXTURE);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

async function dropRig(rig: Rig): Promise<void> {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}

const unit = (w: Weights): number[] => {
  const v = DIMS.map((d) => w[d] ?? 0);
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n < 1e-12 ? v : v.map((x) => x / n);
};

const edgeKey = (e: { source: string; type: string; target: string }) => `${e.source} -${e.type}-> ${e.target}`;

/**
 * The CR-GC-430 driver, trimmed to what this regression needs: greedily apply the
 * best edit-carrying suggestion through the REAL gate until nothing helps any
 * more. `ranking` selects the number it believes — nothing else differs.
 */
async function greedyRun(weights: Weights, ranking: Ranking): Promise<{ edits: string[]; stop: string }> {
  const rig = await makeRig();
  try {
    const t = unit(weights);
    const edits: string[] = [];
    const attempted = new Set<string>();
    let stop = `hit MAX_STEPS=${MAX_STEPS}`;

    for (let n = 1; n <= MAX_STEPS; n++) {
      const res = (await rig.tools.graph_suggest.handler({ target: weights, k: 20, layer: 'arch' })) as GraphSuggestResult;
      const scored = res.suggestions
        .filter((s) => s.edit)
        .map((s) => ({
          ruleId: s.ruleId,
          edit: s.edit!,
          key: edgeKey(s.edit!),
          published: s.score,
          // A missing fitDelta would silently rank a candidate at 0; that is
          // "unknown", never "neutral".
          advisory: s.verdict?.fitDelta?.length ? s.verdict.fitDelta.reduce((a, x, i) => a + x * t[i], 0) : Number.NaN,
        }));
      if (scored.length === 0) {
        stop = 'no edit-carrying suggestion left (exhaustion)';
        break;
      }
      const rankOf = (s: (typeof scored)[number]) => (ranking === 'published' ? s.published : s.advisory);
      const candidates = scored
        .filter((s) => !attempted.has(s.key) && rankOf(s) > EPS)
        .sort((a, b) => rankOf(b) - rankOf(a) || a.ruleId.localeCompare(b.ruleId));
      if (candidates.length === 0) {
        stop = 'nothing edit-carrying helps this target any more (greedy optimum)';
        break;
      }

      // A gate refusal is a finding, not a reason to stop measuring: fall
      // through to the next-best candidate.
      let applied = false;
      for (const pick of candidates) {
        attempted.add(pick.key);
        const result = await rig.harness.mutate([
          { op: 'add-edge', edge: { sourceId: pick.edit.source, targetId: pick.edit.target, edgeType: pick.edit.type, attributes: {} } },
        ]);
        if (!result.success) continue;
        edits.push(pick.key);
        applied = true;
        break;
      }
      if (!applied) {
        stop = 'every candidate was refused by the gate';
        break;
      }
    }
    return { edits, stop };
  } finally {
    await dropRig(rig);
  }
}

describe('CR-GC-431: graph_suggest ranks the edit it delivers, not a generic probe', () => {
  it('score of an applicable suggestion IS the Δm of its own edit, and outranks the inapplicable', async () => {
    const rig = await makeRig();
    try {
      const target = SCALABLE;
      const t = unit(target);
      const res = (await rig.tools.graph_suggest.handler({ target, k: 20, layer: 'arch' })) as GraphSuggestResult;

      // Without an applicable suggestion the assertions below are vacuous.
      const applicable = res.suggestions.filter((s) => s.applicable);
      expect(applicable.length, 'fixture yields no applicable suggestion — the test has no subject').toBeGreaterThan(0);

      for (const s of res.suggestions) {
        // AC 3: fund-only is visible as such — no consumer has to infer it from
        // a missing `edit`.
        expect(typeof s.applicable, `${s.ruleId} carries no applicable flag`).toBe('boolean');
        if (!s.applicable) continue;
        expect(s.edit, `${s.ruleId} is applicable but ships no edit`).toBeDefined();
        expect(s.verdict?.success, `${s.ruleId} is applicable but the gate refused it`).toBe(true);
        // AC 1: the published number is the Δm of THIS edit — same path as the
        // gate advisory, not a second measurement.
        expect(s.delta).toEqual(s.verdict!.fitDelta);
        const own = s.verdict!.fitDelta.reduce((a, x, i) => a + x * t[i], 0);
        expect(Math.abs(s.score - own), `${s.ruleId}: published score ${s.score} != own Δm ${own}`).toBeLessThan(1e-12);
      }

      // AC 2: nothing that cannot be applied stands above something that can and helps.
      const lastApplicablePositive = res.suggestions.reduce((acc, s, i) => (s.applicable && s.score > EPS ? i : acc), -1);
      const firstInapplicable = res.suggestions.findIndex((s) => !(s.applicable && s.score > EPS));
      if (lastApplicablePositive >= 0 && firstInapplicable >= 0) {
        expect(
          firstInapplicable,
          `an inapplicable suggestion (${res.suggestions[firstInapplicable].ruleId}) ranks above an applicable one with positive Δm`,
        ).toBeGreaterThan(lastApplicablePositive);
      }
    } finally {
      await dropRig(rig);
    }
  }, 300_000);

  it('a driver believing the published score gets exactly as far as one believing the gate advisory', async () => {
    const pubCoh = await greedyRun(COHESIVE, 'published');
    const advCoh = await greedyRun(COHESIVE, 'advisory');
    const pubSca = await greedyRun(SCALABLE, 'published');
    const advSca = await greedyRun(SCALABLE, 'advisory');

    console.log(
      [
        '',
        'CR-GC-431 — steps reached per believed number (CR-GC-430 driver, arch layer)',
        `  COHESIVE  published ${pubCoh.edits.length} (${pubCoh.stop})  ·  advisory ${advCoh.edits.length} (${advCoh.stop})`,
        `  SCALABLE  published ${pubSca.edits.length} (${pubSca.stop})  ·  advisory ${advSca.edits.length} (${advSca.stop})`,
        '',
      ].join('\n'),
    );

    // A degenerate 0 == 0 would satisfy the equality below without the loop ever
    // moving — pin the reach first (CR-GC-430 measured 5 / 5 on the advisory).
    expect(advCoh.edits.length, 'the advisory chain itself has no reach — fixture or engine regression').toBeGreaterThan(2);
    expect(advSca.edits.length, 'the advisory chain itself has no reach — fixture or engine regression').toBeGreaterThan(2);

    // THE regression: believing the tool's own published number must not cost
    // the driver anything. Before CR-GC-431 this was 1 against 5 and 0 against 5.
    expect(pubCoh.edits.length, 'COHESIVE: the published score leads a driver to fewer steps than the gate advisory').toBe(advCoh.edits.length);
    expect(pubSca.edits.length, 'SCALABLE: the published score leads a driver to fewer steps than the gate advisory').toBe(advSca.edits.length);
    // Same reach could still be a different, accidental path — the two numbers
    // are the same measurement now, so the trajectories have to coincide.
    expect(pubCoh.edits).toEqual(advCoh.edits);
    expect(pubSca.edits).toEqual(advSca.edits);
  }, 600_000);
});
