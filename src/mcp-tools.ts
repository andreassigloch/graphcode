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

import { join, dirname, isAbsolute } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { z } from 'zod/v4';
import type { ZodType } from 'zod/v4';
import type { GraphCodeHarness } from './harness.js';
import type { Graph, GraphNode, GraphEdge, AuditLog, AuditEntry } from '@sigloch/graph-api-core';
import { FormatECodec, SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { FileAuditLog, type GraphcodeAuditEntry } from './audit-file.js';
import { type MutateCommand, type MutateResult, type RuleViolation } from '@sigloch/contracts/harness';
import { TestRefSchema, type TestRef, TRACE_PATTERNS } from '@sigloch/contracts/se';
import { exportGraphJson, exportMarkdown, renderTestStubs, MarkdownViewSchema, MARKDOWN_VIEWS, VIEW_FILENAMES } from './exporter.js';
import { clearExportPending } from './export-marker.js';
import { scoreReadiness, summarizeReadiness, type ReadinessReport } from './readiness.js';
import { helpEntry, contextualHelp, type HelpEntry, type ContextualMeasure } from './viewer/help.js';
import { GraphCodeCodec } from './codec.js';
import { readBranchLog, replayBranchLog, type MergeReport } from './merge.js';

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

/** Read-tool output format (CR-GC-210): JSON for agent logic, Format-E for a human/round-trip slice. */
const ReadFormatSchema = z
  .enum(['json', 'formatE'])
  .default('json')
  .describe(
    "Output format. 'json' (default) for programmatic agent logic; 'formatE' for a human-readable, " +
      'round-trip-stable slice in the canonical uid.TYPE Format-E dialect (re-importable via the codec).',
  );

const GraphElementsInputSchema = z.object({
  type: z.string().optional().describe('Filter by node type (e.g. REQ, TEST, MOD)'),
  search: z.string().optional().describe('Substring search against uid, name, description'),
  limit: z.number().int().positive().default(100),
  format: ReadFormatSchema,
});

const GraphGetNodeInputSchema = z.object({
  uid: z.string().describe('Node uid'),
});

const GraphGetEdgesInputSchema = z.object({
  uid: z.string().optional().describe('Filter edges incident to this node'),
  edgeType: z.string().optional().describe('Filter by edge type'),
  direction: z.enum(['in', 'out', 'both']).default('both'),
  format: ReadFormatSchema,
});

/**
 * OCC base version (CR-GC-233): the graphVersion the writer READ before composing
 * this write. Tool-schema-local by design — NOT a MutateCommand/MutateResult
 * contracts field (promotion to @sigloch/contracts is a later family review).
 */
const BaseVersionSchema = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .describe(
    'Optimistic concurrency (CR-GC-233): the graphVersion your last read returned. ' +
      'If the graph moved since (baseVersion < current graphVersion) the write is REJECTED ' +
      'with the delta (audit entries since baseVersion) — re-read, adapt, retry. ' +
      'Omitting it skips the check (warning only; lost-update window).',
  );

const GraphMutateInputSchema = z.object({
  // commands is validated by harness.mutate() via MutateCommandSchema internally.
  // We accept any array here to avoid cross-Zod-version schema composition issues (D1).
  commands: z.array(z.unknown()).min(1),
  consumerId: z.string().default('mcp-client'),
  baseVersion: BaseVersionSchema,
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

const GraphHelpInputSchema = z.object({
  token: z
    .string()
    .optional()
    .describe(
      'Optional dashboard token to explain: a ruleId (R-04), gate (CDR), panel id (recommendations), ' +
        'artifact id (fmea), or vocabulary token (REQ). Omit for the contextual, ranked, explained ' +
        'measures derived from the live readiness + violations (the explained Recommendations).',
    ),
});

/** Flat realize affordance (CR-GC-216) — the write-twin of graph_context, no nested union. */
const GraphRealizeInputSchema = z.object({
  funcUid: z.string().describe('The FUNC node to realize — sets its codeRef (R-20).'),
  file: z.string().describe('Implementation file path, e.g. src/x.ts.'),
  symbol: z.string().describe('The exported symbol (function/class) that realizes the FUNC.'),
  lang: z.string().optional().describe('Language id (default ts).'),
  testUid: z.string().optional().describe('Optional TEST node to bind — sets its testRef (R-19).'),
  testFile: z.string().optional().describe('Test file path (required when testUid is given).'),
  testCase: z.string().optional().describe('Optional test case name.'),
  tool: z.string().optional().describe('Test tool for the testRef (default vitest).'),
  consumerId: z.string().default('mcp-client'),
  baseVersion: BaseVersionSchema,
});

/** Authoring-guide input (CR-GC-231) — which ElementType to surface legal edges for. */
const GraphAuthoringGuideInputSchema = z.object({
  type: z.string().describe('The ElementType to author (e.g. UC, REQ, FUNC, TEST, MOD, ACTOR).'),
});

/** Replay-based branch reintegration (CR-GC-234) — the semantic rebase. */
const GraphMergeInputSchema = z.object({
  log: z
    .string()
    .describe(
      "Path to the BRANCH's durable command log (the worktree's .graphcode/audit.jsonl, CR-GC-232) — " +
        'absolute, or relative to this repoRoot.',
    ),
  sinceVersion: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'The fork point: the shared base graphVersion (CR-GC-233). Branch entries with graphVersion > ' +
        'sinceVersion are replayed; everything at or before it is shared history.',
    ),
  dryRun: z
    .boolean()
    .default(false)
    .describe('true = merge preview: full report, but graph + log stay byte-identical.'),
  consumerId: z.string().default('graph-merge'),
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
  // Durable by default (CR-GC-232): the command log survives the process, anchored
  // BESIDE the store it describes (per store, never per repo — same rule as the O2
  // lock). Tests may inject an InMemoryAuditLog (dependency injection, no parallel path).
  auditLog: AuditLog = new FileAuditLog(harness.getStoreDir()),
): MCPToolRegistry {
  const codec = new FormatECodec(SE_DESCRIPTOR);
  // Round-trip-stable Format-E for the opt-in read-tool slices (CR-GC-210): the wrapper
  // adds/strips the .TYPE uid suffix so the slice re-imports via the same codec.
  const gcCodec = new GraphCodeCodec();
  // Version continuity (CR-GC-232): resume from the durable log's highest version —
  // never reset to 0 per session (CR-233 builds its OCC on this monotonicity).
  const versioned = auditLog as Partial<Pick<FileAuditLog, 'latestVersion'>>;
  let _graphVersion = versioned.latestVersion?.() ?? 0;

  // Record a gated write in the audit log — WITH its command batch, so the log is
  // replayable (CR-GC-234). Every write tool must call this (no audit bypass).
  // OCC invariant (CR-GC-233): graphVersion counts APPLIED batches only — a rejected
  // write changes no state, so it must not move the version (or a bystander's
  // rejected attempt would spuriously stale every other writer's baseVersion).
  async function recordAudit(
    consumerId: string,
    result: MutateResult,
    commands?: MutateCommand[],
  ): Promise<void> {
    if (result.success) _graphVersion += 1;
    const entry: GraphcodeAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      consumerId,
      consumerType: 'agent',
      operation: 'mutate',
      result: result.success ? 'applied' : 'rejected',
      violations: result.violations as import('@sigloch/graph-api-core').RuleViolation[],
      graphVersion: _graphVersion,
      commands,
    };
    await auditLog.record(entry);
  }

  // ---------------------------------------------------------------------------
  // OCC (CR-GC-233): stale-write rejection at the tool layer. The check and the
  // gate apply must be ATOMIC relative to other tool-layer writes, so write tools
  // run on one promise chain (same pattern as the harness O3 mutex — the harness
  // serializes gate bodies; this serializes check+gate+record as one unit).
  // ---------------------------------------------------------------------------

  let toolWriteChain: Promise<unknown> = Promise.resolve();
  function serializeToolWrite<T>(body: () => Promise<T>): Promise<T> {
    const result = toolWriteChain.then(body, body);
    toolWriteChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const OCC_WARNING =
    'no baseVersion supplied — OCC check skipped (lost-update window). Pass the graphVersion ' +
    'your last read returned as baseVersion (CR-GC-233).';

  /**
   * Reject a write whose base is older than the current graph — with the DELTA:
   * the applied audit entries (incl. their command batches) since baseVersion,
   * so the writer sees WHAT changed, re-reads, retries. Returns null when fresh.
   */
  async function occReject(
    consumerId: string,
    baseVersion: number | undefined,
    commands: MutateCommand[] | undefined,
  ): Promise<(MutateResult & { graphVersion: number; occ: { staleBaseVersion: number; delta: GraphcodeAuditEntry[] } }) | null> {
    if (baseVersion === undefined || baseVersion >= _graphVersion) return null;
    const all = (await auditLog.query({})) as GraphcodeAuditEntry[];
    const delta = all.filter((e) => e.result === 'applied' && (e.graphVersion ?? 0) > baseVersion);
    const result: MutateResult = {
      success: false,
      appliedCommands: 0,
      mutations: 0,
      violations: [
        {
          ruleId: 'OCC',
          severity: 'error',
          message:
            `stale baseVersion ${baseVersion}: the graph is at version ${_graphVersion} — ` +
            `${delta.length} applied batch(es) landed since your read. Re-read (any read tool ` +
            `returns the current graphVersion), reconcile with the delta, retry.`,
        },
      ],
      confidence: 0,
      tier: 'block',
    };
    await recordAudit(consumerId, result, commands);
    return { ...result, graphVersion: _graphVersion, occ: { staleBaseVersion: baseVersion, delta } };
  }

  // ---------------------------------------------------------------------------
  // READ tools
  // ---------------------------------------------------------------------------

  const graph_elements: MCPTool<
    z.infer<typeof GraphElementsInputSchema>,
    { nodes: GraphNode[]; total: number; graphVersion: number } | { formatE: string; total: number; graphVersion: number }
  > = {
    name: 'graph_elements',
    description:
      'List graph elements (nodes) with optional type/search filter. Returns a slice, not a full dump. ' +
      "Output is JSON by default (agent logic); pass format:'formatE' for a human-readable, round-trip-stable " +
      'slice (the selected nodes + the edges induced between them) in the canonical uid.TYPE Format-E dialect ' +
      '(re-importable via the codec, like the committed graph.json). The slice-tools (graph_impact / ' +
      'graph_expand) are ALWAYS Format-E (CR-GC-210).',
    inputSchema: GraphElementsInputSchema,
    async handler(input) {
      // Cypher-backed listing via the Kuzu store (KNOW, not grep over the mirror).
      const nodes = await harness.listElements({ type: input.type, search: input.search });
      const total = nodes.length;
      const sliced = nodes.slice(0, input.limit);
      if (input.format === 'formatE') {
        const ids = new Set(sliced.map((n) => n.uid));
        const edges = harness.getGraph().edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
        return { formatE: gcCodec.encode({ nodes: sliced, edges }), total, graphVersion: _graphVersion };
      }
      return { nodes: sliced, total, graphVersion: _graphVersion };
    },
  };

  const graph_get_node: MCPTool<
    z.infer<typeof GraphGetNodeInputSchema>,
    { node: GraphNode | null; graphVersion: number }
  > = {
    name: 'graph_get_node',
    description: 'Get a single graph node by uid.',
    inputSchema: GraphGetNodeInputSchema,
    async handler(input) {
      const node = harness.getGraph().nodes.find((n) => n.uid === input.uid) ?? null;
      return { node, graphVersion: _graphVersion };
    },
  };

  const graph_get_edges: MCPTool<
    z.infer<typeof GraphGetEdgesInputSchema>,
    { edges: GraphEdge[]; total: number; graphVersion: number } | { formatE: string; total: number; graphVersion: number }
  > = {
    name: 'graph_get_edges',
    description:
      'Get edges, optionally filtered by incident node uid, edge type, or direction. ' +
      "Output is JSON by default (agent logic); pass format:'formatE' for a human-readable, round-trip-stable " +
      'slice (the filtered edges + their endpoint nodes) in the canonical uid.TYPE Format-E dialect ' +
      '(re-importable via the codec). The slice-tools (graph_impact / graph_expand) are ALWAYS Format-E (CR-GC-210).',
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
      if (input.format === 'formatE') {
        const ids = new Set<string>();
        for (const e of edges) {
          ids.add(e.sourceId);
          ids.add(e.targetId);
        }
        const nodes = harness.getGraph().nodes.filter((n) => ids.has(n.uid));
        return { formatE: gcCodec.encode({ nodes, edges }), total: edges.length, graphVersion: _graphVersion };
      }
      return { edges, total: edges.length, graphVersion: _graphVersion };
    },
  };

  // ---------------------------------------------------------------------------
  // WRITE tool — gate symmetry (L2): delegates to harness.mutate(), no bypass
  // ---------------------------------------------------------------------------

  const graph_mutate: MCPTool<
    z.infer<typeof GraphMutateInputSchema>,
    MutateResult & { graphVersion: number; occWarning?: string; occ?: { staleBaseVersion: number; delta: GraphcodeAuditEntry[] } }
  > = {
    name: 'graph_mutate',
    description:
      'Apply a batch of graph mutations through the Apply-Gate (L2). ' +
      'Every write goes through harness.mutate() — identical semantics to in-process calls. ' +
      'No direct Kuzu access; blocked by rules identical to any in-process mutation. ' +
      'OCC (CR-GC-233): pass the graphVersion your last read returned as baseVersion — a stale ' +
      'base is rejected (tier block) with the delta of applied batches since; re-read + retry.',
    inputSchema: GraphMutateInputSchema,
    async handler(input) {
      return serializeToolWrite(async () => {
        const commands = input.commands as MutateCommand[];
        const stale = await occReject(input.consumerId, input.baseVersion, commands);
        if (stale) return stale;
        // L2: identical semantics — delegate straight to the gate, no bypass.
        // Cast: MCP transports deserialize commands as plain objects; harness.mutate()
        // validates internally via MutateCommandSchema.
        const result = await harness.mutate(commands);
        await recordAudit(input.consumerId, result, commands);
        return {
          ...result,
          graphVersion: _graphVersion,
          ...(input.baseVersion === undefined ? { occWarning: OCC_WARNING } : {}),
        };
      });
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
    { formatE: string; nodeCount: number; edgeCount: number; rootId: string; graphVersion: number }
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
        graphVersion: _graphVersion,
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
    { formatE: string; nodeCount: number; edgeCount: number; rootId: string; missingRefs: string[]; graphVersion: number }
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
        graphVersion: _graphVersion,
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

  const graph_readiness: MCPTool<
    z.infer<typeof GraphReadinessInputSchema>,
    ReadinessReport & { graphVersion: number }
  > = {
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
      return { ...(input.detail ? report : summarizeReadiness(report)), graphVersion: _graphVersion };
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

  const graph_help: MCPTool<
    z.infer<typeof GraphHelpInputSchema>,
    HelpEntry | { measures: ContextualMeasure[] }
  > = {
    name: 'graph_help',
    description:
      'Explain any dashboard item for both audiences (CR-GC-229): a systems engineer who does not know ' +
      'this encoding, and a user with no SE background. Read-only. With `token` → the HelpEntry for that ' +
      'ruleId / gate / panel / artifact / vocabulary token, carrying all three layers (plain, SE-terms, ' +
      'and the exact copy-prompt). Without an argument → the contextual, ranked, explained measures from ' +
      'the live readiness + violations (the explained sibling of Recommendations), covering BOTH rule ' +
      'violations and not-done-creation gate blockers (CR-GC-221). Authored Plain/SE layers come from ' +
      'help-content.ts; titles/severity/owning-gate are derived from V3_RULES + readiness.',
    inputSchema: GraphHelpInputSchema,
    async handler(input) {
      if (input.token !== undefined) {
        const entry = helpEntry(input.token);
        if (!entry) {
          throw new Error(
            `graph_help: unknown token '${input.token}'. Try a ruleId (e.g. R-04), a gate (SRR/PDR/CDR/TRR, ` +
              `SAR/FCA/SVR/FRR), a panel (readiness/recommendations/artifacts/impact/health), an artifact ` +
              `(e.g. fmea), or a vocabulary token (e.g. REQ). Omit the token for contextual help.`,
          );
        }
        return entry;
      }
      return { measures: contextualHelp(scoreReadiness(harness), harness.evaluateRules()) };
    },
  };

  const missingRefIds = (): Set<string> =>
    new Set(
      harness
        .evaluateRules()
        .filter((v) => v.ruleId === 'R-19' || v.ruleId === 'R-20')
        .map((v) => v.elementId)
        .filter((id): id is string => !!id),
    );

  const graph_realize: MCPTool<
    z.infer<typeof GraphRealizeInputSchema>,
    {
      success: boolean;
      tier: MutateResult['tier'];
      violations: RuleViolation[];
      missingRefsBefore: string[];
      missingRefsAfter: string[];
      resolved: string[];
      graphVersion: number;
      occWarning?: string;
      occ?: { staleBaseVersion: number; delta: GraphcodeAuditEntry[] };
    }
  > = {
    name: 'graph_realize',
    description:
      'Flat realize affordance (CR-GC-216) — the write-twin of graph_context. Binds a FUNC to its code ' +
      '(codeRef, R-20) and optionally a TEST to its test file (testRef, R-19) in ONE call, through the same ' +
      'Apply-Gate as graph_mutate (no parallel write path — it composes harness.mutate). Use this instead of ' +
      "hand-building graph_mutate's nested update-node/CodeRef union for the 90% case 'I just realized FUNC X'. " +
      'Returns the missingRefs delta (before/after + resolved) so the realization is confirmed, not blind. ' +
      'Unknown funcUid/testUid → a clear error. OCC (CR-GC-233): optional baseVersion as in graph_mutate.',
    inputSchema: GraphRealizeInputSchema,
    async handler(input) {
      const nodes = harness.getGraph().nodes;
      const fn = nodes.find((n) => n.uid === input.funcUid);
      if (!fn) throw new Error(`graph_realize: unknown funcUid '${input.funcUid}'.`);

      const commands: MutateCommand[] = [
        {
          op: 'update-node',
          node: {
            uid: input.funcUid,
            type: fn.type,
            attributes: { codeRef: { file: input.file, symbol: input.symbol, ...(input.lang ? { lang: input.lang } : {}) } },
          },
        },
      ];

      if (input.testUid) {
        if (!input.testFile) throw new Error('graph_realize: testFile is required when testUid is given.');
        const test = nodes.find((n) => n.uid === input.testUid);
        if (!test) throw new Error(`graph_realize: unknown testUid '${input.testUid}'.`);
        commands.push({
          op: 'update-node',
          node: {
            uid: input.testUid,
            type: test.type,
            attributes: {
              testRef: { file: input.testFile, tool: input.tool ?? 'vitest', ...(input.testCase ? { case: input.testCase } : {}) },
            },
          },
        });
      }

      return serializeToolWrite(async () => {
        const before = missingRefIds();
        const stale = await occReject(input.consumerId, input.baseVersion, commands);
        if (stale) {
          return {
            success: false,
            tier: stale.tier,
            violations: stale.violations,
            missingRefsBefore: [...before],
            missingRefsAfter: [...before],
            resolved: [],
            graphVersion: stale.graphVersion,
            occ: stale.occ,
          };
        }
        const result = await harness.mutate(commands);
        // No audit bypass (CR-GC-232): realize writes are logged like any gated write.
        await recordAudit(input.consumerId, result, commands);
        const after = missingRefIds();
        return {
          success: result.success,
          tier: result.tier,
          violations: result.violations,
          missingRefsBefore: [...before],
          missingRefsAfter: [...after],
          resolved: [...before].filter((id) => !after.has(id)),
          graphVersion: _graphVersion,
          ...(input.baseVersion === undefined ? { occWarning: OCC_WARNING } : {}),
        };
      });
    },
  };

  const graph_merge: MCPTool<
    z.infer<typeof GraphMergeInputSchema>,
    MergeReport & { graphVersion: number }
  > = {
    name: 'graph_merge',
    description:
      'Replay-based branch reintegration (CR-GC-234) — the semantic rebase that ends the manual ' +
      "graph.json text-merge. Reads the BRANCH's durable command log (its worktree's " +
      '.graphcode/audit.jsonl), takes the applied batches AFTER the fork point (sinceVersion, the ' +
      'shared base graphVersion) and re-applies them in log order through the EXISTING Apply-Gate ' +
      'onto the current base — every batch rule-validated, O3-serialized, no parallel write path. ' +
      'Conflicts are GATE violations, not text conflicts: a batch that is illegal on the new base ' +
      '(R-08 dangling after a foreign delete, R-18 illegal pair, delta errors) or would resurrect a ' +
      'deleted node (update-node on a missing uid) is skipped + reported under conflicted[] with ' +
      'violations + fixHint — machine-resolvable. Batches already contained in the base are skipped ' +
      "as idempotent. dryRun:true = merge preview (full report, graph + log byte-identical). " +
      'Workflow: gcw <branch> → work → graph_export + commit → on the target base: ' +
      'graph_merge {log, sinceVersion} → graph_export.',
    inputSchema: GraphMergeInputSchema,
    async handler(input) {
      const logPath = isAbsolute(input.log) ? input.log : join(harness.getRepoRoot(), input.log);
      const entries = readBranchLog(logPath, input.sinceVersion);
      return serializeToolWrite(async () => {
        const report = await replayBranchLog(harness, entries, {
          dryRun: input.dryRun,
          // Real merge: every replayed batch lands in the TARGET's durable log like
          // any gated write (applied → version++, conflicted → logged rejected).
          // A dry run records NOTHING (byte-identical log guarantee).
          onBatchResult: input.dryRun ? undefined : (result, commands) => recordAudit(input.consumerId, result, commands),
        });
        report.sinceVersion = input.sinceVersion;
        // Dry run: the gate's dryRun mode accumulated the preview in the in-memory
        // working copy — restore it from the (untouched) disk store.
        if (input.dryRun) await harness.loadGraph();
        return { ...report, graphVersion: _graphVersion };
      });
    },
  };

  const graph_authoring_guide: MCPTool<
    z.infer<typeof GraphAuthoringGuideInputSchema>,
    {
      type: string;
      outgoing: Array<{ edgeType: string; targetType: string; cardinality?: string; description?: string }>;
      incoming: Array<{ edgeType: string; sourceType: string; cardinality?: string; description?: string }>;
      requiredAttrs: string[];
    }
  > = {
    name: 'graph_authoring_guide',
    description:
      'Surface the LEGAL incident edges for an ElementType (CR-GC-231) — the read-twin of graph_context for ' +
      'the WRITE side of the spec. graph_context answers "what is a node\'s definition-of-done" (implement); ' +
      'graph_authoring_guide answers "what structure is legal for this type" (author). Call it BEFORE writing ' +
      'a node so you emit a correct add-node/add-edge via graph_mutate instead of guessing the ontology. ' +
      'Returns outgoing [{edgeType,targetType,cardinality,description}], incoming [{edgeType,sourceType,…}], ' +
      'and requiredAttrs — derived live from the imported @sigloch/contracts/se META_MODEL (TRACE_PATTERNS), ' +
      'never a local fork. Read-only. Unknown type → a clear error.',
    inputSchema: GraphAuthoringGuideInputSchema,
    async handler(input) {
      const descriptor = SE_DESCRIPTOR.nodeTypes[input.type as keyof typeof SE_DESCRIPTOR.nodeTypes];
      if (!descriptor) {
        throw new Error(
          `graph_authoring_guide: unknown element type '${input.type}'. Valid types: ` +
            `${Object.keys(SE_DESCRIPTOR.nodeTypes).join(', ')}.`,
        );
      }
      const patterns = TRACE_PATTERNS as ReadonlyArray<{
        source: string;
        target: string;
        type: string;
        cardinality?: string;
        description?: string;
      }>;
      const outgoing = patterns
        .filter((p) => p.source === input.type)
        .map((p) => ({ edgeType: p.type, targetType: p.target, cardinality: p.cardinality, description: p.description }));
      const incoming = patterns
        .filter((p) => p.target === input.type)
        .map((p) => ({ edgeType: p.type, sourceType: p.source, cardinality: p.cardinality, description: p.description }));
      return { type: input.type, outgoing, incoming, requiredAttrs: [...(descriptor.requiredAttrs ?? [])] };
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
    graph_help,
    graph_realize,
    graph_merge,
    graph_authoring_guide,
  };
}
