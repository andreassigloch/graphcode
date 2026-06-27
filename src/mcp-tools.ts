/**
 * mcp-tools.ts — MCP Tool Registry for graphcode (MOD-mcp-tools).
 *
 * Realizes:
 *   - REQ-mcp-tool-registry    : read/write/rules/audit/query tools
 *   - REQ-mcp-gate-symmetry    : graph_mutate delegates to harness.mutate() — identical semantics (L2)
 *   - REQ-query-precision      : graph_impact returns exact blast-radius as Format-E slice, no full dump
 *   - REQ-subgraph-slicing     : sub-graph slice is the context primitive
 *   - REQ-progressive-expansion: graph_expand deepens via in-memory re-traversal (no originals store)
 *   - REQ-audit-trail          : audit_trail / audit_stats over InMemoryAuditLog
 *   - REQ-single-transport     : NO HTTP server added — stdio transport wiring is the MCP host's job.
 *
 * Usage: const registry = bindToolsToHarness(harness, auditLog);
 *        // Then hand the registry to your MCP stdio server (out of scope here).
 *
 * @author andreas@siglochconsulting
 */

import { join, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { z } from 'zod/v4';
import type { ZodType } from 'zod/v4';
import type { GraphCodeHarness } from './harness.js';
import type { Graph, GraphNode, GraphEdge, AuditLog, AuditEntry } from '@sigloch/graph-api-core';
import { FormatECodec, SE_DESCRIPTOR, InMemoryAuditLog } from '@sigloch/graph-api-core';
import { type MutateCommand, type MutateResult, type RuleViolation } from '@sigloch/contracts/harness';
import { TestRefSchema, type TestRef } from '@sigloch/contracts/se';
import { exportGraphJson, exportMarkdown, renderTestStubs, MarkdownViewSchema, MARKDOWN_VIEWS, VIEW_FILENAMES } from './exporter.js';
import { clearExportPending } from './export-marker.js';
import { scoreReadiness, summarizeReadiness, type ReadinessReport } from './readiness.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MCPToolRegistry = Record<string, MCPTool<any, any>>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const GraphElementsInputSchema = z.object({
  type: z.string().optional().describe('Filter by node type (e.g. REQ, TEST, MOD)'),
  search: z.string().optional().describe('Substring search against uid, name, description'),
  limit: z.number().int().positive().default(100),
});

const GraphGetNodeInputSchema = z.object({
  uid: z.string().describe('Node uid'),
});

const GraphGetEdgesInputSchema = z.object({
  uid: z.string().optional().describe('Filter edges incident to this node'),
  edgeType: z.string().optional().describe('Filter by edge type'),
  direction: z.enum(['in', 'out', 'both']).default('both'),
});

const GraphMutateInputSchema = z.object({
  // commands is validated by harness.mutate() via MutateCommandSchema internally.
  // We accept any array here to avoid cross-Zod-version schema composition issues (D1).
  commands: z.array(z.unknown()).min(1),
  consumerId: z.string().default('mcp-client'),
});

const RulesEvaluateInputSchema = z.looseObject({});

const RulesGetViolationsInputSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']).optional(),
});

const AuditTrailInputSchema = z.object({
  consumerId: z.string().optional(),
  since: z.string().optional().describe('ISO 8601 timestamp lower bound'),
  limit: z.number().int().positive().default(50),
});

const AuditStatsInputSchema = z.looseObject({});

const GraphImpactInputSchema = z.object({
  id: z.string().describe('Root node uid to compute blast-radius from'),
  depth: z.number().int().nonnegative().default(1).describe('Traversal depth; 1 = direct neighbors'),
});

const GraphExpandInputSchema = z.object({
  handle: z.string().describe('Node uid returned by a previous graph_impact or graph_expand call'),
  branch: z.enum(['callers', 'traces', 'tests', 'all']).default('all'),
  depth: z.number().int().positive().default(2).describe('Depth for this expansion (usually prior_depth + 1)'),
});

const GraphContextInputSchema = z.object({
  id: z.string().describe('Realization node uid (e.g. a FUNC) to build the definition-of-done context-pack for'),
  depth: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe('Spec-closure ring radius; 1 = direct satisfy/io/allocate neighbours + verify back-edge'),
});

