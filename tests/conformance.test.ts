/**
 * TEST-code-conformance (CR-GC-206) — graph↔code conformance: every FUNC.codeRef
 * in the committed SSOT resolves to a REAL declared symbol in its source file,
 * checked with the TypeScript compiler's parser (not a substring match). The
 * consumer-side resolution R-20 (contracts, presence-only) leaves out.
 *
 * Seeds the real docs/graph/graphcode.graph.json into a disk Kuzu store through
 * the gate, then runs checkCodeConformance against the real src tree.
 *
 * Real disk Kuzu (tmp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { checkCodeConformance } from '../src/conformance.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

describe('TEST-code-conformance: every FUNC codeRef resolves to a real symbol (CR-GC-206)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-conformance-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage);
    await harness.initialize();
    await harness.seedFromJson();
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('resolves EVERY codeRef binding against the real src tree (TS-parser, not substring)', () => {
    const report = checkCodeConformance(harness.getGraph(), REPO_ROOT);
    // We actually exercised the FUNC population + resolved a real number of code symbols.
    expect(report.checkedFuncs).toBeGreaterThan(30);
    expect(report.resolved).toBeGreaterThan(20);
    expect(report.promptResolved).toBeGreaterThan(0);
    // No phantom binding: every code codeRef points at a declared symbol, every
    // prompt codeRef at an existing skill file.
    expect(report.violations).toEqual([]);
  });

  it('catches a codeRef pointing at a symbol that is not declared (the check is real, not vacuous)', () => {
    const g = harness.getGraph();
    const broken: typeof g = {
      nodes: g.nodes.map((n) =>
        n.uid === 'FUNC-mutate'
          ? { ...n, attributes: { ...n.attributes, codeRef: { file: 'src/harness.ts', symbol: 'definitelyNotASymbol', lang: 'ts' } } }
          : n,
      ),
      edges: g.edges,
    };
    const report = checkCodeConformance(broken, REPO_ROOT);
    expect(report.violations.some((v) => v.id === 'FUNC-mutate' && /not declared/.test(v.reason))).toBe(true);
  });
});
