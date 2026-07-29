/**
 * tools/read.ts — READ + QUERY-PRECISION tools (MOD-mcp-tools, CR-GC-256).
 *
 * graph_elements / graph_get_node / graph_get_edges plus the precision trio
 * graph_impact (R6/R12 blast-radius) / graph_expand (R13 on-demand deepening) /
 * graph_context (CR-GC-213 upstream spec-closure). Read-only: no tool here goes
 * through the gate, so none of them touch the write chain.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

/** Read-tool output format (CR-GC-210): JSON for agent logic, Format-E for a human/round-trip slice. */
const ReadFormatSchema = z
  .enum(['json', 'formatE'])
  .default('json')
  .describe(
    "Output format. 'json' (default) for programmatic agent logic; 'formatE' for a human-readable, " +
      'round-trip-stable Format-E v2 slice — type per `### <TYPE>` section, uids verbatim (re-importable via the codec).',
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

// Branch → edge-type filter for graph_expand. trace/test branches keep the full
// Kuzu neighbourhood but prune to the relevant edge types (and the nodes those
// edges touch). callers/all are pure-direction and need no edge filtering.

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

// graph_context — UPSTREAM spec-closure ("definition of done") for one node.
// Pure composition over the in-memory graph (no Kuzu traversal): self + the
// REQ/UC it satisfies + the TEST that verify those REQ + the FLOW it exchanges
// (io) + the MOD it is allocated to + the SCHEMA of those FLOW (relation).
// Complements graph_impact (DOWNSTREAM blast-radius) — opposite direction.

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
  // realRef gap signal — a FUNC in the slice with no pointer to implement from (CR-GC-213).
  // A "reference implementation" is NOT a separate concept: it is just a realRef (pointing at a
  // stub/spike). If that impl is only functionally-close, the agent reads it and fixes it.
  const missingRefs = nodes
    .filter((n) => n.type === 'FUNC' && !n.attributes.realRef)
    .map((n) => n.uid);

  return { slice: { nodes, edges: keepEdges }, missingRefs };
}

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindReadTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, codec, gcCodec, graphVersion } = ctx;

  const graph_elements: MCPTool<
    z.infer<typeof GraphElementsInputSchema>,
    { nodes: GraphNode[]; total: number; graphVersion: number } | { formatE: string; total: number; graphVersion: number }
  > = {
    name: 'graph_elements',
    description:
      'List graph elements (nodes) with optional type/search filter. Returns a slice, not a full dump. ' +
      "Output is JSON by default (agent logic); pass format:'formatE' for a human-readable, round-trip-stable " +
      'slice (the selected nodes + the edges induced between them) as Format-E v2 — type per `### <TYPE>` section, uids verbatim ' +
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
        return { formatE: gcCodec.encode({ nodes: sliced, edges }), total, graphVersion: graphVersion() };
      }
      return { nodes: sliced, total, graphVersion: graphVersion() };
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
      return { node, graphVersion: graphVersion() };
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
      'slice (the filtered edges + their endpoint nodes) as Format-E v2 — type per `### <TYPE>` section, uids verbatim ' +
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
        return { formatE: gcCodec.encode({ nodes, edges }), total: edges.length, graphVersion: graphVersion() };
      }
      return { edges, total: edges.length, graphVersion: graphVersion() };
    },
  };

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
        graphVersion: graphVersion(),
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
      'description prose and realRef/testRef attributes, as one Format-E slice. ' +
      'Use this to IMPLEMENT a node (one call instead of get_node+impact+expand+get_edges). ' +
      'Contrast: graph_impact = DOWNSTREAM blast-radius (who breaks if I change this); graph_expand = ' +
      'manual branch deepening. Never a full dump. `missingRefs` flags FUNCs lacking a realRef.',
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
        graphVersion: graphVersion(),
      };
    },
  };

  return { graph_elements, graph_get_node, graph_get_edges, graph_impact, graph_expand, graph_context };
}
