/**
 * T-B1 / T-B3 / T-B5 (CR-GC-341) — the process branch of the steering proof.
 *
 * Claim b) says graphcode steers a project through the SE process. `readiness.model.test.ts`
 * already proves the gate ORDER is a partition of the rule set, and
 * `generate.test.ts:228` proves a gate cannot be skipped on a reached threshold.
 * What was missing is the CONTROL LOOP: that applying the steering repeatedly walks
 * a graph forward without falling back and without circling.
 *
 *   T-B1  graph maturity      → current gate / phase / focus types   (the ladder)
 *   T-B3  rounds in the loop  → monotone progress, no circling       (the ratchet)
 *   T-B5  defer              → focus moves, state does not           (control)
 *
 * No LLM: the actuator is the scripted, deliberately dumb `scriptedActor` from the
 * shared fixture. A stochastic actuator would make a red run unattributable — did
 * the controller mis-compute or did the model write badly? (CR-GC-340 §2.1.)
 *
 * SCOPE, STATED PLAINLY: the ratchet here is asserted on MONOTONICITY and
 * NON-CIRCLING over a bounded run, not on reaching `phase: 'handoff'`. Handoff
 * additionally requires all four phase gates to be rule-COMPLETE, i.e. an actuator
 * with a canonical repair for essentially every rule in the catalogue. That is a
 * property of the actuator, not of the controller under test, and faking it would
 * make this file measure its own fixture. Where the scripted actuator runs out, the
 * test says so by name instead of going quietly green.
 *
 * Real disk Kuzu (temp dir), no mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { RULE_TO_PHASE } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { generationStep, DIMENSION_FOCUS_TYPES } from '../src/generate.js';
import { computePhaseReadiness, currentPhaseGate, PHASE_GATE_ORDER } from '../src/readiness.js';
import { ARCH_FIXTURE, makeSteeringConfig, parseFocusKey, scriptedActor } from './fixtures/steering-graphs.js';
import type { MutateCommand } from '@sigloch/contracts/harness';

/** Round cap. Generous but finite: a controller that circles must fail, not hang. */
const MAX_ROUNDS = 30;

interface Round {
  round: number;
  phase: string;
  focusKey: string | null;
  ruleId: string | null;
  blockingErrors: number;
  /** Total covered legs across all four gates — the ratchet's scalar. */
  coveredLegs: number;
  applied: boolean;
  /** true when the batch was accepted but changed nothing — stagnation. */
  noop: boolean;
}

describe('T-B1 (CR-GC-341): the gate ladder is read off the measurement, not off prose', () => {
  it('walks SRR → PDR → CDR → TRR as coverage is added, one gate at a time', () => {
    // Table-driven over the RULE_TO_PHASE stream itself: this is what
    // `currentPhaseGate` consumes, so feeding it directly tests the ladder rather
    // than a fixture's ability to hit four exact maturity levels.
    const rulesOf = (gate: string) => Object.keys(RULE_TO_PHASE).filter((id) => RULE_TO_PHASE[id] === gate);

    // Everything open → the current gate is the FIRST in lifecycle order.
    const allOpen = Object.keys(RULE_TO_PHASE).map((ruleId) => ({ ruleId }));
    expect(currentPhaseGate(computePhaseReadiness(allOpen))).toBe(PHASE_GATE_ORDER[0]);

    // Clear the gates in order; after each, the current gate must be the next one.
    let open = [...allOpen];
    for (let i = 0; i < PHASE_GATE_ORDER.length; i++) {
      const gate = PHASE_GATE_ORDER[i];
      const cleared = new Set(rulesOf(gate));
      open = open.filter((v) => !cleared.has(v.ruleId));
      const expected = i + 1 < PHASE_GATE_ORDER.length ? PHASE_GATE_ORDER[i + 1] : null;
      expect(currentPhaseGate(computePhaseReadiness(open))).toBe(expected);
    }

    // And the order is the lifecycle order, not alphabetical.
    expect([...PHASE_GATE_ORDER]).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
  });

  it('clearing a LATER gate first does not advance the current gate', () => {
    // The anti-shortcut: doing the CDR work early must not let SRR count as done.
    // Without this, "the ladder is ordered" would hold vacuously for any subset.
    const rulesOf = (gate: string) => Object.keys(RULE_TO_PHASE).filter((id) => RULE_TO_PHASE[id] === gate);
    const cleared = new Set(rulesOf('CDR'));
    const open = Object.keys(RULE_TO_PHASE)
      .filter((id) => !cleared.has(id))
      .map((ruleId) => ({ ruleId }));
    expect(currentPhaseGate(computePhaseReadiness(open))).toBe('SRR');
  });
});

