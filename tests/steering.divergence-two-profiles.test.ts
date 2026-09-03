/**
 * CR-GC-430 — the divergence spike: does the target profile change the RESULT,
 * or only the order in which the same repairs land?
 *
 * CR-GC-340 proved the CONTROLLER for one step (`steering.architecture-causality.test.ts`):
 * flip the target and every shared candidate's score flips sign, a different
 * suggestion leads, and applying it moves the ℝ⁶ component the predicted way.
 * That test stops at the actuator on purpose. This one closes the remaining
 * link: two OPPOSED target profiles, the SAME start graph, n greedy steps each
 * along `graph_suggest`, and then the question a human actually asks — is a
 * different system standing there?
 *
 * PROTOCOL (a perfect, scripted actuator — no LLM, so nothing stochastic is
 * measured; this is the UPPER BOUND of steerability, not a forecast of what a
 * model would do):
 *   1. `graph_suggest({target, layer:'arch'})`
 *   2. take the highest-ranked suggestion that carries a template edit and still
 *      helps the target — a greedy optimizer never applies a move that hurts it
 *   3. apply it through the real gate (`harness.mutate`), disk Kuzu
 *   4. repeat until nothing edit-carrying helps any more
 *
 * TWO RANKINGS, MEASURED SIDE BY SIDE — the finding this spike turns on:
 *
 *   `probe`     rank by `suggestion.score` — whatever `graph_suggest` publishes.
 *               At the time of the spike that was the Δm of se-engine's GENERIC
 *               probe edge (`applyRule`), not of the template edit shipping with
 *               it; since CR-GC-431 it is the delivered edit's own Δm.
 *   `advisory`  rank by `suggestion.verdict.fitDelta · t̂`. That is the gate's own
 *               dryRun advisory for THE EDIT THAT WOULD BE APPLIED, on the same
 *               `'arch'` layer. It ships in the same response.
 *
 * The two disagreed in SIGN for R-22 on this fixture, so which number the driver
 * believed decided whether a run moved at all. Both are recorded; the claim is
 * evaluated on `advisory`, because a perfect actuator uses the best information
 * the tool gives it, and the probe/advisory gap was reported as its own finding.
 *
 * THAT GAP IS CLOSED (CR-GC-431): `graph_suggest` now publishes, for every
 * APPLICABLE suggestion, the Δm of the edit it hands out — the same number as
 * `verdict.fitDelta`. The two rankings below therefore coincide today, and the
 * sign-conflict section at the end prints `none`. The `probe` run is kept as the
 * live proof of that: it is the control that would go back to 1/0 steps the day
 * the published number stops describing the delivered edit. The regression that
 * pins it is `tests/suggest.ranks-the-delivered-edit.test.ts`.
 *
 * MEASUREMENT LAYER: rank, measure and judge all on `'arch'` — `graph_suggest`'s
 * default, the layer the gate's `fitAdvisory` uses (CR-GC-352), and the layer the
 * claim is about: the ARCHITECTURE of the graph.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { metrics, toArray } from '@sigloch/se-engine';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import { makeSteeringConfig } from './fixtures/steering-graphs.js';
import { DIVERGENCE_FIXTURE } from './fixtures/divergence-graph.js';
import type { GraphSuggestResult } from '../src/loop/suggest.js';

const DIMS = ['modifiability', 'faultTolerance', 'flowEfficiency', 'coherence', 'viability', 'scalability'] as const;
type Weights = Partial<Record<(typeof DIMS)[number], number>>;

/** Numeric slack — a score below this is "flat", not "an improvement". */
const EPS = 1e-9;
/** Hard stop so a non-terminating chain fails loudly instead of hanging. */
const MAX_STEPS = 40;
/** Architecture subgraph types — se-engine's `ARCH_TYPES`, the measured layer. */
const ARCH = ['FUNC', 'FLOW', 'MOD', 'SCHEMA', 'ACTOR'];

