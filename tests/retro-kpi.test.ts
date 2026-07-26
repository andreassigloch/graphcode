/**
 * TEST-retro-kpi (CR-GC-212) — the post-project KPI evaluator over a fixture session.
 *
 * Deterministic KPI values from a graph-rich fixture, and the key signal: a
 * deliberately graph-less session (grep-bypass) yields Graph-vs-Grep ratio < 1.
 * Real compute, no mocks.
 */
import { describe, it, expect } from 'vitest';
import { computeKpis, renderKpiTable } from '../scripts/retro-kpi.mjs';

const graphRich = {
  toolUsage: { graphCalls: 20, grepGlobDocReads: 5, mutate: 8, impact: 4, expand: 2, rulesEvaluate: 3 },
  audit: { applied: 18, rejected: 2 },
  readiness: { start: 0.6, end: 0.9 },
  git: { netLoc: 400, tokens: 80000 },
  plan: { dependsOnViolations: 0 },
  binding: { coveragePct: 100 },
};

const graphLess = {
  toolUsage: { graphCalls: 1, grepGlobDocReads: 30, mutate: 0, impact: 0, expand: 0, rulesEvaluate: 0 },
  audit: { applied: 5, rejected: 5 },
  readiness: { start: 0.5, end: 0.5 },
  git: { netLoc: 300, tokens: 120000 },
  plan: { dependsOnViolations: 3 },
  binding: { coveragePct: 40 },
};

describe('TEST-retro-kpi (CR-GC-212): post-project KPI standard', () => {
  it('graph-rich session → deterministic KPI values, ratio > 1', () => {
    const k = computeKpis(graphRich);
    expect(k.graphVsGrepRatio).toBe(4); // 20 / 5
    expect(k.graphVsGrepRatio).toBeGreaterThan(1);
    expect(k.tokenPerLoc).toBe(200); // 80000 / 400
    expect(k.planConformance).toBe(0); // target met
    expect(k.gateHealth.appliedRejectedRatio).toBe(9); // 18 / 2
    expect(k.gateHealth.readinessDelta).toBe(0.3); // 0.9 − 0.6
    expect(k.bindingCoverage).toBe(100);
  });

  it('graph-less session → Graph-vs-Grep ratio < 1 (graph bypass detected, not vacuous)', () => {
    const k = computeKpis(graphLess);
    expect(k.graphVsGrepRatio).toBeLessThan(1); // 1 / 30 ≈ 0.03
    expect(k.planConformance).toBe(3); // depends-on violations surfaced
  });

  it('tokenPerLoc is null when tokens were not captured (transcript follow-up)', () => {
    const k = computeKpis({ ...graphRich, git: { netLoc: 400 } });
    expect(k.tokenPerLoc).toBeNull();
  });

  it('renderKpiTable emits a markdown table with all 6 KPIs', () => {
    const md = renderKpiTable(computeKpis(graphRich));
    expect(md).toContain('| KPI | Value | Target |');
    for (const label of ['Graph-vs-Grep', 'Tool usage', 'Tokens per net-LOC', 'Plan conformance', 'Gate health', 'Binding coverage']) {
      expect(md).toContain(label);
    }
  });
});
