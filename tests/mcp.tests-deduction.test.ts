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
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { TestRefsSchema } from '@sigloch/contracts/se';
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

// ---------------------------------------------------------------------------
// TEST-graph-tests-operational (CR-GC-204) — graph_tests is OPERATIONAL on the
// real committed SSOT graph: a CODE changeset resolves to the COMPLETE set of
// affected test files via the directed code→REQ→TEST traversal (no false-green),
// and every runnable TEST node carries a testRefs entry pointing at a file that exists
// (concept-only nodes are explicitly flagged + surface under `unresolved`).
//
// Seeds the real docs/graph/graphcode.graph.json into a disk Kuzu store through
// the gate (same path as bootstrap/import), then exercises graph_tests against it.
// ---------------------------------------------------------------------------
describe('TEST-graph-tests-operational: graph_tests operational on the committed SSOT (CR-GC-204)', () => {
  const REPO_ROOT = join(__dirname, '..');
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tests-operational-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson(); // load the real committed graph through the gate
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(e) a code changeset resolves to the COMPLETE affected test-file set via directed code→REQ→TEST', async () => {
    // CR-GC-200 changed MOD-codec + MOD-harness; the new tests span THREE files
    // (graph-integrity, codec.validation, harness.gate). Plain incoming-impact
    // selected 0 TESTs (wrong direction); the directed resolver must reach all three.
    const res = await registry['graph_tests'].handler({ changeSet: ['MOD-codec', 'MOD-harness'], depth: 3 });

    expect(res.coverage.impactedTests).toBeGreaterThan(0);
    expect(res.coverage.files).toContain('tests/graph-integrity.test.ts');
    expect(res.coverage.files).toContain('tests/codec.validation.test.ts');
    expect(res.coverage.files).toContain('tests/harness.gate.test.ts');
    // Selective run command over exactly the affected files.
    expect(res.command.startsWith('vitest run ')).toBe(true);
    for (const f of res.coverage.files) expect(res.command).toContain(f);
    // Unrelated subsystem (dashboard panels) is NOT pulled in.
    expect(res.coverage.files).not.toContain('tests/panels.test.ts');
  });

  it('(f) testRefs-coverage conformance: every TEST node is runnable-with-existing-file OR explicitly concept-only', async () => {
    const testNodes = harness.getGraph().nodes.filter((n) => n.type === 'TEST');
    expect(testNodes.length).toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const n of testNodes) {
      const raw = n.attributes?.testRefs;
      const isConcept = n.attributes?.concept === true;
      if (raw === undefined || raw === null) {
        // No silent gap: a TEST without a runnable binding MUST be flagged concept-only.
        if (!isConcept) offenders.push(`${n.uid}: no testRefs and not concept-only`);
        continue;
      }
      const parsed = TestRefsSchema.safeParse(raw);
      if (!parsed.success) {
        offenders.push(`${n.uid}: invalid testRefs`);
        continue;
      }
      // CR-GC-338: JEDER Eintrag muss auf eine existierende Datei zeigen — eine Abnahme aus
      // Unit- und Visual-Lauf ist erst dann wirklich lauffaehig, wenn beide Dateien da sind.
      for (const ref of parsed.data) {
        if (!existsSync(join(REPO_ROOT, ref.file))) {
          offenders.push(`${n.uid}: testRefs entry file missing on disk → ${ref.file}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(g) impacted concept-only TESTs surface under unresolved, never silently dropped', async () => {
    // MOD-codec satisfies REQ-interface-schema, verified only by the concept-only
    // TEST-interface-schema → it must appear as unresolved, not vanish.
    const res = await registry['graph_tests'].handler({ changeSet: ['MOD-codec', 'MOD-harness'], depth: 3 });
    const unresolvedIds = res.unresolved.map((u: { id: string }) => u.id);
    expect(unresolvedIds).toContain('TEST-interface-schema');
    // Every unresolved entry is a genuinely concept-only node in the committed graph.
    const conceptIds = new Set(
      harness.getGraph().nodes.filter((n) => n.attributes?.concept === true).map((n) => n.uid),
    );
    for (const id of unresolvedIds) expect(conceptIds.has(id)).toBe(true);
    // Resolved + unresolved account for every impacted TEST.
    expect(res.coverage.resolved + res.unresolved.length).toBe(res.coverage.impactedTests);
  });
});
