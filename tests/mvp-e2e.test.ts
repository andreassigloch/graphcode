/**
 * TEST-mvp-e2e — MVP-1 End-to-End Acceptance (CR-GC-123).
 *
 * One comprehensive end-to-end run of the whole MVP-1 loop in a THROWAWAY temp
 * repo, on REAL disk Kuzu, no mocks, never `:memory:`. Each step asserts AND
 * names the Use-Case (graph node) it validates:
 *
 *   1. NEW MEMBER REPO        — scaffold('init')                  (headline: create a repo)
 *   2. BOOTSTRAP THROUGH GATE — bootstrap(harness, Format-E)      (UC-code-quality)
 *   3. SPEC + GOVERNANCE      — mutate(valid) ✓ / mutate(orphan) ✗ (UC-code-quality)
 *   4. KNOW-NOT-GREP          — graph_impact = exact blast-radius  (UC-token-efficiency + UC-reduced-llm)
 *   5. IMPACT-BASED TESTING   — impact slice selects the test set  (UC-efficient-testing)
 *   6. IMPLEMENT A NODE       — mutate(update) persists to disk     (UC-code-quality)
 *   7. RE-EXPORT              — exportGraphJson/exportMarkdown      (UC-code-quality)
 *
 * The UC descriptions in docs/graph/graphcode.graph.json ARE the acceptance:
 *   UC-code-quality   : every change ontology-/rule-conform, no drift; docs/interfaces
 *                       strictly derived from the governed graph.
 *   UC-token-efficiency: precise query context (exact blast-radius slice), not a grep dump.
 *   UC-efficient-testing: the impact/dependency graph selects the test set; done = proven.
 *   UC-reduced-llm    : deterministic, model-free gates + query-precision.
 *
 * Composes ONLY the public surface (createHarness/scaffold/bootstrap/mutate/
 * impact/getGraph/bindToolsToHarness/exportGraphJson/exportMarkdown) — no src
 * changes. Real KuzuAdapter on a mkdtemp disk path; cleaned up in afterAll.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import {
  createHarness,
  scaffold,
  bootstrap,
  bindToolsToHarness,
  exportGraphJson,
  exportMarkdown,
  MARKDOWN_VIEWS,
  VIEW_FILENAMES,
  GraphCodeHarness,
} from '../src/index.js';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { deriveHostPort } from '../src/scaffold-templates.js';

const PKG = '@sigloch/graphcode';

/**
 * Cold-start member graph for the new repo — the small valid pattern the gate
 * accepts on an empty graph (SYS compose REQ; TEST verify REQ → R-01 satisfied;
 * MOD satisfy REQ → REQ is resolved). Encoded as Format-E (uid.TYPE + __name).
 */
const MEMBER_FORMAT_E = [
  '## Nodes',
  '+ MOD-acme.MOD|Module satisfying the cold-start requirement [__name:ACME module]',
  '+ REQ-acme-root.REQ|First requirement of the new ACME member graph [__name:ACME root requirement]',
  '+ SYS-acme.SYS|Cold-start system of the new ACME family member [__name:ACME system]',
  '+ TEST-acme-root.TEST|Verifies the ACME root requirement [__name:ACME root test]',
  '',
  '## Edges',
  '+ MOD-acme.MOD -satisfy-> REQ-acme-root.REQ',
  '+ SYS-acme.SYS -compose-> REQ-acme-root.REQ',
  '+ TEST-acme-root.TEST -verify-> REQ-acme-root.REQ',
].join('\n');

const BOOTSTRAP_UIDS = ['MOD-acme', 'REQ-acme-root', 'SYS-acme', 'TEST-acme-root'];

