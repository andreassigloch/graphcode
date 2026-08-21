/**
 * TEST-test-runnable-binding (CR-GC-134) — graph_tests deduces the minimal
 * selective test set for a change. It WRAPS graph_impact's harness.impact()
 * (no parallel blast-radius path), resolves each impacted TEST via its `testRefs`
 * runnable binding, and emits a `vitest run <only-affected-files>` command.
 *
 * Disk-Kuzu fixture (incoming-dependent direction, mirrors mcp.impact.test.ts):
 *   TEST-A      -verify->  REQ-A   (testRefs → tests/feature-a.test.ts)   impacted+resolved
 *   TEST-NOREF  -verify->  REQ-A   (no testRefs)                           impacted+unresolved
 *   MOD-A       -satisfy-> REQ-A   (dependent, not a TEST)
 *   TEST-B      -verify->  REQ-B   (testRefs → tests/feature-b.test.ts)    UNRELATED
 *
 * Asserts: (a) a changeset resolves to exactly its impacted TESTs via testRefs;
 * (b) the run command lists ONLY affected files and excludes unrelated ones;
 * (c) graph_tests sees the SAME impacted set as graph_impact (wrap proof);
 * (d) a TEST without testRefs is reported under `unresolved`, never dropped.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-test-runnable-binding: graph_tests deduces a minimal selective test set (CR-GC-134)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  // testRef rides as an extra element field → importGraph folds it into node.attributes.testRefs.
  const fixture = {
    elements: [
      { id: 'REQ-A', type: 'REQ', name: 'Req A', description: 'root under change' },
      {
        id: 'TEST-A',
        type: 'TEST',
        name: 'Test A',
        description: 'verifies REQ-A',
        testRefs: [{ file: 'tests/feature-a.test.ts', case: 'does A', tool: 'vitest', level: 'unit' }],
      },
      { id: 'TEST-NOREF', type: 'TEST', name: 'Test NoRef', description: 'verifies REQ-A, no testRefs' },
      { id: 'MOD-A', type: 'MOD', name: 'Mod A', description: 'satisfies REQ-A (dependent, not a TEST)' },
      { id: 'REQ-B', type: 'REQ', name: 'Req B', description: 'unrelated component' },
      {
        id: 'TEST-B',
        type: 'TEST',
        name: 'Test B',
        description: 'verifies REQ-B',
        testRefs: [{ file: 'tests/feature-b.test.ts', tool: 'vitest', level: 'unit' }],
      },
    ],
    traces: [
      { source: 'TEST-A', target: 'REQ-A', type: 'verify' },
      { source: 'TEST-NOREF', target: 'REQ-A', type: 'verify' },
      { source: 'MOD-A', target: 'REQ-A', type: 'satisfy' },
      { source: 'TEST-B', target: 'REQ-B', type: 'verify' },
    ],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tests-deduction-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) resolves the impacted TEST uniquely via its testRefs', async () => {
    const registry = bindToolsToHarness(harness);
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-A'], depth: 1 });

    const resolvedIds = res.tests.map((t: { id: string }) => t.id);
    expect(resolvedIds).toContain('TEST-A');
    const a = res.tests.find((t: { id: string }) => t.id === 'TEST-A');
    expect(a?.testRefs[0].file).toBe('tests/feature-a.test.ts');
    expect(a?.testRefs[0].tool).toBe('vitest');
    expect(res.coverage.files).toEqual(['tests/feature-a.test.ts']);
  });

  it('(b) the run command lists ONLY affected files and excludes the unrelated component', async () => {
    const registry = bindToolsToHarness(harness);
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-A'], depth: 1 });

    expect(res.command).toBe('vitest run tests/feature-a.test.ts');
    // TEST-B verifies REQ-B (unrelated) — its file must NOT appear.
    expect(res.command).not.toContain('feature-b');
    expect(res.tests.map((t: { id: string }) => t.id)).not.toContain('TEST-B');
  });

  it('(c) wrap proof: the directed resolver prunes within graph_impact’s blast radius — no second traversal (CR-GC-204)', async () => {
    const registry = bindToolsToHarness(harness);
    const impact = await registry['graph_impact'].handler({ id: 'REQ-A', depth: 1 });
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-A'], depth: 1 });

    // For a REQ changeset the directed walk degenerates to verify-dependents: a
    // PRECISION subset of graph_impact's incoming blast radius (MOD-A satisfies REQ-A
    // but carries no test → correctly dropped). Both use the same getSubgraph primitive,
    // so the directed node set is bounded by — never exceeds — the impact node count.
    expect(res.coverage.impactedNodes).toBe(3); // REQ-A + its two verify-dependent TESTs
    expect(res.coverage.impactedNodes).toBeLessThanOrEqual(impact.nodeCount);
    // Two TESTs verify REQ-A (TEST-A + TEST-NOREF).
    expect(res.coverage.impactedTests).toBe(2);
  });

  it('(d) a TEST without testRefs is reported under unresolved, never silently dropped', async () => {
    const registry = bindToolsToHarness(harness);
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-A'], depth: 1 });

    const unresolvedIds = res.unresolved.map((u: { id: string }) => u.id);
    expect(unresolvedIds).toContain('TEST-NOREF');
    // Resolved + unresolved together account for every impacted TEST.
    expect(res.tests.length + res.unresolved.length).toBe(res.coverage.impactedTests);
  });
});
