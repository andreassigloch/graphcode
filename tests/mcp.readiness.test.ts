/**
 * TEST-mcp-readiness (CR-GC-129) — graph_readiness exposes family readiness over MCP.
 *
 * The readiness score (CR-GC-107 / MOD-readiness) was only reachable as a library
 * function — an agent over the MCP surface could not get it (the retired
 * GET /api/graph/readiness served it before CR-GC-111). graph_readiness binds
 * scoreReadiness(harness) to the registry so se-review / se-status read it over
 * the protocol.
 *
 * Real disk Kuzu on a temp repo, no mocks: spec a small graph through the gate,
 * then call the bound tool and assert the ReadinessReport shape AND that family
 * contracts rule-IDs (R-/RD-), never foreign BQ-*, drive the score.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { getFamilyRuleIds } from '../src/readiness.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  // Kuzu needs the .graphcode parent to exist (createHarness mkdirs it; direct construction doesn't).
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'auth-service' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A gate-valid member: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose (R-17).
const CLEAN_MEMBER: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

// A FUNC with no satisfy edge → R-02 (FUNC must satisfy REQ, WARNING). Persists through the gate
// (delta semantics: only NEW error-violations block), so it surfaces in the readiness report.
const ORPHAN_FUNC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'FUNC-login', type: 'FUNC', name: 'Login flow', description: 'no satisfy edge', attributes: {} } },
];

describe('TEST-mcp-readiness: graph_readiness scores family readiness over the binding', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-readiness-mcp-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('returns the ReadinessReport shape for a clean gated member (compliance 1.0, no errors)', async () => {
    const tools = bindToolsToHarness(harness);
    const applied = await harness.mutate(CLEAN_MEMBER);
    expect(applied.success).toBe(true);

    const report = await tools.graph_readiness.handler({});

    // Shape: compliance dimension + per-rule counts + sorted raw violations + timestamp.
    expect(typeof report.compliance.score).toBe('number');
    expect(typeof report.compliance.label).toBe('string');
    expect(report.compliance.totalElements).toBe(harness.getGraph().nodes.length);
    expect(report.compliance.totalElements).toBe(4);
    expect(report.compliance.elementsWithErrors).toBe(0);
    expect(report.compliance.score).toBe(1);
    expect(Array.isArray(report.violations)).toBe(true);
    expect(typeof report.violationsByRule).toBe('object');
    // computedAt is a real ISO-8601 timestamp.
    expect(Number.isNaN(Date.parse(report.computedAt))).toBe(false);
  });

  it('is family-measured (R-/RD-), never BQ-: an R-02 warning drives violationsByRule', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    // The orphan FUNC is a WARNING (R-02), so the gate accepts it (no NEW error-violation).
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const report = await tools.graph_readiness.handler({ detail: true });
    const familyIds = getFamilyRuleIds();

    // The warning surfaced and is keyed by a family contracts rule-ID.
    expect(report.violationsByRule['R-02']).toBeGreaterThanOrEqual(1);
    // Every fired rule-ID is a family rule-ID; none is a foreign BQ-* rule.
    for (const ruleId of Object.keys(report.violationsByRule)) {
      expect(familyIds.has(ruleId)).toBe(true);
      expect(/^BQ-/i.test(ruleId)).toBe(false);
    }
    for (const v of report.violations) {
      expect(/^BQ-/i.test(v.ruleId)).toBe(false);
    }
    // A warning is not an error → compliance (error-severity) stays 1.0.
    expect(report.compliance.score).toBe(1);
  });

  // CR-GC-203 item 2 — graph_readiness summary mode keeps the result within the MCP limit.
  it('summary is the default (drops raw violations + gate lists, keeps scores + counts); detail:true restores them', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });

    // Summary drops the heavy per-element lists…
    expect(summary.violations).toEqual([]);
    for (const gate of [...summary.phaseGates, ...summary.implGates]) {
      expect(gate.blocking).toEqual([]);
      expect(gate.open).toEqual([]);
    }
    // …but keeps scores + counts (the R-02 warning is still counted, scores match detail).
    expect(summary.violationsByRule['R-02']).toBeGreaterThanOrEqual(1);
    expect(summary.violationsByRule).toEqual(detail.violationsByRule);
    expect(summary.compliance.score).toBe(detail.compliance.score);
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(detail).length);

    // detail:true restores the full lists.
    expect(detail.violations.length).toBeGreaterThanOrEqual(1);
    expect(
      [...detail.phaseGates, ...detail.implGates].some((g) => g.blocking.length > 0 || g.open.length > 0),
    ).toBe(true);
  });

  // CR-GC-296 — phase_readiness: the RULE_TO_PHASE-derived axis alongside the
  // pre-existing phaseGates (structural completeness, CR-GC-250). Both name the
  // same 4 gates but count DIFFERENT things — rule coverage here, not chain legs.
  it('phase_readiness (CR-GC-296): SRR/PDR/CDR/TRR covered/total + missing, in both summary and detail', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });

    for (const report of [summary, detail]) {
      expect(report.phase_readiness.map((p) => p.gate)).toEqual(['SRR', 'PDR', 'CDR', 'TRR']);
      for (const gate of report.phase_readiness) {
        expect(gate.total).toBeGreaterThan(0);
        expect(gate.covered).toBeLessThanOrEqual(gate.total);
        expect(gate.missing.length).toBe(gate.total - gate.covered);
      }
    }
    // FUNC-login has no satisfy→REQ (R-02, warning, PDR-mapped) — it must show up
    // as a PDR gap even though it never trips `blockingErrors` (not error-severity).
    const pdr = summary.phase_readiness.find((p) => p.gate === 'PDR');
    expect(pdr?.missing).toContain('R-02');
  });

  // -------------------------------------------------------------------------
  // CR-GC-325: the 8 RULE_TO_DIMENSION topic scores — the other projection of
  // the SAME rule stream. Before this CR `computeReadiness` ran inside nextStep
  // and seven of its eight results were thrown away; a dashboard that wanted the
  // architecture axis had to recompute it (which graph-view-edit actually did).
  // -------------------------------------------------------------------------

  it('dimension_readiness (CR-GC-325): all 8 dimensions, each with its denominator, in summary and detail', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });

    for (const report of [summary, detail]) {
      // Completeness: a MISSING dimension must not read as "all good" (req 5).
      expect(report.dimension_readiness.map((d) => d.dimension)).toEqual([
        'req',
        'uc',
        'arch',
        'alloc',
        'ver',
        'schema',
        'cr',
        'ms',
      ]);
      for (const d of report.dimension_readiness) {
        // The denominator is mandatory — a score without `applicable` is not
        // interpretable (req 4: ms reads 0 % off 67 findings over 15 elements).
        expect(typeof d.applicable, `${d.dimension}.applicable`).toBe('number');
        expect(typeof d.violations, `${d.dimension}.violations`).toBe('number');
        expect(d.score).toBeGreaterThanOrEqual(0);
        expect(d.score).toBeLessThanOrEqual(1);
        expect(typeof d.ready).toBe('boolean');
      }
    }
  });

  it('is ONE computation, not two: next_step\'s deficit is 1 − the score of that dimension', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const readiness = await tools.graph_readiness.handler({});
    const step = await tools.graph_next_step.handler({});

    expect(step.nextStep, 'fixture has findings, so a step is expected').not.toBeNull();
    const score = readiness.dimension_readiness.find((d) => d.dimension === step.nextStep!.dimension);
    expect(score, `dimension ${step.nextStep!.dimension} missing from dimension_readiness`).toBeDefined();
    // nextStep rounds the deficit to 3 decimals — same number, same snapshot.
    expect(step.nextStep!.deficit).toBeCloseTo(1 - score!.score, 3);
    expect(score!.violations).toBeGreaterThan(0);
  });
});