/**
 * The two profiles. They are a documented CONFLICT PAIR, not free invention:
 * `CONFLICT_PAIRS` in `src/target-profile.ts` states that coherence/modifiability
 * pull against scalability, because tight cohesion wants a gateway node whose
 * betweenness is exactly what `scalability = 5·(1 − maxBetweenness)` penalises.
 *
 * They are deliberately NOT exact antipodes. Antipodal targets make the two runs'
 * positive-score sets disjoint BY CONSTRUCTION (score = Δm·t̂ negates), so "the
 * runs applied different edits" would be arithmetic, not a finding. Two realistic,
 * merely opposed profiles have to earn their divergence.
 */
const COHESIVE: Weights = { coherence: 1, modifiability: 0.5 };
const SCALABLE: Weights = { scalability: 1, flowEfficiency: 0.5 };

/** How the driver ranks — see the file header. `exhaust` ignores the sign. */
type Ranking = 'probe' | 'advisory' | 'exhaust';

interface AppliedStep {
  n: number;
  ruleId: string;
  edit: string;
  /** `graph_suggest`'s PUBLISHED score (pre-CR-GC-431: the generic probe's Δm). */
  probeScore: number;
  /** The gate advisory's Δm for the ACTUAL edit, on the unit target. */
  advisoryScore: number;
  before: number[];
  after: number[];
  tier: string;
}