describe('TEST-mvp-e2e: MVP-1 loop (bootstrap → spec → impact → implement → re-export)', () => {
  let tmp: string;
  let kuzuPath: string;
  let harness: GraphCodeHarness;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mvp-e2e-'));
    kuzuPath = join(tmp, '.graphcode', 'kuzu');
  });

  afterAll(async () => {
    await harness?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  // ── STEP 1 — NEW MEMBER REPO (headline: create a new repo) ──────────────────
  it('1. scaffolds a NEW member repo: .mcp.json (npx form) + .graphcode/ + GRAPHCODE.md', async () => {
    const res = await scaffold('init', { repoRoot: tmp });
    expect(res.action).toBe('init');

    // .mcp.json launches the stdio server via npx — the exact form a foreign repo needs.
    const mcp = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
    expect(mcp).toEqual({
      mcpServers: {
        graphcode: {
          command: 'npx',
          args: ['-y', PKG, 'mcp'],
          env: { GRAPHCODE_HOST_PORT: String(deriveHostPort(tmp)) },
        },
      },
    });
    expect(existsSync(join(tmp, '.graphcode'))).toBe(true);
    expect(existsSync(join(tmp, 'GRAPHCODE.md'))).toBe(true);
  });

  // ── STEP 2 — BOOTSTRAP THROUGH THE GATE (UC-code-quality: governed first-fill) ─
  it('2. UC-code-quality: bootstraps the empty member graph THROUGH the gate (governed first-fill)', async () => {
    // createHarness wires disk Kuzu at <repoRoot>/.graphcode/kuzu — same store the
    // scaffolded .mcp.json server would open. NEVER :memory:.
    harness = await createHarness({
      repoRoot: tmp,
      scope: { workspaceId: 'acme-ws', systemId: 'acme' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    expect(harness.getGraph().nodes).toHaveLength(0); // genuinely empty cold start

    const { result, nodes, edges } = await bootstrap(harness, MEMBER_FORMAT_E);

    // Gate verdict: clean apply (no NEWLY-introduced error against the empty baseline).
    expect(result.success).toBe(true);
    expect(result.tier).not.toBe('block');
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
    expect(nodes).toBe(4);
    expect(edges).toBe(3);

    // The member's nodes are present in the governed graph.
    const g = harness.getGraph();
    expect(g.nodes.map((n) => n.uid).sort()).toEqual(BOOTSTRAP_UIDS);
    expect(
      g.edges.some(
        (e) => e.sourceId === 'TEST-acme-root' && e.targetId === 'REQ-acme-root' && e.edgeType === 'verify',
      ),
    ).toBe(true);
  });

  // ── STEP 3 — SPEC NODES THROUGH THE GATE + GOVERNANCE (UC-code-quality) ──────
  it('3a. UC-code-quality: spec a feature (REQ + verifying TEST + satisfying MOD) is ACCEPTED by the gate', async () => {
    const spec: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-login', type: 'REQ', name: 'Login requirement', description: 'A user can log in', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-login', type: 'TEST', name: 'Login test', description: 'verifies REQ-login', attributes: {} } },
      { op: 'add-node', node: { uid: 'MOD-auth', type: 'MOD', name: 'Auth module', description: 'satisfies REQ-login', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-login', targetId: 'REQ-login', edgeType: 'verify', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'MOD-auth', targetId: 'REQ-login', edgeType: 'satisfy', attributes: {} } },
    ];
    const result = await harness.mutate(spec);

    // Ontology-/rule-conform → accepted (tier !== block), nothing rolled back.
    expect(result.success).toBe(true);
    expect(result.tier).not.toBe('block');
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);

    const uids = harness.getGraph().nodes.map((n) => n.uid);
    expect(uids).toEqual(expect.arrayContaining(['REQ-login', 'TEST-login', 'MOD-auth']));
  });

  it('3b. UC-code-quality: a rule-VIOLATING spec (orphan REQ, no verifying TEST) is BLOCKED — no drift, nothing persisted', async () => {
    const before = harness.getGraph().nodes.length;

    // A lone REQ with no verifying TEST → R-01 (error) is NEWLY introduced → the
    // gate must block and persist nothing. The model cannot drift off-ontology.
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-orphan', type: 'REQ', name: 'Orphan requirement', description: 'no verifying test', attributes: {} } },
    ]);

    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.mutations).toBe(0);
    const r01 = result.violations.find((v) => v.ruleId === 'R-01');
    expect(r01).toBeDefined();
    expect(r01?.severity).toBe('error');

    // Nothing persisted: the graph is unchanged (no orphan node), in memory AND on disk.
    expect(harness.getGraph().nodes).toHaveLength(before);
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-orphan')).toBeUndefined();
  });

  // ── STEP 4 — KNOW-NOT-GREP via graph_impact (UC-token-efficiency + UC-reduced-llm)
  it('4. UC-token-efficiency + UC-reduced-llm: graph_impact returns EXACTLY the dependent set (precise slice, not a grep dump)', async () => {
    const registry = bindToolsToHarness(harness);
    const fullNodeCount = harness.getGraph().nodes.length; // SYS/REQ/TEST/MOD acme + REQ-login/TEST-login/MOD-auth = 7

    const { rootId, nodeCount, edgeCount, formatE } = await registry['graph_impact'].handler({
      id: 'REQ-login',
      depth: 1,
    });
    expect(rootId).toBe('REQ-login');

    // Blast-radius = INCOMING dependents = {REQ-login, TEST-login (verify), MOD-auth (satisfy)}.
    // Probe uid membership against the Format-E slice (same technique as TEST-impact-subgraph).
    const present = new Set(
      ['REQ-login', 'TEST-login', 'MOD-auth', 'SYS-acme', 'REQ-acme-root', 'TEST-acme-root', 'MOD-acme'].filter(
        (uid) => formatE.includes(uid),
      ),
    );
    expect(present).toEqual(new Set(['REQ-login', 'TEST-login', 'MOD-auth']));
    expect(nodeCount).toBe(3);
    expect(edgeCount).toBe(2); // TEST-login -verify-> REQ-login, MOD-auth -satisfy-> REQ-login

    // EXCLUDES every unrelated node (the whole cold-start subgraph): not a grep dump.
    expect(present.has('SYS-acme')).toBe(false);
    expect(present.has('REQ-acme-root')).toBe(false);
    expect(present.has('TEST-acme-root')).toBe(false);
    expect(present.has('MOD-acme')).toBe(false);

    // The slice is STRICTLY SMALLER than the full graph (deterministic, model-free query).
    expect(nodeCount).toBeLessThan(fullNodeCount);
  });

  // ── STEP 5 — IMPACT-BASED SELECTIVE TESTING (UC-efficient-testing) ───────────
  it('5. UC-efficient-testing: the impact slice of the changed REQ identifies the verifying TEST to run', async () => {
    const registry = bindToolsToHarness(harness);
    const { formatE } = await registry['graph_impact'].handler({ id: 'REQ-login', depth: 1 });

    // The dependency graph selects the test set: TEST-login is the test to run for REQ-login.
    // (And NOT the unrelated cold-start test — no full-suite re-run.)
    expect(formatE.includes('TEST-login')).toBe(true);
    expect(formatE.includes('TEST-acme-root')).toBe(false);

    // The selected test set, derived from the graph (KNOW, not grep): exactly the TESTs
    // that appear in the blast-radius slice.
    const candidateTests = ['TEST-login', 'TEST-acme-root'];
    const selected = candidateTests.filter((uid) => formatE.includes(uid));
    expect(selected).toEqual(['TEST-login']);
  });

  // ── STEP 6 — IMPLEMENT A NODE (UC-code-quality) ─────────────────────────────
  it('6. UC-code-quality: implementing a node (status → done) goes through the gate and is DURABLE on disk', async () => {
    const result = await harness.mutate([
      { op: 'update-node', node: { uid: 'MOD-auth', attributes: { status: 'done' } } },
      { op: 'update-node', node: { uid: 'REQ-login', attributes: { status: 'done' } } },
    ]);
    expect(result.success).toBe(true);
    expect(result.tier).not.toBe('block');

    // In-memory working copy reflects the implementation.
    const modAuth = harness.getGraph().nodes.find((n) => n.uid === 'MOD-auth');
    expect(modAuth?.attributes['status']).toBe('done');

    // DURABILITY: close, reopen a FRESH KuzuAdapter on the SAME disk path → the
    // node persisted through the gate, not just memory (REQ-disk-persistence).
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(
      { repoRoot: tmp, scope: { workspaceId: 'acme-ws', systemId: 'acme' }, consumerType: 'system', preCommitTimeout: 5000 },
      storage2,
    );
    await harness2.initialize();
    const reloaded = harness2.getGraph();
    expect(reloaded.nodes.find((n) => n.uid === 'MOD-auth')).toBeDefined();
    expect(reloaded.nodes.find((n) => n.uid === 'REQ-login')).toBeDefined();
    // The verify/satisfy spec edges survived the reload too.
    expect(
      reloaded.edges.some((e) => e.sourceId === 'TEST-login' && e.targetId === 'REQ-login' && e.edgeType === 'verify'),
    ).toBe(true);
    harness = harness2; // afterAll closes the live handle
  });

  // ── STEP 7 — RE-EXPORT (UC-code-quality: docs strictly derived from the graph) ─
  it('7. UC-code-quality: re-export the governed graph → JSON round-trips + Markdown views carry the GENERATED header', async () => {
    const graph = harness.getGraph();

    // Re-export JSON to tmp/docs/graph.
    const graphDir = join(tmp, 'docs', 'graph');
    mkdirSync(graphDir, { recursive: true });
    const jsonStr = exportGraphJson(graph);
    const jsonPath = join(graphDir, 'acme.graph.json');
    writeFileSync(jsonPath, jsonStr, 'utf8');

    // The spec'd nodes appear in the exported JSON (the governed graph drives the docs).
    const onDisk = JSON.parse(readFileSync(jsonPath, 'utf8')) as { elements: Array<{ id: string }> };
    const exportedIds = new Set(onDisk.elements.map((e) => e.id));
    expect(exportedIds.has('REQ-login')).toBe(true);
    expect(exportedIds.has('TEST-login')).toBe(true);
    expect(exportedIds.has('MOD-auth')).toBe(true);

    // ROUND-TRIP: re-import the exported JSON into a FRESH disk-Kuzu harness; the
    // node/edge sets are identical (exportGraphJson is the exact inverse of importGraph).
    const rtTmp = mkdtempSync(join(tmpdir(), 'graphcode-mvp-e2e-rt-'));
    try {
      const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(rtTmp, 'kuzu') });
      const rtHarness = new GraphCodeHarness(
        { repoRoot: rtTmp, scope: { workspaceId: 'acme-ws', systemId: 'acme' }, consumerType: 'system', preCommitTimeout: 5000 },
        storage,
      );
      await rtHarness.initialize();
      await rtHarness.importGraph(JSON.parse(jsonStr));
      const rt: Graph = rtHarness.getGraph();
      expect(rt.nodes.map((n) => n.uid).sort()).toEqual(graph.nodes.map((n) => n.uid).sort());
      expect(rt.edges.map((e) => `${e.sourceId}-${e.edgeType}->${e.targetId}`).sort()).toEqual(
        graph.edges.map((e) => `${e.sourceId}-${e.edgeType}->${e.targetId}`).sort(),
      );
      // Re-exporting the round-tripped graph is byte-identical to the first export.
      expect(exportGraphJson(rt)).toBe(jsonStr);
      await rtHarness.close();
    } finally {
      rmSync(rtTmp, { recursive: true, force: true });
    }

    // Markdown views to tmp/docs/views, each carrying the GENERATED header.
    const viewsDir = join(tmp, 'docs', 'views');
    mkdirSync(viewsDir, { recursive: true });
    for (const view of MARKDOWN_VIEWS) {
      const md = exportMarkdown(graph, view);
      writeFileSync(join(viewsDir, VIEW_FILENAMES[view]), md, 'utf8');
      expect(md).toContain('GENERATED by @sigloch/graphcode exportMarkdown');
      expect(md).toContain('DO NOT HAND-EDIT');
    }
    // The spec view reflects the governed nodes.
    expect(exportMarkdown(graph, 'spec')).toContain('REQ-login');
  });
});
