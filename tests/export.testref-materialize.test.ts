/**
 * TEST-testref-materialize (CR-GC-205 Item 4) — graph_export scaffolds a runnable
 * `it.todo` stub for every bound TEST whose testRefs entry file is ABSENT, so graph_tests
 * never resolves a phantom path (the spec-time materialization that replaces the
 * lenient "non-null testRefs ⇒ file may not exist yet" gap with a hard guarantee).
 *
 * Asserts: (a) a missing testRefs entry file is materialized as a valid it.todo stub and
 * listed under `stubs`; (b) an EXISTING test file is never overwritten; (c) an
 * unbound TEST gets nothing, and the retired `concept` attribute changes neither
 * outcome (contracts CR-SM-393); (d) after export, graph_tests resolves the
 * materialized file — a real selective run, no false-green; (e) an export of a
 * DRAFT materializes nothing and does not begin the realization (CR-SM-392).
 *
 * Real disk Kuzu (tmp dir, never :memory:). repoRoot is the tmp dir, so all
 * scaffolded files land under it and are cleaned up. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { isDue } from '@sigloch/contracts/se';
import { toOntologyGraph } from '../src/kernel/conformance.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

describe('TEST-testref-materialize: graph_export scaffolds missing testRefs stubs (CR-GC-205 Item 4)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;

  const BOUND_MISSING = 'tests/_generated-bound.test.ts'; // file does NOT exist → materialize
  const BOUND_EXISTING = 'tests/_already-real.test.ts'; // file exists → never overwrite
  const BOUND_ALT = 'tests/_generated-alt.test.ts'; // Alt-Graph: bound AND still carrying `concept: true`
  const SENTINEL = '// REAL TEST — must not be overwritten\n';

  const fixture = {
    elements: [
      { id: 'REQ-bound', type: 'REQ', name: 'Req bound', description: 'verified by an unimplemented TEST' },
      {
        id: 'TEST-bound', type: 'TEST', name: 'Bound Test', description: 'bound but not yet implemented',
        testRefs: [{ file: BOUND_MISSING, case: 'does the bound thing', tool: 'vitest', level: 'unit' }],
      },
      { id: 'REQ-existing', type: 'REQ', name: 'Req existing', description: 'verified by a real TEST' },
      {
        id: 'TEST-existing', type: 'TEST', name: 'Existing Test', description: 'already implemented',
        testRefs: [{ file: BOUND_EXISTING, tool: 'vitest', level: 'unit' }],
      },
      { id: 'REQ-unbound', type: 'REQ', name: 'Req unbound', description: 'verified by a TEST without testRefs' },
      // Alt-Graph: `concept: true` ohne Bindung — frueher die Ausnahme, jetzt schlicht ungebunden.
      { id: 'TEST-unbound', type: 'TEST', name: 'Unbound Test', description: 'no run artifact yet', concept: true },
      { id: 'REQ-alt', type: 'REQ', name: 'Req alt', description: 'verified by a bound TEST of an old graph' },
      // Alt-Graph: `concept: true` MIT Bindung — frueher uebersprungen, jetzt materialisiert wie jede Bindung.
      {
        id: 'TEST-alt', type: 'TEST', name: 'Alt Test', description: 'bound, attribute left over', concept: true,
        testRefs: [{ file: BOUND_ALT, tool: 'vitest', level: 'unit' }],
      },
    ],
    traces: [
      { source: 'TEST-bound', target: 'REQ-bound', type: 'verify' },
      { source: 'TEST-existing', target: 'REQ-existing', type: 'verify' },
      { source: 'TEST-unbound', target: 'REQ-unbound', type: 'verify' },
      { source: 'TEST-alt', target: 'REQ-alt', type: 'verify' },
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

  it('(b) never overwrites an existing real test file, and (c) the retired `concept` attribute decides nothing', async () => {
    const res = await registry['graph_export'].handler({ force: false });

    // (b) the real file is untouched and absent from the created list.
    expect(readFileSync(join(tmp, BOUND_EXISTING), 'utf8')).toBe(SENTINEL);
    expect(res.stubs).not.toContain(BOUND_EXISTING);
    // (c) what decides is the binding alone: the bound Alt-TEST is materialized although it
    // carries `concept: true`, the unbound one gets no file although it carries it too.
    expect([...res.stubs].sort()).toEqual([BOUND_ALT, BOUND_MISSING].sort());
    expect(readFileSync(join(tmp, BOUND_ALT), 'utf8')).toContain('TEST-alt');
    // … and R-19 reports the unbound one (realization has begun: bindings exist).
    const r19 = harness.evaluateRules().filter((v) => v.ruleId === 'R-19').map((v) => v.elementId);
    expect(r19).toEqual(['TEST-unbound']);
  });

  it('(d) after export, graph_tests resolves the materialized file — a real selective run, no phantom', async () => {
    await registry['graph_export'].handler({ force: false });
    const res = await registry['graph_tests'].handler({ changeSet: ['REQ-bound'], depth: 1 });

    expect(res.coverage.files).toContain(BOUND_MISSING);
    expect(existsSync(join(tmp, res.coverage.files[0]))).toBe(true); // the file graph_tests names really exists
    expect(res.command).toContain(BOUND_MISSING);
  });
});

/**
 * Die Klippe, die es NICHT gibt (CR-GC-744): seit contracts CR-SM-392 schweigen R-19/R-26, bis die
 * Realisierung begonnen hat — und jede `realRef`/`testRefs`-Bindung beginnt sie. Ein Export, der im
 * Entwurf Stubs schriebe UND dafuer Bindungen setzte, beendete den warnungsfreien Zustand von selbst.
 * Er tut beides nicht: materialisiert wird die DATEI einer vorhandenen Bindung, nie die Bindung.
 */