interface RunResult {
  label: string;
  ranking: Ranking;
  weights: Weights;
  steps: AppliedStep[];
  start: number[];
  end: number[];
  stop: string;
  /** Top edit-carrying suggestions the gate refused, with the reason. */
  gateBlocks: { n: number; ruleId: string; edit: string; violations: string[] }[];
  /** Edit-carrying suggestions still on the table when the chain stopped. */
  leftover: { ruleId: string; probe: number; advisory: number; edit: string }[];
  /** Steps where the probe's sign and the advisory's sign disagree. */
  signConflicts: { n: number; ruleId: string; probe: number; advisory: number }[];
  /** Suggestions whose own dryRun the gate refused — offered but not appliable. */
  refused: { n: number; ruleId: string; edit: string; violations: string[] }[];
  edges: string[];
  allocations: Map<string, string>;
  contracts: Map<string, string>;
}

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(): Promise<Rig> {
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-divergence-'));
  // Disk Kuzu, never :memory: — the whole run has to survive the real store.
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

const fit = (h: GraphCodeHarness) => toArray(metrics(toOntologyGraph(h.getGraph()), { layer: 'arch' }));

const unit = (w: Weights): number[] => {
  const v = DIMS.map((d) => w[d] ?? 0);
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n < 1e-12 ? v : v.map((x) => x / n);
};

/** Projection of a ℝ⁶ move on a profile's unit direction — one honest number per run. */
const along = (delta: number[], w: Weights): number => delta.reduce((s, x, i) => s + x * unit(w)[i], 0);

const edgeKey = (e: { source: string; type: string; target: string }) => `${e.source} -${e.type}-> ${e.target}`;

/** Every edge of the ARCHITECTURE subgraph, sorted — the structural fingerprint. */
function archEdges(h: GraphCodeHarness): string[] {
  const og = toOntologyGraph(h.getGraph());
  const ids = new Set(og.elements.filter((e) => ARCH.includes(e.type)).map((e) => e.id));
  return og.traces
    .filter((t) => ids.has(t.source) && ids.has(t.target))
    .map((t) => `${t.source} -${t.type}-> ${t.target}`)
    .sort();
}

/** FUNC → MOD, the allocation an architecture view (SDD) prints. */
function allocationsOf(h: GraphCodeHarness): Map<string, string> {
  const og = toOntologyGraph(h.getGraph());
  return new Map(og.traces.filter((t) => t.type === 'allocate').map((t) => [t.source, t.target]));
}

/** FLOW → SCHEMA, the data contract an ICD prints. */
function contractsOf(h: GraphCodeHarness): Map<string, string> {
  const og = toOntologyGraph(h.getGraph());
  const type = new Map(og.elements.map((e) => [e.id, e.type]));
  return new Map(
    og.traces
      .filter((t) => t.type === 'relation' && type.get(t.source) === 'FLOW' && type.get(t.target) === 'SCHEMA')
      .map((t) => [t.source, t.target]),
  );
}

/**
 * One greedy run. Returns the whole trajectory, including the reason it stopped
 * and everything the gate refused — the kill criteria are read off THIS object,
 * so nothing that went wrong may be swallowed here.
 */
async function greedyRun(label: string, weights: Weights, ranking: Ranking): Promise<RunResult> {
  const rig = await makeRig();
  try {
    const t = unit(weights);
    const start = fit(rig.harness);
    const steps: AppliedStep[] = [];
    const gateBlocks: RunResult['gateBlocks'] = [];
    const signConflicts: RunResult['signConflicts'] = [];
    const refused: RunResult['refused'] = [];
    const attempted = new Set<string>();
    let stop = `hit MAX_STEPS=${MAX_STEPS}`;
    let leftover: RunResult['leftover'] = [];

    for (let n = 1; n <= MAX_STEPS; n++) {
      const res = (await rig.tools.graph_suggest.handler({ target: weights, k: 20, layer: 'arch' })) as GraphSuggestResult;
      const scored = res.suggestions
        .filter((s) => s.edit)
        .map((s) => ({
          ruleId: s.ruleId,
          edit: s.edit!,
          key: edgeKey(s.edit!),
          probe: s.score,
          // Missing fitDelta would silently rank every candidate at 0; treat it
          // as "unknown", never as "neutral".
          advisory: s.verdict?.fitDelta?.length ? s.verdict.fitDelta.reduce((a, x, i) => a + x * t[i], 0) : Number.NaN,
          verdictOk: s.verdict?.success !== false,
          verdictViolations: (s.verdict?.violations ?? []).map((v) => `${v.ruleId}:${v.severity}`),
        }));
      for (const s of scored) {
        if (!s.verdictOk) refused.push({ n, ruleId: s.ruleId, edit: s.key, violations: s.verdictViolations });
      }
      leftover = scored.map((s) => ({ ruleId: s.ruleId, probe: s.probe, advisory: s.advisory, edit: s.key }));
      for (const s of scored) {
        if (Number.isFinite(s.advisory) && Math.sign(s.probe) !== Math.sign(s.advisory) && Math.abs(s.probe) > EPS && Math.abs(s.advisory) > EPS) {
          signConflicts.push({ n, ruleId: s.ruleId, probe: s.probe, advisory: s.advisory });
        }
      }

      if (scored.length === 0) {
        stop = 'graph_suggest returned no edit-carrying suggestion at all (exhaustion)';
        break;
      }
      const rankOf = (s: (typeof scored)[number]) => (ranking === 'probe' ? s.probe : s.advisory);
      const candidates = scored
        .filter((s) => !attempted.has(s.key) && (ranking === 'exhaust' || rankOf(s) > EPS))
        .sort((a, b) => rankOf(b) - rankOf(a) || a.ruleId.localeCompare(b.ruleId));
      if (candidates.length === 0) {
        stop =
          ranking === 'exhaust'
            ? 'every edit-carrying suggestion has already been applied (exhaustion)'
            : 'no edit-carrying suggestion helps this target any more (greedy optimum)';
        break;
      }

      // Take the best; if the gate refuses it, record that and fall through to
      // the next-best rather than ending the run — a blocked top suggestion is a
      // finding, not a reason to stop measuring.
      let applied = false;
      for (const pick of candidates) {
        const before = fit(rig.harness);
        attempted.add(pick.key);
        const result = await rig.harness.mutate([
          { op: 'add-edge', edge: { sourceId: pick.edit.source, targetId: pick.edit.target, edgeType: pick.edit.type, attributes: {} } },
        ]);
        if (!result.success) {
          gateBlocks.push({ n, ruleId: pick.ruleId, edit: pick.key, violations: result.violations.map((v) => `${v.ruleId}:${v.severity}`) });
          continue;
        }
        steps.push({
          n,
          ruleId: pick.ruleId,
          edit: pick.key,
          probeScore: pick.probe,
          advisoryScore: pick.advisory,
          before,
          after: fit(rig.harness),
          tier: String(result.tier),
        });
        applied = true;
        break;
      }
      if (!applied) {
        stop = 'every candidate suggestion was refused by the gate';
        break;
      }
    }

    // Everything reported below is read BACK from the store, not from the
    // working copy the loop just wrote into. Without this the end graph could be
    // an in-memory artefact and "went through the gate onto disk" would be a
    // claim rather than a measurement.
    await rig.harness.loadGraph();

    return {
      label,
      ranking,
      weights,
      steps,
      start,
      end: fit(rig.harness),
      stop,
      gateBlocks,
      leftover,
      signConflicts,
      refused,
      edges: archEdges(rig.harness),
      allocations: allocationsOf(rig.harness),
      contracts: contractsOf(rig.harness),
    };
  } finally {
    await dropRig(rig);
  }
}

const fmt = (v: number[]) => v.map((x) => x.toFixed(4)).join(' ');
const totalOf = (r: RunResult) => r.end.map((x, i) => x - r.start[i]);

function renderRun(r: RunResult, lines: string[]): void {
  lines.push('', `--- run ${r.label} [ranking=${r.ranking}] — target ${JSON.stringify(r.weights)}`);
  for (const s of r.steps) {
    lines.push(
      `  ${String(s.n).padStart(2)}. ${s.ruleId.padEnd(6)} probe=${s.probeScore.toFixed(4).padStart(8)} advisory=${s.advisoryScore.toFixed(4).padStart(8)}  ${s.edit}`,
    );
    lines.push(`      ℝ⁶ ${fmt(s.before)}  ->  ${fmt(s.after)}   (realised along own target: ${along(s.after.map((x, i) => x - s.before[i]), r.weights).toFixed(4)})`);
  }
  lines.push(`  end (arch): ${fmt(r.end)}`);
  lines.push(`  steps: ${r.steps.length} · stop: ${r.stop}`);
  lines.push(`  gate blocks: ${r.gateBlocks.length ? r.gateBlocks.map((g) => `${g.ruleId}@${g.n} [${g.violations.join(',')}] ${g.edit}`).join(' | ') : 'none'}`);
  lines.push(`  leftover edit-carrying suggestions: ${r.leftover.map((l) => `${l.ruleId}(probe ${l.probe.toFixed(3)}/advisory ${l.advisory.toFixed(3)})`).join(', ') || 'none'}`);
  const uniqRefused = [...new Map(r.refused.map((x) => [x.edit, x])).values()];
  lines.push(`  suggestions the gate's OWN dryRun refused: ${uniqRefused.length ? uniqRefused.map((x) => `${x.ruleId} ${x.edit} [${x.violations.join(',')}]`).join(' | ') : 'none'}`);
  const claimed = r.steps.reduce((s, x) => s + (r.ranking === 'probe' ? x.probeScore : x.advisoryScore), 0);
  lines.push(`  claimed sum of step scores: ${claimed.toFixed(4)} · realised trajectory along own target: ${along(totalOf(r), r.weights).toFixed(4)}`);
}

function namedDifference(a: RunResult, b: RunResult, lines: string[]): void {
  const onlyA = a.edges.filter((e) => !b.edges.includes(e));
  const onlyB = b.edges.filter((e) => !a.edges.includes(e));
  lines.push('', `--- structural difference of the END graphs (${a.label} vs ${b.label}, architecture subgraph)`);
  lines.push(`  symmetric edge difference: ${onlyA.length + onlyB.length}`);
  lines.push(`  only in ${a.label}: ${onlyA.length ? onlyA.join(' | ') : 'none'}`);
  lines.push(`  only in ${b.label}: ${onlyB.length ? onlyB.join(' | ') : 'none'}`);
  lines.push('  allocation (FUNC -> MOD):');
  for (const fn of [...new Set([...a.allocations.keys(), ...b.allocations.keys()])].sort()) {
    const x = a.allocations.get(fn) ?? '(unallocated)';
    const y = b.allocations.get(fn) ?? '(unallocated)';
    lines.push(`    ${fn.padEnd(15)} ${a.label}: ${x.padEnd(14)} ${b.label}: ${y}${x === y ? '' : '   <-- DIFFERENT'}`);
  }
  lines.push('  data contract (FLOW -> SCHEMA):');
  for (const fl of [...new Set([...a.contracts.keys(), ...b.contracts.keys()])].sort()) {
    const x = a.contracts.get(fl) ?? '(none)';
    const y = b.contracts.get(fl) ?? '(none)';
    lines.push(`    ${fl.padEnd(15)} ${a.label}: ${x.padEnd(17)} ${b.label}: ${y}${x === y ? '' : '   <-- DIFFERENT'}`);
  }
  let diverged = -1;
  for (let i = 0; i < Math.max(a.steps.length, b.steps.length); i++) {
    if (a.steps[i]?.edit !== b.steps[i]?.edit) {
      diverged = i + 1;
      break;
    }
  }
  const contested = [...new Set([...a.allocations.keys(), ...b.allocations.keys()])].filter(
    (fn) => a.allocations.has(fn) && b.allocations.has(fn) && a.allocations.get(fn) !== b.allocations.get(fn),
  );
  lines.push(`  CONTESTED (placed by both runs, in different modules): ${contested.map((fn) => `${fn} -> ${a.allocations.get(fn)} / ${b.allocations.get(fn)}`).join(', ') || 'none'}`);
  lines.push(`  divergence step: ${diverged === -1 ? 'never (identical trajectories)' : diverged}`);
  lines.push(
    `  direction fidelity: ${a.label} along own ${along(totalOf(a), a.weights).toFixed(4)} / along ${b.label}'s target ${along(totalOf(a), b.weights).toFixed(4)} · ` +
      `${b.label} along own ${along(totalOf(b), b.weights).toFixed(4)} / along ${a.label}'s target ${along(totalOf(b), a.weights).toFixed(4)}`,
  );
}

describe('CR-GC-430: two opposed target profiles over n greedy steps', () => {
  it('diverge structurally and each move toward their own target', async () => {
    // The claim run: the perfect actuator believes the gate's advisory for the
    // edit it is about to apply.
    const cohAdv = await greedyRun('COHESIVE', COHESIVE, 'advisory');
    const scaAdv = await greedyRun('SCALABLE', SCALABLE, 'advisory');
    // The control run: the same driver believing the number `graph_suggest`
    // PUBLISHES as `score` (se-engine's generic probe).
    const cohProbe = await greedyRun('COHESIVE', COHESIVE, 'probe');
    const scaProbe = await greedyRun('SCALABLE', SCALABLE, 'probe');
    // The reach measurement: keep applying regardless of sign until the
    // suggestion surface is empty — the architecture loop's maximum length.
    const exhaust = await greedyRun('EXHAUST', COHESIVE, 'exhaust');
    // The placebo: the SAME target, a second time, in its own store. Without it,
    // "the two runs ended differently" could just mean the loop is not
    // reproducible — and then nothing above would be about the target at all.
    const placebo = await greedyRun('PLACEBO', COHESIVE, 'advisory');

    const lines: string[] = ['', '='.repeat(96), 'CR-GC-430 — divergence of two target profiles (arch layer)', '='.repeat(96)];
    lines.push(`ℝ⁶ order: ${DIMS.join(' ')}`);
    lines.push(`start (arch): ${fmt(cohAdv.start)}`);
    for (const r of [cohAdv, scaAdv, cohProbe, scaProbe, exhaust, placebo]) renderRun(r, lines);
    namedDifference(cohAdv, scaAdv, lines);
    namedDifference(cohProbe, scaProbe, lines);
    lines.push('', '--- probe vs advisory: suggestions whose PUBLISHED score has the opposite sign to the gate advisory for the same edit');
    for (const r of [cohAdv, scaAdv]) {
      const uniq = [...new Map(r.signConflicts.map((c) => [`${c.ruleId}`, c])).values()];
      lines.push(`  ${r.label}: ${uniq.length ? uniq.map((c) => `${c.ruleId} probe ${c.probe.toFixed(4)} vs advisory ${c.advisory.toFixed(4)}`).join(' | ') : 'none'}`);
    }
    lines.push('='.repeat(96), '');
    console.log(lines.join('\n'));

    // Same start for every run — otherwise nothing above compares two worlds.
    expect(fmt(cohAdv.start)).toBe(fmt(scaAdv.start));

    // PLACEBO: same target twice ⇒ same trajectory and the same end graph. The
    // divergence below is therefore the target's doing, not run-to-run noise.
    expect(placebo.steps.map((s) => s.edit), 'the loop is not reproducible').toEqual(cohAdv.steps.map((s) => s.edit));
    expect(placebo.edges).toEqual(cohAdv.edges);

    // KILL CRITERION "gate-blocked": the rule set must not fight the profile.
    for (const r of [cohAdv, scaAdv, cohProbe, scaProbe, exhaust, placebo]) {
      expect(r.gateBlocks, `gate refused suggestions in ${r.label}/${r.ranking}`).toEqual([]);
    }

    // KILL CRITERION "too short": a chain of 1–2 steps has no reach, however
    // cleanly the controller computes. Asserted on the advisory runs (the claim)
    // and on the maximum reach of the surface itself.
    expect(cohAdv.steps.length, 'COHESIVE chain too short to be steering').toBeGreaterThan(2);
    expect(scaAdv.steps.length, 'SCALABLE chain too short to be steering').toBeGreaterThan(2);
    expect(exhaust.steps.length, 'the suggestion surface itself is exhausted after 2 steps').toBeGreaterThan(2);

    // KILL CRITERION "no divergence": the end graphs must differ structurally,
    // and the difference must be an ALLOCATION or a CONTRACT — something an
    // architecture view prints — not merely a different edge count.
    const symDiff = [
      ...cohAdv.edges.filter((e) => !scaAdv.edges.includes(e)),
      ...scaAdv.edges.filter((e) => !cohAdv.edges.includes(e)),
    ];
    expect(symDiff.length, 'the two end graphs are identical').toBeGreaterThan(0);
    const differingAllocations = [...new Set([...cohAdv.allocations.keys(), ...scaAdv.allocations.keys()])].filter(
      (fn) => cohAdv.allocations.get(fn) !== scaAdv.allocations.get(fn),
    );
    const differingContracts = [...new Set([...cohAdv.contracts.keys(), ...scaAdv.contracts.keys()])].filter(
      (fl) => cohAdv.contracts.get(fl) !== scaAdv.contracts.get(fl),
    );
    expect(differingAllocations.length + differingContracts.length, 'no named allocation or contract differs').toBeGreaterThan(0);

    // The sharpest form of the same criterion: a function that BOTH runs placed,
    // in DIFFERENT modules. "Allocated here, still homeless there" could be read
    // as one run simply doing less; "this function lives in another module" cannot.
    const contested = differingAllocations.filter((fn) => cohAdv.allocations.has(fn) && scaAdv.allocations.has(fn));
    expect(
      contested.map((fn) => `${fn}: ${cohAdv.allocations.get(fn)} vs ${scaAdv.allocations.get(fn)}`),
      'no function is allocated to a DIFFERENT module — the profiles only chose a different subset of the same repairs',
    ).not.toEqual([]);

    // KILL CRITERION "directionless" (the CR-GC-407 trap): the TRAJECTORY, not
    // the per-step promise, has to move each run toward its own target — and
    // each run has to serve its own target better than the other run does.
    const totalCoh = totalOf(cohAdv);
    const totalSca = totalOf(scaAdv);
    expect(along(totalCoh, COHESIVE), 'COHESIVE trajectory does not serve its own target').toBeGreaterThan(0);
    expect(along(totalSca, SCALABLE), 'SCALABLE trajectory does not serve its own target').toBeGreaterThan(0);
    expect(along(totalCoh, COHESIVE)).toBeGreaterThan(along(totalSca, COHESIVE));
    expect(along(totalSca, SCALABLE)).toBeGreaterThan(along(totalCoh, SCALABLE));
  }, 600_000);
});
