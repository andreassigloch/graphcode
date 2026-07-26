/**
 * TEST-dashboard-ontology-sync — CR-GC-107 acceptance test.
 *
 * Proves that readiness scoring is measured against @sigloch/contracts V3_RULES
 * (family rule-IDs, e.g. R-xx / RD-xx) and NOT the aimprove predecessor rules
 * (BQ-2.0.0 / INCOSE-style BQ-06/BQ-02).
 *
 * Assertions (per acceptance node in graphcode.graph.json):
 *   (1) Every violation ruleId from the full SSOT graph is a member of
 *       SE_DESCRIPTOR.rules.map(r => r.id)  — contracts rule-IDs only.
 *   (2) No ruleId matches /^BQ-/i           — foreign BQ rules absent.
 *   (3) scoreReadiness() returns a numeric compliance score in [0, 1].
 *   (4) violationsByRule keys are a subset of family rule-IDs.
 *
 * Uses real disk Kuzu (temp dir), seeds the full SSOT graph, no mocks,
 * no :memory:. Temp dir is cleaned up in afterEach.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { scoreReadiness, getFamilyRuleIds } from '../src/readiness.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-dashboard-ontology-sync: readiness is family-measured, not BQ-measured', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-readiness-'));
    const storage = new KuzuAdapter({
      ontology: SE_DESCRIPTOR,
      path: join(tmp, 'kuzu'),
    });
    // repoRoot = real repo so seedFromJson finds docs/graph/graphcode.graph.json;
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    // Seed the full SSOT graph.
    await harness.seedFromJson();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(1) every violation ruleId is a family contracts rule-ID (R-xx / RD-xx)', () => {
    const report = scoreReadiness(harness);
    const familyIds = getFamilyRuleIds();

    const unknownRuleIds = report.violations
      .map((v) => v.ruleId)
      .filter((id) => !familyIds.has(id));

    // Log for proof (CI output captures this).
    console.log('Family rule-IDs:', [...familyIds].sort().join(', '));
    console.log(
      'Fired rule-IDs:',
      [...new Set(report.violations.map((v) => v.ruleId))].sort().join(', '),
    );
    console.log('Total violations:', report.violations.length);
    console.log('Violations by rule:', JSON.stringify(report.violationsByRule, null, 2));

    expect(unknownRuleIds).toHaveLength(0);
  });

  it('(2) no violation ruleId matches /^BQ-/i — foreign BQ rules absent', () => {
    const report = scoreReadiness(harness);
    const bqRuleIds = report.violations.map((v) => v.ruleId).filter((id) => /^BQ-/i.test(id));
    expect(bqRuleIds).toHaveLength(0);
  });

  it('(3) compliance dimension is numeric in [0, 1]', () => {
    const report = scoreReadiness(harness);
    expect(typeof report.compliance.score).toBe('number');
    expect(report.compliance.score).toBeGreaterThanOrEqual(0);
    expect(report.compliance.score).toBeLessThanOrEqual(1);
    expect(report.compliance.totalElements).toBe(harness.getGraph().nodes.length);
    console.log(
      `Compliance: ${(report.compliance.score * 100).toFixed(1)}% ` +
      `(${report.compliance.elementsWithErrors} of ${report.compliance.totalElements} elements have errors)`,
    );
  });

  it('(4) violationsByRule keys are a subset of family rule-IDs', () => {
    const report = scoreReadiness(harness);
    const familyIds = getFamilyRuleIds();
    const unknownKeys = Object.keys(report.violationsByRule).filter((k) => !familyIds.has(k));
    expect(unknownKeys).toHaveLength(0);
  });
});
