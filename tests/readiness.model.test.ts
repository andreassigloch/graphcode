/**
 * TEST-readiness-model — CR-GC-125 acceptance test.
 *
 * Proves the graphcode readiness model (REQ-readiness-model) is:
 *   (A) DEFINED from @sigloch/contracts V3_RULES + the MS nodes + element
 *       status — never the aimprove BQ heuristic;
 *   (B) the phase gates SRR/PDR/CDR/TRR are a DISJOINT + EXHAUSTIVE partition of
 *       the element-level V3_RULES, and together with the MS rules (impl gates)
 *       span ALL of V3_RULES — nothing invented, nothing dropped;
 *   (C) the scorer derives the gates correctly (deterministic unit cases on the
 *       pure computeReadiness), and stays family-measured on the full SSOT.
 *
 * Unit cases use crafted inputs (no gate needed — the gate blocks new R-01
 * errors, so error states are injected directly). One integration case seeds
 * the real SSOT on disk Kuzu (no mocks, no :memory:).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { RULE_TO_PHASE } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/harness.js';
import {
  computeReadiness,
  scoreReadiness,
  getFamilyRuleIds,
  GRAPHCODE_INCOSE_SCOPE,
  PHASE_GATE_RULES,
  IMPL_GATE_MILESTONES,
  IMPL_GATE_RULES,
  ABSENT_CREATION_PROVIDER,
  summarizeReadiness,
  computePhaseReadiness,
  currentPhaseGate,
  PHASE_GATE_ORDER,
  type CreationCurrencyProvider,
} from '../src/readiness.js';

const REPO_ROOT = join(__dirname, '..');

// --- (A) + (B): the model spans V3_RULES, derived not invented ---------------

describe('TEST-readiness-model (A/B): model is defined over V3_RULES, lean scope', () => {
  it('INCOSE scope is lean (graph is the single SE artifact)', () => {
    expect(GRAPHCODE_INCOSE_SCOPE).toBe('lean');
  });

  it('phase gates are exactly SRR/PDR/CDR/TRR, impl gates exactly SAR/FCA/SVR/FRR', () => {
    expect(Object.keys(PHASE_GATE_RULES)).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
    expect(Object.keys(IMPL_GATE_MILESTONES)).toEqual(['SAR', 'FCA', 'SVR', 'FRR']);
  });

  it('phase-gate rule sets are pairwise DISJOINT', () => {
    const seen = new Set<string>();
    for (const ids of Object.values(PHASE_GATE_RULES)) {
      for (const id of ids) {
        expect(seen.has(id), `${id} assigned to two phase gates`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('phase gates + impl gates EXHAUSTIVELY span all V3_RULES (no foreign, no dropped)', () => {
    const modelRuleIds = [...Object.values(PHASE_GATE_RULES).flat(), ...IMPL_GATE_RULES];
    const familyIds = getFamilyRuleIds();

    // No duplicates across the whole model.
    expect(new Set(modelRuleIds).size).toBe(modelRuleIds.length);
    // Set-equality with the contracts V3_RULES — the model covers exactly them.
    expect(new Set(modelRuleIds)).toEqual(familyIds);
    // The impl gates carry the milestone- AND change-level rules: the impl gates ARE
    // the milestone/CR burndown, so a rule about a CR belongs there and not on a design
    // review (CR-GC-312 widened this from MS-01/MS-02 alone). Derived from the prefix,
    // not listed — a new MS-/CR-R rule must not need this line edited.
    expect([...IMPL_GATE_RULES].sort()).toEqual(
      [...getFamilyRuleIds()].filter((id) => /^(MS-|CR-R)/.test(id)).sort(),
    );
  });

  it('no model rule-ID is a foreign BQ-* rule', () => {
    const modelRuleIds = [...Object.values(PHASE_GATE_RULES).flat(), ...IMPL_GATE_RULES];
    for (const id of modelRuleIds) expect(/^BQ-/i.test(id)).toBe(false);
  });
});

// --- phase_readiness (CR-GC-296): RULE_TO_PHASE rule coverage, orthogonal to --
// --- the PHASE_GATE_RULES/completeness model above (structural chain legs). --

describe('computePhaseReadiness / currentPhaseGate (CR-GC-296)', () => {
  it('no violations → every gate fully covered, currentPhaseGate is null (Handoff allowed)', () => {
    const report = computePhaseReadiness([]);
    expect(report.map((p) => p.gate)).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
    for (const gate of report) {
      expect(gate.total).toBeGreaterThan(0);
      expect(gate.covered).toBe(gate.total);
      expect(gate.missing).toEqual([]);
    }
    expect(currentPhaseGate(report)).toBeNull();
  });

  it('a PDR-mapped violation (R-15) opens PDR only — SRR ahead of it in order stays irrelevant', () => {
    const report = computePhaseReadiness([{ ruleId: 'R-15' }]);
    const pdr = report.find((p) => p.gate === 'PDR')!;
    const srr = report.find((p) => p.gate === 'SRR')!;
    expect(pdr.missing).toEqual(['R-15']);
    expect(pdr.covered).toBe(pdr.total - 1);
    expect(srr.covered).toBe(srr.total); // SRR untouched
    expect(currentPhaseGate(report)).toBe('PDR');
  });

  it('currentPhaseGate returns the FIRST incomplete gate in SRR→PDR→CDR→TRR order, not the worst', () => {
    // TRR (R-19) AND SRR (BQ-02) both open — SRR comes first in lifecycle order.
    const report = computePhaseReadiness([{ ruleId: 'R-19' }, { ruleId: 'BQ-02' }]);
    expect(currentPhaseGate(report)).toBe('SRR');
  });

  it('duplicate violations for the same rule collapse to one missing entry (Set semantics)', () => {
    const report = computePhaseReadiness([
      { ruleId: 'R-02' },
      { ruleId: 'R-02' },
      { ruleId: 'R-02' },
    ]);
    const pdr = report.find((p) => p.gate === 'PDR')!;
    expect(pdr.missing).toEqual(['R-02']);
  });

  it('PHASE_GATE_ORDER is the INCOSE lifecycle order the Handoff walk relies on', () => {
    expect(PHASE_GATE_ORDER).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
  });
});

// --- (C) unit: deterministic gate derivation from crafted inputs -------------

describe('TEST-readiness-model (C): computeReadiness derives gates from rules + MS', () => {
  it('phase gates reflect their owned rules (error → blocked, warning → open)', () => {
    const violations: RuleViolation[] = [
      { ruleId: 'R-01', severity: 'error', elementId: 'REQ-x', message: 'REQ-x has no verification trace' },
      { ruleId: 'R-02', severity: 'warning', elementId: 'FUNC-y', message: 'FUNC-y does not satisfy any requirement' },
      { ruleId: 'R-08', severity: 'error', elementId: 'T-z', message: 'dangling trace' },
    ];
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [{ uid: 'REQ-x', type: 'REQ', name: 'x', description: '', attributes: {} }],
      edges: [],
    };
    const r = computeReadiness(violations, graph);
    const gate = (id: string) => r.phaseGates.find((g) => g.id === id)!;

    // Scores are (owned rules − firing rules) / owned, so they move whenever a gate's
    // rule set grows. Derived from PHASE_GATE_RULES rather than written out (CR-GC-312):
    // a hardcoded 2/3 asserts the catalog SIZE, which is exactly what nobody wants to
    // re-edit — and what let ten rule families sit unevaluated for months.
    const owned = (id: string): number => PHASE_GATE_RULES[id]!.length;
    // WHICH gate owns a rule comes from contracts' RULE_TO_PHASE (CR-GC-312) and is not
    // this test's business — asserting 'SRR' for R-01 is precisely how the readiness
    // model drifted away from that map on 21 rules while staying green. What IS this
    // test's business: an error blocks its owner and costs one rule of its score, a
    // warning does neither.
    const ownerOf = (ruleId: string): string => RULE_TO_PHASE[ruleId];
    const errorGate = ownerOf('R-01');
    const warnGate = ownerOf('R-02');
    const cleanGate = ['SRR', 'PDR', 'CDR', 'TRR'].find(
      (g) => g !== errorGate && g !== warnGate && g !== ownerOf('R-08'),
    )!;

    // R-01 (error) blocks its owning gate and costs it one rule.
    expect(gate(errorGate).passed).toBe(false);
    expect(gate(errorGate).blocking.some((b) => b.startsWith('R-01'))).toBe(true);
    // R-08 is an error too; if it shares the gate, two rules are down, not one.
    const downOnErrorGate = ownerOf('R-08') === errorGate ? 2 : 1;
    expect(gate(errorGate).score).toBeCloseTo(
      (owned(errorGate) - downOnErrorGate) / owned(errorGate),
    );
    // R-02 (warning) surfaces as open, never blocks, never reduces the score.
    expect(gate(warnGate).open.some((o) => o.startsWith('R-02'))).toBe(true);
    if (warnGate !== errorGate && warnGate !== ownerOf('R-08')) {
      expect(gate(warnGate).passed).toBe(true);
      expect(gate(warnGate).score).toBe(1);
    }
    // A gate no violation touches stays clean.
    expect(gate(cleanGate).passed).toBe(true);
    expect(gate(cleanGate).blocking).toEqual([]);
  });

  it('impl gates reflect milestone CR status (open CR blocks) + missing MS', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [
        { uid: 'MS-1-specification', type: 'MS', name: 'M1', description: '', attributes: { status: 'reviewed' } },
        { uid: 'CR-a', type: 'CR', name: 'a', description: '', attributes: { status: 'done' } },
        { uid: 'CR-b', type: 'CR', name: 'b', description: '', attributes: { status: 'open' } },
      ],
      edges: [
        { sourceId: 'CR-a', targetId: 'MS-1-specification', edgeType: 'relation', attributes: {} },
        { sourceId: 'CR-b', targetId: 'MS-1-specification', edgeType: 'relation', attributes: {} },
      ],
    };
    const r = computeReadiness([], graph);
    const gate = (id: string) => r.implGates.find((g) => g.id === id)!;

    // SAR → MS-1-specification: 1 of 2 CRs done → blocked on CR-b, score 0.5.
    expect(gate('SAR').passed).toBe(false);
    expect(gate('SAR').score).toBe(0.5);
    expect(gate('SAR').blocking.some((b) => b.includes('CR-b') && b.includes('not done'))).toBe(true);
    // FCA/SVR/FRR milestones absent in this graph → not ready, flagged missing.
    expect(gate('FCA').passed).toBe(false);
    expect(gate('FCA').score).toBe(0);
    expect(gate('FCA').blocking.some((b) => b.includes('missing'))).toBe(true);
  });

  it('all CR-a done → SAR gate ready (no blocking)', () => {
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [
        { uid: 'MS-1-specification', type: 'MS', name: 'M1', description: '', attributes: { status: 'reviewed' } },
        { uid: 'CR-a', type: 'CR', name: 'a', description: '', attributes: { status: 'done' } },
      ],
      edges: [{ sourceId: 'CR-a', targetId: 'MS-1-specification', edgeType: 'relation', attributes: {} }],
    };
    const r = computeReadiness([], graph);
    const sar = r.implGates.find((g) => g.id === 'SAR')!;
    expect(sar.passed).toBe(true);
    expect(sar.score).toBe(1);
    expect(sar.blocking).toEqual([]);
  });
});

// --- (C-221): creations as a gate precondition (rule-green ≠ analysis-done) ---
describe('TEST-readiness-creations (CR-GC-221): creations gate phase + impl readiness', () => {
  const reviewedMs = (status = 'reviewed') => ({
    uid: 'MS-1-specification',
    type: 'MS',
    name: 'M1',
    description: '',
    attributes: { status },
  });
  const doneCr = { uid: 'CR-a', type: 'CR', name: 'a', description: '', attributes: { status: 'done' } };
  const sarGraph: Pick<Graph, 'nodes' | 'edges'> = {
    nodes: [reviewedMs(), doneCr],
    edges: [{ sourceId: 'CR-a', targetId: 'MS-1-specification', edgeType: 'relation', attributes: {} }],
  };

  it('a rule-clean PDR without FMEA is BLOCKED (rule-green ≠ analysis-done)', () => {
    // No violations → PDR is rule-clean; provider reports every creation absent (🔴).
    const r = computeReadiness([], { nodes: [], edges: [] }, ABSENT_CREATION_PROVIDER);
    const pdr = r.phaseGates.find((g) => g.id === 'PDR')!;
    expect(pdr.passed).toBe(false);
    expect(pdr.blocking).toContain('FMEA not performed (PDR creation)');
    expect(pdr.creationArtifacts).toEqual(['fmea', 'trade']);
  });

  it('PDR passes when its creations are 🟢 current AND rules are clean (the AND, both ways)', () => {
    const allCurrent: CreationCurrencyProvider = () => 'current';
    const pdr = computeReadiness([], { nodes: [], edges: [] }, allCurrent).phaseGates.find((g) => g.id === 'PDR')!;
    expect(pdr.passed).toBe(true);
    expect(pdr.blocking).toEqual([]);
  });

  it('impl gate blocks on a 🔴-absent required creation even when every CR is done (anti-vacuous-green)', () => {
    const sar = computeReadiness([], sarGraph, ABSENT_CREATION_PROVIDER).implGates.find((g) => g.id === 'SAR')!;
    expect(sar.passed).toBe(false);
    expect(sar.blocking.some((b) => b.includes('not performed'))).toBe(true);
    // The SAME graph is ready without enforcement → proves it's the creation, not the CRs.
    expect(computeReadiness([], sarGraph).implGates.find((g) => g.id === 'SAR')!.passed).toBe(true);
  });

  it('impl gate ignores 🟡 stale creations — only 🔴 absent is anti-vacuous-green', () => {
    const allStale: CreationCurrencyProvider = () => 'stale';
    const sar = computeReadiness([], sarGraph, allStale).implGates.find((g) => g.id === 'SAR')!;
    expect(sar.passed).toBe(true);
  });

  it('gates always report creationArtifacts (metadata); enforcement only with a provider', () => {
    const r = computeReadiness([], { nodes: [], edges: [] });
    expect(r.phaseGates.find((g) => g.id === 'SRR')!.creationArtifacts).toEqual(['conops', 'assumption-review']);
    expect(r.phaseGates.find((g) => g.id === 'TRR')!.creationArtifacts).toEqual([]);
    // No provider → no creation blocking, despite the absent-by-default reality (back-compat).
    expect(r.phaseGates.find((g) => g.id === 'PDR')!.passed).toBe(true);
  });

  // CR-GC-259: an unenforced gate must SAY so. Without this flag a consumer cannot
  // tell "no creation blockers" from "creations never checked" — the false-green
  // class CR-GC-250 closed for completeness, here for creation currency.
  it('reports creationEnforcement so a passed gate cannot hide an unchecked creation', () => {
    const off = computeReadiness([], { nodes: [], edges: [] });
    expect(off.creationEnforcement).toBe('off');
    // PDR reads `passed` in this very report — that is exactly why `off` must be visible.
    expect(off.phaseGates.find((g) => g.id === 'PDR')!.passed).toBe(true);

    const on = computeReadiness([], { nodes: [], edges: [] }, ABSENT_CREATION_PROVIDER);
    expect(on.creationEnforcement).toBe('on');
    expect(on.phaseGates.find((g) => g.id === 'PDR')!.passed).toBe(false);

    // Survives the summary projection — graph_readiness returns that shape by default.
    expect(summarizeReadiness(off).creationEnforcement).toBe('off');
  });
});

// --- (C) integration: real SSOT, stays family-measured, well-formed ----------

describe('TEST-readiness-model (C-int): scores the live SSOT, never BQ', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-readiness-model-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    const config: HarnessConfig = {
      repoRoot: REPO_ROOT,
      scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    // lockDir = the temp store's dir — NOT repoRoot/.graphcode, which a live dev server owns (CR-GC-218).
    harness = new GraphCodeHarness(config, storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('report is lean-scoped with 4 phase + 4 impl well-formed gates', () => {
    const r = scoreReadiness(harness);
    expect(r.incoseScope).toBe('lean');
    expect(r.phaseGates.map((g) => g.id)).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
    expect(r.implGates.map((g) => g.id)).toEqual(['SAR', 'FCA', 'SVR', 'FRR']);
    for (const g of [...r.phaseGates, ...r.implGates]) {
      expect(typeof g.passed).toBe('boolean');
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(1);
    }
  });

  it('no gate item and no violation references a foreign BQ-* rule', () => {
    const r = scoreReadiness(harness);
    const familyIds = getFamilyRuleIds();
    for (const g of r.phaseGates) {
      for (const b of g.blocking) {
        // No foreign BQ-* rule may leak into any blocking item.
        expect(/^BQ-/i.test(b)).toBe(false);
        // Rule-keyed blockers (R-xx/RD-xx/MS-xx: …) must name a family rule.
        // Creation (CR-GC-221) and completeness (CR-GC-250) blockers are not
        // rule-keyed and are exempt from the family-id check.
        const m = /^(R-\d+|RD-\d+|MS-\d+):/.exec(b);
        if (m) expect(familyIds.has(m[1])).toBe(true);
      }
    }
    for (const v of r.violations) expect(/^BQ-/i.test(v.ruleId)).toBe(false);
    for (const k of Object.keys(r.violationsByRule)) expect(/^BQ-/i.test(k)).toBe(false);
  });

  it('SVR gate (MS-3, all 7 core CRs done) lists only the open safety-net CRs as not-done', () => {
    const r = scoreReadiness(harness);
    const svr = r.implGates.find((g) => g.id === 'SVR')!;
    const notDone = svr.blocking.filter((b) => b.includes('not done'));
    // The 7 core MS-3 CRs were closed in housekeeping; only CR-GC-200/201/202 remain open.
    for (const item of notDone) {
      expect(/CR-GC-(200|201|202)/.test(item)).toBe(true);
    }
  });
});