const GraphExportInputSchema = z.object({
  name: z.string().optional().describe('Base filename for the graph JSON (default: scope.systemId)'),
  views: z.array(MarkdownViewSchema).optional().describe('Markdown views to render (default: all)'),
  force: z
    .boolean()
    .default(false)
    .describe(
      'Override the refuse-to-clobber guard. By default the export ABORTS if it would delete ' +
        'elements/traces present in the committed SSOT JSON but missing from the live graph (stale ' +
        'process / parallel writer). Set true only for intentional deletions.',
    ),
});

const GraphReadinessInputSchema = z.object({
  detail: z
    .boolean()
    .default(false)
    .describe(
      'false (default) = summary: scores + counts + violationsByRule only (stays within the MCP ' +
        'result limit on a fully-red graph). true = full raw violations + each gate’s blocking/open lists.',
    ),
});

const GraphTestsInputSchema = z.object({
  changeSet: z
    .array(z.string())
    .min(1)
    .describe('Changed node uids (e.g. git-diff → graph). The roots of the blast-radius.'),
  depth: z
    .number()
    .int()
    .nonnegative()
    .default(1)
    .describe('Impact traversal depth per changed node (same semantics as graph_impact).'),
});

// ---------------------------------------------------------------------------
// Branch → edge-type filter for graph_expand. trace/test branches keep the full
// Kuzu neighbourhood but prune to the relevant edge types (and the nodes those
// edges touch). callers/all are pure-direction and need no edge filtering.
// ---------------------------------------------------------------------------

const TRACE_EDGE_TYPES = new Set(['trace', 'traces', 'TRACE']);
const TEST_EDGE_TYPES = new Set(['verify', 'test', 'VERIFY', 'TEST']);

