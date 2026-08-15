/**
 * TEST-code-conformance (CR-GC-206 → CR-GC-253) — graph↔code conformance as a
 * readiness rule: every realRef/testRefs entry in the committed SSOT resolves against
 * the real src tree (TypeScript compiler parser, not a substring match), and a
 * broken binding surfaces as RC-01/RC-02 in the readiness report (gates/dashboard),
 * not just in a side report. Rules live in @sigloch/contracts; this exercises
 * graphcode's extractor + wiring.
 *
 * Seeds the real docs/graph/graphcode.graph.json into a disk Kuzu store through
 * the gate. Real disk Kuzu (tmp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { PHASE_GATE_RULES } from '../src/readiness.js';
import { GraphCodeHarness } from '../src/harness.js';
import { extractCodeFacts, extractImportEdges, conformanceViolations, scoreReadinessWithConformance, toOntologyGraph } from '../src/conformance.js';
import { elementToNode } from '../src/exporter.js';
import { evaluateAllRules, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

describe('TEST-code-conformance: realRef/testRefs resolve as RC readiness rules (CR-GC-253)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-conformance-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson();
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('extracts facts for every referenced file and the SSOT graph is RC-clean', () => {
    const facts = extractCodeFacts(harness.getGraph(), REPO_ROOT);
    const files = Object.values(facts.files);
    // We actually parsed a real population, symbols included.
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((f) => f.exists && f.declaredSymbols.length > 0).length).toBeGreaterThan(15);
    // No phantom/broken binding in the committed graph: zero RC ERRORS
    // (RC-01/02/03). RC-04/05 are warn-level indicators (schema-usage, cross-module
    // drift) that may legitimately fire on the real model — they are not "broken
    // bindings" and are asserted separately (CR-211/212).
    const rcErrors = conformanceViolations(harness).filter((v) => v.severity === 'error');
    expect(rcErrors).toEqual([]);
  });

  it('catches a realRef pointing at a symbol that is not declared → RC-01 (not vacuous)', () => {
    const g = harness.getGraph();
    const broken: typeof g = {
      nodes: g.nodes.map((n) =>
        n.uid === 'FUNC-mutate'
          ? { ...n, attributes: { ...n.attributes, realRef: { file: 'src/harness.ts', symbol: 'definitelyNotASymbol', lang: 'ts' } } }
          : n,
      ),
      edges: g.edges,
    };
    const violations = conformanceViolations({ getGraph: () => broken, getRepoRoot: () => REPO_ROOT });
    expect(
      violations.some((v) => v.ruleId === 'RC-01' && v.elementId === 'FUNC-mutate' && /not declared/.test(v.message)),
    ).toBe(true);
  });

  it('broken binding surfaces in the readiness report: violationsByRule + CDR gate blocks', () => {
    const g = harness.getGraph();
    const broken: typeof g = {
      nodes: g.nodes.map((n) =>
        n.uid === 'FUNC-mutate'
          ? { ...n, attributes: { ...n.attributes, realRef: { file: 'src/deleted-file.ts', symbol: 'gone', lang: 'ts' } } }
          : n,
      ),
      edges: g.edges,
    };
    const report = scoreReadinessWithConformance({
      evaluateRules: () => harness.evaluateRules(),
      getGraph: () => broken,
      getRepoRoot: () => REPO_ROOT,
    });
    expect(report.violationsByRule['RC-01']).toBe(1);
    // WHICH gate owns RC-01 is the readiness model's business, not this test's — since
    // CR-GC-312 it is derived (RC-01 inherits the gate of R-20, the presence rule it
    // resolves) instead of being written down. Naming a gate here is how the model
    // drifted from contracts on 21 rules while every test stayed green. What this test
    // asserts is the conformance→readiness wiring: a broken binding blocks its owner.
    const ownerId = Object.keys(PHASE_GATE_RULES).find((id) =>
      PHASE_GATE_RULES[id]!.includes('RC-01'),
    )!;
    const owner = report.phaseGates.find((gate) => gate.id === ownerId);
    expect(owner?.passed).toBe(false);
    expect(owner?.blocking.some((b) => b.startsWith('RC-01:'))).toBe(true);
  });

  it('resolves .mjs and .jsx realRefs and vitest case names (gve reality)', () => {
    const dir = join(tmp, 'jsrepo');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'widget.jsx'), 'export function Widget() { return <div/>; }\n');
    writeFileSync(join(dir, 'src', 'util.mjs'), 'export const computeThing = () => 42;\n');
    writeFileSync(
      join(dir, 'src', 'util.test.mjs'),
      "import { it } from 'vitest';\ndescribe('util', () => { it('computes the thing', () => {}); });\n",
    );
    const graph = {
      nodes: [
        { uid: 'FUNC-w', type: 'FUNC', name: 'w', description: '', attributes: { realRef: { file: 'src/widget.jsx', symbol: 'Widget', lang: 'js' } } },
        { uid: 'FUNC-u', type: 'FUNC', name: 'u', description: '', attributes: { realRef: { file: 'src/util.mjs', symbol: 'computeThing', lang: 'js' } } },
        { uid: 'TEST-u', type: 'TEST', name: 't', description: '', attributes: { testRefs: [{ file: 'src/util.test.mjs', case: 'computes the thing', tool: 'vitest' }] } },
      ],
      edges: [],
    };
    expect(conformanceViolations({ getGraph: () => graph, getRepoRoot: () => dir })).toEqual([]);
    // Renamed case → RC-02.
    const renamed = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.uid === 'TEST-u' ? { ...n, attributes: { testRefs: [{ file: 'src/util.test.mjs', case: 'renamed', tool: 'vitest' }] } } : n,
      ),
    };
    const v = conformanceViolations({ getGraph: () => renamed, getRepoRoot: () => dir });
    expect(v).toHaveLength(1);
    expect(v[0].ruleId).toBe('RC-02');
  });
});

// ── CR-211: realRef resolution (RC-03) + usage (RC-04) end-to-end ──────────
describe('TEST-schema-conformance: realRef resolves + is parsed at its interface (CR-211)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'graphcode-schema-conf-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'schema.ts'), "import { z } from 'zod';\nexport const EventSchema = z.object({ id: z.string() });\n");
    // Realized FUNC file that imports AND parses the schema.
    writeFileSync(
      join(dir, 'src', 'handler.ts'),
      "import { EventSchema } from './schema.js';\nexport function handle(raw: unknown) { return EventSchema.parse(raw); }\n",
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // SCHEMA-a defined by FLOW-x; FUNC-a produces FLOW-x and is realized in handler.ts.
  const wiredGraph = (schemaSymbol: string) => ({
    nodes: [
      { uid: 'SCHEMA-a', type: 'SCHEMA', name: 'evt', description: '', attributes: { realRef: { file: 'src/schema.ts', symbol: schemaSymbol } } },
      { uid: 'FLOW-x', type: 'FLOW', name: 'flow', description: '', attributes: {} },
      { uid: 'FUNC-a', type: 'FUNC', name: 'fn', description: '', attributes: { realRef: { file: 'src/handler.ts', symbol: 'handle' } } },
    ],
    edges: [
      { sourceId: 'FUNC-a', targetId: 'FLOW-x', edgeType: 'io', attributes: {} },
      { sourceId: 'FLOW-x', targetId: 'SCHEMA-a', edgeType: 'relation', attributes: {} },
    ],
  });

  it('extracts importedSymbols + parsedSymbols from the realized FUNC file', () => {
    const facts = extractCodeFacts(wiredGraph('EventSchema'), dir);
    const handler = facts.files['src/handler.ts'];
    expect(handler.importedSymbols).toContain('EventSchema');
    expect(handler.parsedSymbols).toContain('EventSchema');
  });

  it('bound schema, imported+parsed at the interface → RC-clean', () => {
    expect(conformanceViolations({ getGraph: () => wiredGraph('EventSchema'), getRepoRoot: () => dir })).toEqual([]);
  });

  it('realRef symbol not a declared export → RC-03 error', () => {
    const v = conformanceViolations({ getGraph: () => wiredGraph('GoneSchema'), getRepoRoot: () => dir });
    expect(v.some((x) => x.ruleId === 'RC-03' && x.elementId === 'SCHEMA-a')).toBe(true);
  });

  it('parse call removed from the interface file → RC-04 warning', () => {
    // Rewrite handler.ts to import but never parse.
    writeFileSync(
      join(dir, 'src', 'handler.ts'),
      "import { EventSchema } from './schema.js';\nexport function handle(raw: unknown) { void EventSchema; return raw; }\n",
    );
    const v = conformanceViolations({ getGraph: () => wiredGraph('EventSchema'), getRepoRoot: () => dir });
    expect(v.some((x) => x.ruleId === 'RC-04' && x.elementId === 'SCHEMA-a' && x.severity === 'warning')).toBe(true);
    expect(v.some((x) => x.ruleId === 'RC-03')).toBe(false); // resolution still fine
  });
});

// ── CR-212: cross-module import drift (RC-05) end-to-end ─────────────────────
describe('TEST-import-drift: extractImportEdges + RC-05 (CR-212)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'graphcode-drift-'));
    mkdirSync(join(dir, 'src', 'a'), { recursive: true });
    mkdirSync(join(dir, 'src', 'b'), { recursive: true });
    // src/a/x.ts imports src/b/y.ts (via .js specifier, NodeNext) and node_modules 'zod'.
    writeFileSync(join(dir, 'src', 'b', 'y.ts'), 'export const y = 1;\n');
    writeFileSync(join(dir, 'src', 'a', 'x.ts'), "import { y } from '../b/y.js';\nimport { z } from 'zod';\nexport const x = y + Number(!!z);\n");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const driftGraph = (documented: boolean) => ({
    nodes: [
      { uid: 'MOD-A', type: 'MOD', name: 'A', description: '', attributes: { path: 'src/a' } },
      { uid: 'MOD-B', type: 'MOD', name: 'B', description: '', attributes: { path: 'src/b' } },
      { uid: 'FUNC-a', type: 'FUNC', name: 'a', description: '', attributes: { realRef: { file: 'src/a/x.ts', symbol: 'x' } } },
      { uid: 'FUNC-b', type: 'FUNC', name: 'b', description: '', attributes: { realRef: { file: 'src/b/y.ts', symbol: 'y' } } },
      ...(documented ? [{ uid: 'FLOW-x', type: 'FLOW', name: 'f', description: '', attributes: {} }] : []),
    ],
    edges: [
      { sourceId: 'FUNC-a', targetId: 'MOD-A', edgeType: 'allocate', attributes: {} },
      { sourceId: 'FUNC-b', targetId: 'MOD-B', edgeType: 'allocate', attributes: {} },
      ...(documented
        ? [
            { sourceId: 'FUNC-b', targetId: 'FLOW-x', edgeType: 'io', attributes: {} },
            { sourceId: 'FLOW-x', targetId: 'FUNC-a', edgeType: 'io', attributes: {} },
          ]
        : []),
    ],
  });

  it('extractImportEdges resolves the .js→.ts relative import, skips node_modules', () => {
    const edges = extractImportEdges(dir);
    expect(edges).toContainEqual({ from: 'src/a/x.ts', to: 'src/b/y.ts' });
    expect(edges.some((e) => /node_modules|zod/.test(e.to))).toBe(false);
  });

  it('undocumented cross-MOD import → RC-05 warning with evidence', () => {
    const v = conformanceViolations({ getGraph: () => driftGraph(false), getRepoRoot: () => dir });
    const rc05 = v.filter((x) => x.ruleId === 'RC-05');
    expect(rc05).toHaveLength(1);
    expect(rc05[0].elementId).toBe('MOD-A');
    expect(rc05[0].message).toContain('src/a/x.ts → src/b/y.ts');
  });

  it('same import once the graph documents the MOD adjacency (io FLOW) → no RC-05', () => {
    const v = conformanceViolations({ getGraph: () => driftGraph(true), getRepoRoot: () => dir });
    expect(v.some((x) => x.ruleId === 'RC-05')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CR-SM-240 follow-through — why the canonical sort in `toOntologyGraph` stays.
// ---------------------------------------------------------------------------

describe('toOntologyGraph: the canonical order pins the VIOLATION SEQUENCE (CR-SM-240)', () => {
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, 'docs/graph/graphcode.graph.json'), 'utf8')) as {
    elements: Record<string, unknown>[];
    traces: { source: string; target: string; type: string }[];
  };

  const asGraph = (elements: Record<string, unknown>[], traces: typeof raw.traces) =>
    ({
      nodes: elements.map(elementToNode),
      edges: traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: {} })),
    }) as unknown as Parameters<typeof toOntologyGraph>[0];

  it('a permuted input yields the identical violation SEQUENCE, not just the same set', () => {
    // The sort's original justification — the ℝ⁶ metrics — is gone: that bug was in
    // @sigloch/se-optimizer and is fixed at the source in 0.5.0. What remains is
    // this: `rules_evaluate`, the readiness report and the audit record all emit the
    // stream in order, and the store guarantees no row order. Measured on the repo
    // graph: WITHOUT the sort the set stays identical and the sequence does not.
    // If this test ever becomes trivially true, the sort may go.
    const inOrder = evaluateAllRules(toOntologyGraph(asGraph(raw.elements, raw.traces)), DEFAULT_METRIC_POLICY);
    const reversed = evaluateAllRules(
      toOntologyGraph(asGraph([...raw.elements].reverse(), [...raw.traces].reverse())),
      DEFAULT_METRIC_POLICY,
    );
    const key = (v: { rule_id: string; element_id: string }) => `${v.rule_id}|${v.element_id}`;
    expect(inOrder.length).toBeGreaterThan(0);
    expect(reversed.map(key)).toEqual(inOrder.map(key));
  });
});
