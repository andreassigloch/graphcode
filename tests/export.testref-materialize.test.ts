/**
 * TEST-testref-materialize (CR-GC-205 Item 4) — graph_export scaffolds a runnable
 * `it.todo` stub for every bound TEST whose testRef file is ABSENT, so graph_tests
 * never resolves a phantom path (the spec-time materialization that replaces the
 * lenient "non-null testRef ⇒ file may not exist yet" gap with a hard guarantee).
 *
 * Asserts: (a) a missing testRef file is materialized as a valid it.todo stub and
 * listed under `stubs`; (b) an EXISTING test file is never overwritten; (c) a
 * concept-only TEST (no run artifact) is skipped; (d) after export, graph_tests
 * resolves the materialized file — a real selective run, no false-green.
 *
 * Real disk Kuzu (tmp dir, never :memory:). repoRoot is the tmp dir, so all
 * scaffolded files land under it and are cleaned up. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

describe('TEST-testref-materialize: graph_export scaffolds missing testRef stubs (CR-GC-205 Item 4)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;

  const BOUND_MISSING = 'tests/_generated-bound.test.ts'; // file does NOT exist → materialize
  const BOUND_EXISTING = 'tests/_already-real.test.ts'; // file exists → never overwrite
  const SENTINEL = '// REAL TEST — must not be overwritten\n';

  const fixture = {
    elements: [
      { id: 'REQ-bound', type: 'REQ', name: 'Req bound', description: 'verified by an unimplemented TEST' },
      {
        id: 'TEST-bound', type: 'TEST', name: 'Bound Test', description: 'bound but not yet implemented',
        testRef: { file: BOUND_MISSING, case: 'does the bound thing', tool: 'vitest', level: 'unit' },
      },
      { id: 'REQ-existing', type: 'REQ', name: 'Req existing', description: 'verified by a real TEST' },
      {
        id: 'TEST-existing', type: 'TEST', name: 'Existing Test', description: 'already implemented',
        testRef: { file: BOUND_EXISTING, tool: 'vitest', level: 'unit' },
      },
      { id: 'REQ-concept', type: 'REQ', name: 'Req concept', description: 'verified by a concept-only TEST' },
      { id: 'TEST-concept', type: 'TEST', name: 'Concept Test', description: 'no run artifact yet', concept: true },
    ],
    traces: [
      { source: 'TEST-bound', target: 'REQ-bound', type: 'verify' },
      { source: 'TEST-existing', target: 'REQ-existing', type: 'verify' },
      { source: 'TEST-concept', target: 'REQ-concept', type: 'verify' },
    ],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-materialize-'));
    // A pre-existing real test file the export must NOT clobber.
    mkdirSync(join(tmp, 'tests'), { recursive: true });
    writeFileSync(join(tmp, BOUND_EXISTING), SENTINEL);
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) materializes the missing testRef file as a valid it.todo stub and lists it under stubs', async () => {
    const res = await registry['graph_export'].handler({ force: false });

    expect(res.stubs).toContain(BOUND_MISSING);
    const abs = join(tmp, BOUND_MISSING);
    expect(existsSync(abs)).toBe(true);
    const content = readFileSync(abs, 'utf8');
    expect(content).toContain("import { describe, it } from 'vitest'");
    expect(content).toContain('it.todo(');
    expect(content).toContain('TEST-bound');
    expect(content).toContain('verifies REQ-bound');
  });

  it('(b) never overwrites an existing real test file, and (c) skips concept-only TESTs', async () => {
    const res = await registry['graph_export'].handler({ force: false });

    // (b) the real file is untouched and absent from the created list.
    expect(readFileSync(join(tmp, BOUND_EXISTING), 'utf8')).toBe(SENTINEL);
    expect(res.stubs).not.toContain(BOUND_EXISTING);
    // (c) the concept-only TEST gets no file.
    expect(res.stubs.every((s: string) => !s.includes('concept'))).toBe(true);
    expect(res.stubs).toEqual([BOUND_MISSING]); // exactly one stub created
  });

  it('(d) after export, graph_tests resolves the materialized file — a real selective run, no phantom', async () => {
    await registry['graph_export'].handler({ force: false });
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-bound'], depth: 1 });

    expect(res.coverage.files).toContain(BOUND_MISSING);
    expect(existsSync(join(tmp, res.coverage.files[0]))).toBe(true); // the file graph_tests names really exists
    expect(res.command).toContain(BOUND_MISSING);
  });
});