/** Keep only edges of the given types and the nodes incident to them (root always kept). */
function filterByEdgeTypes(graph: Graph, rootId: string, types: Set<string>): Graph {
  const edges: GraphEdge[] = graph.edges.filter((e) => types.has(e.edgeType));
  const keep = new Set<string>([rootId]);
  for (const e of edges) {
    keep.add(e.sourceId);
    keep.add(e.targetId);
  }
  const nodes: GraphNode[] = graph.nodes.filter((n) => keep.has(n.uid));
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// graph_context — UPSTREAM spec-closure ("definition of done") for one node.
// Pure composition over the in-memory graph (no Kuzu traversal): self + the
// REQ/UC it satisfies + the TEST that verify those REQ + the FLOW it exchanges
// (io) + the MOD it is allocated to + the SCHEMA of those FLOW (relation).
// Complements graph_impact (DOWNSTREAM blast-radius) — opposite direction.
// ---------------------------------------------------------------------------

const SATISFY_EDGE = 'satisfy';
const VERIFY_EDGE = 'verify';
const IO_EDGE = 'io';
const ALLOCATE_EDGE = 'allocate';
const DATA_RELATION_EDGE = 'relation';

function buildContextSlice(
  graph: Graph,
  rootId: string,
  depth: number,
): { slice: Graph; missingRefs: string[] } {
  const root = graph.nodes.find((n) => n.uid === rootId);
  if (!root) throw new Error(`graph_context: node '${rootId}' not found`);

  const keepNodes = new Set<string>([rootId]);
  const seenEdges = new Set<string>();
  const keepEdges: GraphEdge[] = [];
  const ekey = (e: GraphEdge) => `${e.sourceId}>${e.edgeType}>${e.targetId}`;
  const addEdge = (e: GraphEdge) => {
    if (seenEdges.has(ekey(e))) return;
    seenEdges.add(ekey(e));
    keepEdges.push(e);
    keepNodes.add(e.sourceId);
    keepNodes.add(e.targetId);
  };

  // `depth` outgoing rings of satisfy/io/allocate (io may also feed INTO the node).
  let frontier = new Set<string>([rootId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const e of graph.edges) {
      const out = e.edgeType === SATISFY_EDGE || e.edgeType === IO_EDGE || e.edgeType === ALLOCATE_EDGE;
      if (frontier.has(e.sourceId) && out) {
        addEdge(e);
        next.add(e.targetId);
      }
      if (frontier.has(e.targetId) && e.edgeType === IO_EDGE) {
        addEdge(e);
        next.add(e.sourceId);
      }
    }
    frontier = next;
  }
  // verify back-edges: every TEST that verifies a REQ already in the slice.
  for (const e of graph.edges) {
    if (e.edgeType === VERIFY_EDGE && keepNodes.has(e.targetId)) addEdge(e);
  }
  // data contract: relation edges from a kept FLOW to its SCHEMA.
  for (const e of graph.edges) {
    if (e.edgeType === DATA_RELATION_EDGE && keepNodes.has(e.sourceId)) addEdge(e);
  }

  const nodes = graph.nodes.filter((n) => keepNodes.has(n.uid));
  // codeRef gap signal — a FUNC in the slice with no pointer to implement from (CR-GC-213).
  // A "reference implementation" is NOT a separate concept: it is just a codeRef (pointing at a
  // stub/spike). If that impl is only functionally-close, the agent reads it and fixes it.
  const missingRefs = nodes
    .filter((n) => n.type === 'FUNC' && !n.attributes.codeRef)
    .map((n) => n.uid);

  return { slice: { nodes, edges: keepEdges }, missingRefs };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Bind all MCP tools to a live `GraphCodeHarness` instance.
 * Optionally pass an existing `AuditLog`; defaults to a fresh `InMemoryAuditLog`.
 *
 * Returns an `MCPToolRegistry` — a named map of tools that a MCP stdio host can
 * enumerate and dispatch. The stdio server itself is the host's concern (single-
 * transport constraint: no HTTP added here).
 */
export function bindToolsToHarness(
  harness: GraphCodeHarness,
  auditLog: AuditLog = new InMemoryAuditLog(),
): MCPToolRegistry {
  const codec = new FormatECodec(SE_DESCRIPTOR);
  let _graphVersion = 0;

  // Helper to record an audit entry after a mutation
  async function recordAudit(
    consumerId: string,
    result: MutateResult,
  ): Promise<void> {
    _graphVersion += 1;
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      consumerId,
      consumerType: 'agent',
      operation: 'mutate',
      result: result.success ? 'applied' : 'rejected',
      violations: result.violations as import('@sigloch/graph-api-core').RuleViolation[],
      graphVersion: _graphVersion,
    };
    await auditLog.record(entry);
  }

  // ---------------------------------------------------------------------------
  // READ tools
  // ---------------------------------------------------------------------------

  const graph_elements: MCPTool<z.infer<typeof GraphElementsInputSchema>, { nodes: GraphNode[]; total: number }> = {
    name: 'graph_elements',
    description: 'List graph elements (nodes) with optional type/search filter. Returns a slice, not a full dump.',
    inputSchema: GraphElementsInputSchema,
    async handler(input) {
      // Cypher-backed listing via the Kuzu store (KNOW, not grep over the mirror).
      const nodes = await harness.listElements({ type: input.type, search: input.search });
      const total = nodes.length;
      return { nodes: nodes.slice(0, input.limit), total };
    },
  };

  const graph_get_node: MCPTool<z.infer<typeof GraphGetNodeInputSchema>, { node: GraphNode | null }> = {
    name: 'graph_get_node',
    description: 'Get a single graph node by uid.',
    inputSchema: GraphGetNodeInputSchema,
    async handler(input) {
      const node = harness.getGraph().nodes.find((n) => n.uid === input.uid) ?? null;
      return { node };
    },
  };

  const graph_get_edges: MCPTool<z.infer<typeof GraphGetEdgesInputSchema>, { edges: GraphEdge[]; total: number }> = {
    name: 'graph_get_edges',
    description: 'Get edges, optionally filtered by incident node uid, edge type, or direction.',
    inputSchema: GraphGetEdgesInputSchema,
    async handler(input) {
      let edges = harness.getGraph().edges;
      if (input.uid) {
        const uid = input.uid;
        const dir = input.direction;
        edges = edges.filter((e) => {
          if (dir === 'out') return e.sourceId === uid;
          if (dir === 'in') return e.targetId === uid;
          return e.sourceId === uid || e.targetId === uid;
        });
      }
      if (input.edgeType) {
        const et = input.edgeType;
        edges = edges.filter((e) => e.edgeType === et);
      }
      return { edges, total: edges.length };
    },
  };

  // ---------------------------------------------------------------------------
  // WRITE tool — gate symmetry (L2): delegates to harness.mutate(), no bypass
  // ---------------------------------------------------------------------------

  const graph_mutate: MCPTool<z.infer<typeof GraphMutateInputSchema>, MutateResult> = {
    name: 'graph_mutate',
    description:
      'Apply a batch of graph mutations through the Apply-Gate (L2). ' +
      'Every write goes through harness.mutate() — identical semantics to in-process calls. ' +
      'No direct Kuzu access; blocked by rules identical to any in-process mutation.',
    inputSchema: GraphMutateInputSchema,
    async handler(input) {
      // L2: identical semantics — delegate straight to the gate, no bypass.
      // Cast: MCP transports deserialize commands as plain objects; harness.mutate()
      // validates internally via MutateCommandSchema.
      const result = await harness.mutate(input.commands as MutateCommand[]);
      await recordAudit(input.consumerId, result);
      return result;
    },
  };

  // ---------------------------------------------------------------------------
  // RULES tools
  // ---------------------------------------------------------------------------

  const rules_evaluate: MCPTool<z.infer<typeof RulesEvaluateInputSchema>, { violations: RuleViolation[] }> = {
    name: 'rules_evaluate',
    description: 'Evaluate V3_RULES against the current in-memory graph. Read-only; does not mutate.',
    inputSchema: RulesEvaluateInputSchema,
    async handler(_input) {
      return { violations: harness.evaluateRules() };
    },
  };

  const rules_get_violations: MCPTool<
    z.infer<typeof RulesGetViolationsInputSchema>,
    { violations: RuleViolation[]; total: number }
  > = {
    name: 'rules_get_violations',
    description:
      'Return current rule violations, optionally filtered by severity. Each violation carries ' +
      'fixHint + context (candidate_targets, existing_traces) from the contracts rule (CR-GC-203 ' +
      'item 1), so an agent can resolve R-01/RD-01 from the payload — no extra queries to find ' +
      'a TEST/FUNC to link.',
    inputSchema: RulesGetViolationsInputSchema,
    async handler(input) {
      let violations = harness.evaluateRules();
      if (input.severity) violations = violations.filter((v) => v.severity === input.severity);
      return { violations, total: violations.length };
    },
  };

  // ---------------------------------------------------------------------------
  // AUDIT tools
  // ---------------------------------------------------------------------------

  const audit_trail: MCPTool<z.infer<typeof AuditTrailInputSchema>, { entries: AuditEntry[] }> = {
    name: 'audit_trail',
    description: 'Return mutation history entries from the audit log.',
    inputSchema: AuditTrailInputSchema,
    async handler(input) {
      const entries = await auditLog.query({
        consumerId: input.consumerId,
        since: input.since,
        limit: input.limit,
      });
      return { entries };
    },
  };

  const audit_stats: MCPTool<
    z.infer<typeof AuditStatsInputSchema>,
    { totalEntries: number; applied: number; rejected: number; graphVersion: number }
  > = {
    name: 'audit_stats',
    description: 'Aggregate stats from the audit log: counts of applied vs. rejected mutations.',
    inputSchema: AuditStatsInputSchema,
    async handler(_input) {
      const all = await auditLog.query({});
      const applied = all.filter((e) => e.result === 'applied').length;
      const rejected = all.filter((e) => e.result === 'rejected').length;
      return { totalEntries: all.length, applied, rejected, graphVersion: _graphVersion };
    },
  };

  // ---------------------------------------------------------------------------
  // QUERY-PRECISION tools (R6/R12/R7/R13)
  // ---------------------------------------------------------------------------

  const graph_impact: MCPTool<
    z.infer<typeof GraphImpactInputSchema>,
    { formatE: string; nodeCount: number; edgeCount: number; rootId: string }
  > = {
    name: 'graph_impact',
    description:
      'Compute the exact blast-radius (FUNC-graph-impact / R6 / R12) via Kuzu Cypher: ' +
      'returns the root node + its DEPENDENTS (incoming edges — callers/traces/tests that ' +
      'point INTO root) within `depth` hops as a Format-E slice. Never the full graph (anti-grep).',
    inputSchema: GraphImpactInputSchema,
    async handler(input) {
      // Blast-radius = dependents = INCOMING edges, computed in Kuzu (not TS-BFS).
      const subgraph = await harness.impact(input.id, input.depth);
      const formatE = codec.serialize(subgraph);
      return {
        rootId: input.id,
        nodeCount: subgraph.nodes.length,
        edgeCount: subgraph.edges.length,
        formatE,
      };
    },
  };

  const graph_expand: MCPTool<
    z.infer<typeof GraphExpandInputSchema>,
    { formatE: string; nodeCount: number; edgeCount: number; handle: string }
  > = {
    name: 'graph_expand',
    description:
      'Progressively deepen one branch on demand via Kuzu Cypher re-traversal (FUNC-graph-expand / R13). ' +
      'Pass the node uid as `handle`, the branch (callers=incoming dependents, traces, tests, all=both ' +
      'directions), and the new depth. No originals store — recomputed from the live Kuzu store.',
    inputSchema: GraphExpandInputSchema,
    async handler(input) {
      // callers = incoming dependents; all/traces/tests = full neighbourhood (both),
      // with traces/tests pruned to the relevant edge types afterwards.
      const direction = input.branch === 'callers' ? 'in' : 'both';
      let subgraph = await harness.subgraph(input.handle, input.depth, direction);
      if (input.branch === 'traces') subgraph = filterByEdgeTypes(subgraph, input.handle, TRACE_EDGE_TYPES);
      else if (input.branch === 'tests') subgraph = filterByEdgeTypes(subgraph, input.handle, TEST_EDGE_TYPES);
      const formatE = codec.serialize(subgraph);
      return {
        handle: input.handle,
        nodeCount: subgraph.nodes.length,
        edgeCount: subgraph.edges.length,
        formatE,
      };
    },
  };

  const graph_context: MCPTool<
    z.infer<typeof GraphContextInputSchema>,
    { formatE: string; nodeCount: number; edgeCount: number; rootId: string; missingRefs: string[] }
  > = {
    name: 'graph_context',
    description:
      'Definition-of-Done context-pack for ONE realization node (CR-GC-213). Returns the node + its ' +
      'UPSTREAM spec-closure — the REQ/UC it `satisfy`s, the TEST that `verify` those REQ, the FLOW it ' +
      'exchanges via `io`, the MOD it is `allocate`d to, and the SCHEMA of those FLOW — plus the node’s ' +
      'description prose and codeRef/testRef attributes, as one Format-E slice. ' +
      'Use this to IMPLEMENT a node (one call instead of get_node+impact+expand+get_edges). ' +
      'Contrast: graph_impact = DOWNSTREAM blast-radius (who breaks if I change this); graph_expand = ' +
      'manual branch deepening. Never a full dump. `missingRefs` flags FUNCs lacking a codeRef.',
    inputSchema: GraphContextInputSchema,
    async handler(input) {
      const { slice, missingRefs } = buildContextSlice(harness.getGraph(), input.id, input.depth);
      const formatE = codec.serialize(slice);
      return {
        rootId: input.id,
        nodeCount: slice.nodes.length,
        edgeCount: slice.edges.length,
        missingRefs,
        formatE,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // EXPORT tool — the agent-facing re-export sync path (CR-GC-113 over MCP).
  // Serializes the LIVE in-memory graph (full fidelity) — the only place that
  // holds it across the session — to commit-able docs under the repo root.
  // ---------------------------------------------------------------------------

  const graph_export: MCPTool<
    z.infer<typeof GraphExportInputSchema>,
    {
      graphJson: { path: string; bytes: number; nodes: number; edges: number };
      views: Array<{ view: string; path: string; bytes: number }>;
      stubs: string[];
    }
  > = {
    name: 'graph_export',
    description:
      'Re-export the live governed graph to commit-able docs — the single sync path (CR-GC-113). ' +
      'Writes canonical docs/graph/<name>.graph.json plus deterministic docs/views/*.md (GENERATED header) ' +
      'under the repo root, from the live in-memory graph (full fidelity). Closes the agent loop: ' +
      'spec → impact → implement → export. REFUSES to clobber: aborts if the live graph is empty, or if ' +
      'the write would drop elements/traces present in the committed SSOT (stale process / parallel ' +
      'writer) unless force:true. Also MATERIALIZES a runnable `it.todo` stub for any bound TEST whose ' +
      'testRef file is absent (CR-GC-205 Item 4) — so graph_tests never resolves a phantom path; existing ' +
      'files are never overwritten. Returns the written paths, byte sizes, and the scaffolded stub files.',
    inputSchema: GraphExportInputSchema,
    async handler(input) {
      const graph = harness.getGraph();
      const repoRoot = harness.getRepoRoot();
      const name = input.name ?? harness.getScope().systemId;

      const json = exportGraphJson(graph);
      const jsonRel = join('docs', 'graph', `${name}.graph.json`);
      const jsonAbs = join(repoRoot, jsonRel);

      // Refuse-to-clobber (parallels scripts/export-graph.mjs guards): a stale
      // long-running server or a parallel writer can hold a graph that is BEHIND
      // the committed SSOT. Blindly overwriting then silently DROPS committed
      // elements/traces (observed: a stale export deleted CR-GC-133). Guard 1:
      // never write an empty graph over a populated SSOT. Guard 2: abort if the
      // export would remove anything the committed file still has, unless `force`.
      if (graph.nodes.length === 0) {
        throw new Error(
          `graph_export refused: live graph has 0 elements — refusing to overwrite ${jsonRel} with an empty graph.`,
        );
      }
      if (!input.force && existsSync(jsonAbs)) {
        const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
          elements?: Array<{ id: string }>;
          traces?: Array<{ source: string; target: string; type: string }>;
        };
        const liveNodeIds = new Set(graph.nodes.map((n) => n.uid));
        const liveEdgeKeys = new Set(graph.edges.map((e) => `${e.sourceId}>${e.edgeType}>${e.targetId}`));
        const droppedNodes = (committed.elements ?? []).map((e) => e.id).filter((id) => !liveNodeIds.has(id));
        const droppedEdges = (committed.traces ?? [])
          .map((t) => `${t.source}>${t.type}>${t.target}`)
          .filter((k) => !liveEdgeKeys.has(k));
        if (droppedNodes.length || droppedEdges.length) {
          throw new Error(
            `graph_export refused: would delete ${droppedNodes.length} element(s) + ${droppedEdges.length} trace(s) ` +
              `present in committed ${jsonRel} but missing from the live graph — likely a stale process or a ` +
              `parallel sync. Re-seed the live graph from the committed SSOT first, or pass force:true for an ` +
              `intentional deletion. Dropped elements: ${droppedNodes.slice(0, 10).join(', ')}` +
              `${droppedNodes.length > 10 ? ` …(+${droppedNodes.length - 10})` : ''}.`,
          );
        }
      }

      mkdirSync(dirname(jsonAbs), { recursive: true });
      writeFileSync(jsonAbs, json);

      const views = input.views ?? MARKDOWN_VIEWS;
      const written = views.map((v) => {
        const md = exportMarkdown(graph, v);
        const rel = join('docs', 'views', VIEW_FILENAMES[v]);
        const abs = join(repoRoot, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, md);
        return { view: v, path: rel, bytes: Buffer.byteLength(md) };
      });

      // Test-stub materialization (CR-GC-205 Item 4): scaffold an `it.todo` for any
      // bound TEST whose testRef file is ABSENT, so graph_tests never resolves a
      // phantom path. Existence-checked — NEVER overwrites a real test file.
      const stubs: string[] = [];
      for (const stub of renderTestStubs(graph)) {
        const abs = join(repoRoot, stub.file);
        if (existsSync(abs)) continue;
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, stub.content);
        stubs.push(stub.file);
      }

      // CR-GC-217: the committed snapshot now equals the live model — clear the
      // drift marker the gate left on the last mutate() so the pre-commit freshness
      // guard lets the commit through. Only reached after the writes above succeed
      // (a refused export throws before here, leaving the marker set, by design).
      clearExportPending(repoRoot);

      return {
        graphJson: { path: jsonRel, bytes: Buffer.byteLength(json), nodes: graph.nodes.length, edges: graph.edges.length },
        views: written,
        stubs,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // READINESS tool — exposes the family compliance score (CR-GC-107 / MOD-readiness)
  // over the agent surface. se-review / se-status read it instead of the retired
  // GET /api/graph/readiness. Delegates to scoreReadiness(harness) → evaluateRules()
  // (L2 gate) so the score is driven by contracts V3_RULES (R-/RD-), never foreign BQ-*.
  // ---------------------------------------------------------------------------

  const graph_readiness: MCPTool<z.infer<typeof GraphReadinessInputSchema>, ReadinessReport> = {
    name: 'graph_readiness',
    description:
      'Score family readiness of the live governed graph (FUNC-score-readiness / CR-GC-107 + CR-GC-125). ' +
      'Returns the ReadinessReport: compliance dimension (fraction of elements with no error-severity ' +
      'violation); incoseScope (graphcode = lean); phaseGates SRR/PDR/CDR/TRR (INCOSE technical reviews, ' +
      'a disjoint partition of the element-level V3_RULES); implGates SAR/FCA/SVR/FRR (milestone tiers ' +
      'MS-1..4, ready iff assigned CRs are done + scope error-clean); violationsByRule (keyed by contracts ' +
      'rule-ID — R-/RD-/MS-, never BQ-*); and computedAt. By DEFAULT returns a summary (no raw ' +
      'violations, no per-gate blocking/open lists) so it stays within the MCP result limit even on a ' +
      'fully-red graph; pass detail:true for the full lists. Read-only; derived ' +
      'from harness.evaluateRules() (L2 gate) + the MS nodes + element status.',
    inputSchema: GraphReadinessInputSchema,
    async handler(input) {
      const report = scoreReadiness(harness);
      return input.detail ? report : summarizeReadiness(report);
    },
  };

  // ---------------------------------------------------------------------------
  // TEST-DEDUCTION tool — selective test set (CR-GC-134 + CR-GC-204 / FUNC-deduce-tests
  // + FUNC-resolve-tests-from-code). Resolves the impacted TEST nodes via the SINGLE
  // harness.testImpact() traversal (one getSubgraph primitive, no parallel blast-radius):
  // a CODE changeset (MOD/FUNC) is walked DIRECTIONALLY `node →satisfy/allocate→ REQ
  // →verify→ TEST`, a REQ changeset degenerates to its verify-dependents. Each impacted
  // TEST is resolved via its `testRef` runnable binding to a concrete file; the emitted
  // command runs ONLY those affected test files — never the full suite. TESTs without a
  // testRef (concept-only, marked `testRef:null`) surface under `unresolved`, never lost.
  //
  // git-diff → node: the changeSet is graph node uids, not paths. The agent maps a
  // changed source file to its node by the repo's MOD/FUNC naming convention
  // (`src/codec.ts` → `MOD-codec`, a function → its `FUNC-*`); `graph_elements({search})`
  // looks the uid up when the convention is ambiguous. graph_tests stays path-agnostic so
  // the same deduction works for any consumer regardless of its file layout.
  // ---------------------------------------------------------------------------

  const graph_tests: MCPTool<
    z.infer<typeof GraphTestsInputSchema>,
    {
      command: string;
      tests: Array<{ id: string; name: string; testRef: TestRef }>;
      coverage: { changeSet: string[]; impactedNodes: number; impactedTests: number; resolved: number; files: string[] };
      unresolved: Array<{ id: string; name: string; reason: string }>;
    }
  > = {
    name: 'graph_tests',
    description:
      'Deduce the minimal selective test set for a change (FUNC-deduce-tests / CR-GC-134 + ' +
      'FUNC-resolve-tests-from-code / CR-GC-204). Maps a changeSet (changed node uids — a CODE ' +
      'node MOD/FUNC or a REQ) → impacted TEST nodes via the SINGLE harness.testImpact() traversal: ' +
      'a code node is walked DIRECTIONALLY `node →satisfy/allocate→ REQ →verify→ TEST` (not plain ' +
      'incoming-impact, which never reaches a code node’s tests), a REQ degenerates to its verify- ' +
      'dependents. Resolves each impacted TEST via its `testRef` binding {file, case?, tool, level?} ' +
      'and emits the minimal `vitest run <only-affected-files>` command + coverage. TESTs without a ' +
      'resolvable testRef (concept-only) are reported under `unresolved` (never silently dropped).',
    inputSchema: GraphTestsInputSchema,
    async handler(input) {
      // Directed code→REQ→TEST resolution via the SINGLE getSubgraph primitive
      // (harness.testImpact — one traversal path, no second blast-radius).
      const directed = await harness.testImpact(input.changeSet, input.depth);
      const impacted = new Map<string, GraphNode>();
      for (const node of directed.nodes) impacted.set(node.uid, node);

      const impactedTests = [...impacted.values()].filter((n) => n.type === 'TEST');

      const tests: Array<{ id: string; name: string; testRef: TestRef }> = [];
      const unresolved: Array<{ id: string; name: string; reason: string }> = [];
      const files = new Set<string>();

      for (const node of impactedTests) {
        const raw = node.attributes?.testRef;
        if (raw === undefined || raw === null) {
          const reason = node.attributes?.concept === true ? 'concept-only (no run artifact yet)' : 'no testRef attribute';
          unresolved.push({ id: node.uid, name: node.name, reason });
          continue;
        }
        const parsed = TestRefSchema.safeParse(raw);
        if (!parsed.success) {
          unresolved.push({ id: node.uid, name: node.name, reason: `invalid testRef: ${parsed.error.message}` });
          continue;
        }
        tests.push({ id: node.uid, name: node.name, testRef: parsed.data });
        files.add(parsed.data.file);
      }

      // Minimal selective run: ONLY the affected test files, sorted+deduped.
      const fileList = [...files].sort();
      const command = fileList.length > 0 ? `vitest run ${fileList.join(' ')}` : 'vitest run --passWithNoTests';

      return {
        command,
        tests,
        coverage: {
          changeSet: input.changeSet,
          impactedNodes: impacted.size,
          impactedTests: impactedTests.length,
          resolved: tests.length,
          files: fileList,
        },
        unresolved,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // RESEED tool — re-sync the live store to the committed SSOT (CR-GC-203 item 4).
  // In-process clear+reimport behind the single writer; replaces the corrupting
  // stop-server → rm .graphcode/kuzu → restart dance.
  // ---------------------------------------------------------------------------

  const GraphReseedInputSchema = z.object({
    path: z
      .string()
      .optional()
      .describe('Committed graph JSON path relative to repoRoot (default docs/graph/graphcode.graph.json).'),
  });

  const graph_reseed: MCPTool<z.infer<typeof GraphReseedInputSchema>, { reseeded: true; nodes: number; edges: number }> = {
    name: 'graph_reseed',
    description:
      'Re-sync the live store to the committed SSOT JSON (CR-GC-203 item 4). The single-writer owner ' +
      'clears the store IN-PROCESS (DETACH DELETE through the open handle) then re-imports the committed ' +
      'graph — replacing the stop-server → rm .graphcode/kuzu → restart dance, which corrupts the store ' +
      'when the file is removed under a live handle. DISCARDS un-exported gate mutations; pairs with the ' +
      'export drift guard. Single-writer; no direct Kuzu access.',
    inputSchema: GraphReseedInputSchema,
    async handler(input) {
      const { nodes, edges } = await harness.reseed(input.path);
      return { reseeded: true as const, nodes, edges };
    },
  };

  // ---------------------------------------------------------------------------
  // Registry
  // ---------------------------------------------------------------------------

  return {
    graph_elements,
    graph_get_node,
    graph_get_edges,
    graph_mutate,
    rules_evaluate,
    rules_get_violations,
    audit_trail,
    audit_stats,
    graph_impact,
    graph_expand,
    graph_context,
    graph_export,
    graph_readiness,
    graph_reseed,
    graph_tests,
  };
}