describe('TEST-testref-materialize (e): ein Export im Entwurf beginnt die Realisierung nicht', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  const entwurf = {
    elements: [
      { id: 'SYS-e', type: 'SYS', name: 'Entwurf', description: 'Ein System im Entwurf.' },
      { id: 'REQ-e', type: 'REQ', name: 'Req e', description: 'Das System muss etwas tun.' },
      { id: 'TEST-e', type: 'TEST', name: 'Test e', description: 'noch an keine Datei gebunden' },
      { id: 'SCHEMA-e', type: 'SCHEMA', name: 'Schema e', description: 'noch an keinen Export gebunden' },
    ],
    traces: [
      { source: 'SYS-e', target: 'REQ-e', type: 'compose' },
      { source: 'TEST-e', target: 'REQ-e', type: 'verify' },
    ],
  };
  const gebunden = () =>
    harness.getGraph().nodes.filter((n) => n.attributes?.testRefs !== undefined || n.attributes?.realRef !== undefined).map((n) => n.uid);
  const bindungsBefunde = () => harness.evaluateRules().filter((v) => ['R-19', 'R-20', 'R-26'].includes(v.ruleId));

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-materialize-entwurf-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(entwurf);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  // CR-GC-748: „der Bau ist eroeffnet" ist die Faelligkeit einer Regel der Stufe 11 (contracts `isDue`,
  // CR-SM-395) — ein offener Auftrag oder eine Bindung. Vorher: `realizationBegun` (CR-SM-392).
  const bauEroeffnet = (): boolean => isDue({ stage: 11, domain: [] }, toOntologyGraph(harness.getGraph()));

  it('schreibt keinen Stub, setzt keine Bindung, und die Bindungsregeln bleiben still', async () => {
    expect(bauEroeffnet()).toBe(false);
    expect(bindungsBefunde()).toEqual([]);

    const res = await bindToolsToHarness(harness)['graph_export'].handler({ force: false });

    expect(res.stubs).toEqual([]);
    expect(existsSync(join(tmp, 'tests'))).toBe(false);
    expect(existsSync(join(tmp, 'src'))).toBe(false);
    expect(gebunden()).toEqual([]);
    expect(bauEroeffnet()).toBe(false);
    expect(bindungsBefunde()).toEqual([]);
  });

  it('Positivkontrolle: mit der ersten Bindung melden die uebrigen, und nur deren Datei wird materialisiert', async () => {
    await harness.mutate([
      { op: 'update-node', node: { uid: 'TEST-e', type: 'TEST', attributes: { testRefs: [{ file: 'tests/e.test.ts', tool: 'vitest' }] } } },
    ]);
    expect(bauEroeffnet()).toBe(true);
    expect(bindungsBefunde().map((v) => `${v.ruleId}:${v.elementId}`)).toEqual(['R-26:SCHEMA-e']);

    const res = await bindToolsToHarness(harness)['graph_export'].handler({ force: false });
    expect(res.stubs).toEqual(['tests/e.test.ts']);
    expect(gebunden()).toEqual(['TEST-e']);
  });
});
