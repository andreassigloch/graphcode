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
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
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
    // The impl gates carry exactly the milestone rules (MS-01/MS-02).
    expect([...IMPL_GATE_RULES].sort()).toEqual(['MS-01', 'MS-02']);
  });

  it('no model rule-ID is a foreign BQ-* rule', () => {
    const modelRuleIds = [...Object.values(PHASE_GATE_RULES).flat(), ...IMPL_GATE_RULES];
    for (const id of modelRuleIds) expect(/^BQ-/i.test(id)).toBe(false);
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

    // SRR owns R-01 (error) → blocked, score 2/3.
    expect(gate('SRR').passed).toBe(false);
    expect(gate('SRR').blocking.some((b) => b.startsWith('R-01'))).toBe(true);
    expect(gate('SRR').score).toBeCloseTo(2 / 3);
    // PDR owns R-02 (warning) → not blocked, surfaced as open, score 1.
    expect(gate('PDR').passed).toBe(true);
    expect(gate('PDR').open.some((o) => o.startsWith('R-02'))).toBe(true);
    expect(gate('PDR').score).toBe(1);
    // CDR has no firing rule → clean.
    expect(gate('CDR').passed).toBe(true);
    expect(gate('CDR').blocking).toEqual([]);
    // TRR owns R-08 (error) → blocked, score 1/2.
    expect(gate('TRR').passed).toBe(false);
    expect(gate('TRR').score).toBe(0.5);
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
    harness = new GraphCodeHarness(config, storage);
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
      // every phase-gate blocking item is keyed by one of that gate's family rules
      for (const b of g.blocking) {
        const ruleId = b.split(':')[0];
        expect(familyIds.has(ruleId)).toBe(true);
        expect(/^BQ-/i.test(ruleId)).toBe(false);
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