describe('T-B3 / T-B5 (CR-GC-341): the ratchet, and the control that makes it readable', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-ratchet-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(ARCH_FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const step = (defer: string[] = []) =>
    generationStep(harness.getGraph(), harness.getMetricPolicy(), 'steering reference system', harness.getFocusThreshold(), defer);

  /** Run the loop, deferring any focus whose repair changed nothing (what the real driver does). */
  async function runLoop(): Promise<Round[]> {
    const trace: Round[] = [];
    const deferred: string[] = [];
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const s = step(deferred);
      const legs = s.phaseReadiness.reduce((n, g) => n + g.covered, 0);
      const focus = s.focusKey ? parseFocusKey(s.focusKey) : null;

      if (s.phase === 'handoff' || !s.focusKey || !focus) {
        trace.push({ round, phase: s.phase, focusKey: s.focusKey, ruleId: null, blockingErrors: s.blockingErrors, coveredLegs: legs, applied: false, noop: false });
        break;
      }

      const batch = scriptedActor(focus, round);
      if (!batch) {
        // The scripted actuator has no canonical repair for this rule. Recorded as
        // a stop, never as progress — see the scope note at the top of the file.
        trace.push({ round, phase: s.phase, focusKey: s.focusKey, ruleId: focus.ruleId, blockingErrors: s.blockingErrors, coveredLegs: legs, applied: false, noop: false });
        break;
      }

      const before = harness.getGraph();
      const sizeBefore = before.nodes.length + before.edges.length;
      const res = await harness.mutate(batch as MutateCommand[]);
      const after = harness.getGraph();
      const noop = res.success && after.nodes.length + after.edges.length === sizeBefore;

      trace.push({ round, phase: s.phase, focusKey: s.focusKey, ruleId: focus.ruleId, blockingErrors: s.blockingErrors, coveredLegs: legs, applied: res.success, noop });

      if (!res.success) break;
      // Stagnation handling is the DRIVER's job, and `defer` is the published knob
      // for it (CR-GC-281): a finding the actuator could not actually move gets
      // stood down so the next-weakest one comes up.
      if (noop) deferred.push(s.focusKey);
    }
    return trace;
  }

  it('T-B3 — repeated steering never falls back: gate coverage is monotone and blocking errors never rise', async () => {
    const trace = await runLoop();

    expect(trace.length).toBeGreaterThan(3);
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i].coveredLegs, `gate coverage fell at round ${trace[i].round}`).toBeGreaterThanOrEqual(trace[i - 1].coveredLegs);
      expect(trace[i].blockingErrors, `blocking errors rose at round ${trace[i].round}`).toBeLessThanOrEqual(trace[i - 1].blockingErrors);
    }

    // Net progress, not merely "did not get worse".
    expect(trace[trace.length - 1].coveredLegs).toBeGreaterThan(trace[0].coveredLegs);
    expect(trace[trace.length - 1].blockingErrors).toBeLessThan(trace[0].blockingErrors);
  });

  it('T-B3 — the driver does not circle: a focus set is revisited at most once, and never after it is deferred', async () => {
    const trace = await runLoop();

    // A single revisit is legitimate and expected: the actuator may make a REAL
    // edit that still does not clear the finding (measured: a new ACTOR io edge
    // that leaves FC-01 open). Only the SECOND attempt is recognisable as
    // stagnation, and that is when defer fires. Circling would be unbounded
    // revisits — that is what must not happen.
    const visits = new Map<string, number>();
    for (const r of trace) {
      if (!r.focusKey) continue;
      visits.set(r.focusKey, (visits.get(r.focusKey) ?? 0) + 1);
    }
    const circling = [...visits.entries()].filter(([, n]) => n > 2).map(([k, n]) => `${k} x${n}`);
    expect(circling).toEqual([]);

    // And once a focus is stood down it stays down — otherwise defer would only
    // postpone the loop instead of breaking it out.
    for (const r of trace) {
      if (!r.noop || !r.focusKey) continue;
      const later = trace.filter((p) => p.round > r.round && p.focusKey === r.focusKey);
      expect(later, `deferred focus came back: ${r.focusKey}`).toEqual([]);
    }
  });

  it('T-B3 — every batch the loop produced was legal at the gate, or the loop stopped there', async () => {
    const trace = await runLoop();
    const acted = trace.filter((r) => r.ruleId !== null);
    // A rejected batch ends the run — so at most the LAST acted round may be a
    // rejection, never one in the middle (that would mean the loop ignored a block).
    const rejected = acted.filter((r) => !r.applied);
    for (const r of rejected) expect(r.round).toBe(acted[acted.length - 1].round);
  });

  it('T-B3 — the run reports where it ended, so a partial ratchet is never read as a full one', async () => {
    const trace = await runLoop();
    const last = trace[trace.length - 1];
    // Exactly one of: handoff reached, the round cap hit, or the scripted actuator
    // ran out on a named rule. Any of those is a legitimate outcome; silence is not.
    const reachedHandoff = last.phase === 'handoff';
    const hitCap = trace.length === MAX_ROUNDS;
    const actuatorOut = !reachedHandoff && !hitCap && last.ruleId !== null && !last.applied;
    expect(reachedHandoff || hitCap || actuatorOut).toBe(true);
    if (actuatorOut) {
      // Named, so the next person knows which repair to add rather than guessing.
      expect(typeof last.ruleId).toBe('string');
    }
  });

  it('T-B5 — defer moves the focus and NOTHING else: same violations, same readiness, same gates', async () => {
    const before = step();
    expect(before.focusKey).toBeTruthy();

    const after = step([before.focusKey!]);

    // The focus moved — that is what defer is for.
    expect(after.focusKey).not.toBe(before.focusKey);
    expect(after.prompt).not.toBe(before.prompt);

    // The STATE did not. A knob that reorders work must not alter the measurement,
    // or T-B3's monotonicity could be produced by deferring rather than by fixing.
    expect(after.blockingErrors).toBe(before.blockingErrors);
    expect(after.readiness).toEqual(before.readiness);
    expect(after.phaseReadiness).toEqual(before.phaseReadiness);
    expect(currentPhaseGate(after.phaseReadiness)).toBe(currentPhaseGate(before.phaseReadiness));

    // And the graph itself is untouched — generationStep is a pure measurement.
    expect(harness.getGraph().nodes.length).toBe(ARCH_FIXTURE.elements.length);
  });

  it('T-B5 — the focus types are the ones the focus dimension declares, not free text', async () => {
    const s = step();
    const dimension = parseFocusKey(s.focusKey!).dimension;
    expect(s.focusTypes).toEqual(DIMENSION_FOCUS_TYPES[dimension]);
  });

  it('T-B5 — deferring EVERYTHING does not dead-end the driver', async () => {
    // Documented behaviour (CR-GC-281): with all candidates stood down, defer is
    // ignored rather than leaving the loop with nothing to do.
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) {
      const s = step(keys);
      if (!s.focusKey || keys.includes(s.focusKey)) break;
      keys.push(s.focusKey);
    }
    const exhausted = step(keys);
    expect(exhausted.focusKey).toBeTruthy();
    expect(exhausted.phase).toBe('expand');
  });
});
