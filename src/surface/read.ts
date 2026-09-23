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
import type { MCPTool, MCPToolRegistry } from '../kernel/tool-contract.js';
import type { ToolContext } from './tool-context.js';

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
  prosa: z
    .boolean()
    .default(false)
    .describe(
      'Carry every node description in full (CR-GC-621). Default false: a listing answers WHICH ' +
        'elements exist, so descriptions come as the cut mark and `graph_get_node` has the wording. ' +
        'Set it only when the TEXT itself is what you evaluate — the duplicate index does.',
    ),
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
const COMPOSE_EDGE = 'compose';

/**
 * Job-Scheibe (CR-GC-367) — was ein Agent aufmachen muss, um EINEN Job zu tun.
 *
 * Nicht dasselbe wie `buildContextSlice`: der Job-Anker ist oft ein CR, und
 * `graph_context` folgt keiner `relation`-Kante von einem CR aus (sie ist keine
 * Spec-Kante). Ein CR-Anker wird deshalb zuerst auf seine `relation`-Ziele
 * aufgelöst — das sind die Knoten, an denen der Job wirklich arbeitet — und
 * darüber die Spec-Closure gebildet.
 *
 * CR und MS fallen aus dem Ergebnis: gemessen (SPIKE-GC-minimal-whitebox) stellen
 * CR-Knoten 60 % des Graph-Textes und 0 % der Knoten, die die zugehörigen Commits
 * real geändert haben. Sie beantworten „wer hat das mal angefasst", nicht „woraus
 * ist der Job definiert".
 *
 * Kein Blackbox-Ring: die Dependents des Blast-Radius sind der Benachrichtigungs-,
 * nicht der Arbeitsbegriff (Arm B des Spikes deckte 12/12 bzw. 16/16 der real
 * geänderten Knoten ohne ihn).
 */
const JOB_EXCLUDED_TYPES = new Set(['CR', 'MS']);

export function buildJobSlice(
  graph: Graph,
  anchorId: string,
  depth = 1,
): { slice: Graph; seeds: string[]; missingRefs: string[] } {
  const anchor = graph.nodes.find((n) => n.uid === anchorId);
  if (!anchor) throw new Error(`buildJobSlice: node '${anchorId}' not found`);

  // CR-Anker → seine relation-Ziele; alles andere ist sein eigener Seed.
  const seeds =
    anchor.type === 'CR'
      ? graph.edges
          .filter((e) => e.sourceId === anchorId && e.edgeType === DATA_RELATION_EDGE)
          .map((e) => e.targetId)
          .filter((t) => !JOB_EXCLUDED_TYPES.has(graph.nodes.find((n) => n.uid === t)?.type ?? ''))
      : [anchorId];
  if (seeds.length === 0) return { slice: { nodes: [], edges: [] }, seeds: [], missingRefs: [] };

  const keep = new Set<string>();
  const missingRefs = new Set<string>();
  for (const seed of seeds) {
    const { slice, missingRefs: missing } = buildContextSlice(graph, seed, depth);
    for (const n of slice.nodes) keep.add(n.uid);
    for (const m of missing) missingRefs.add(m);
  }
  for (const uid of [...keep]) {
    if (JOB_EXCLUDED_TYPES.has(graph.nodes.find((n) => n.uid === uid)?.type ?? '')) keep.delete(uid);
  }
  const nodes = graph.nodes.filter((n) => keep.has(n.uid));
  const edges = graph.edges.filter((e) => keep.has(e.sourceId) && keep.has(e.targetId));
  return { slice: { nodes, edges }, seeds, missingRefs: [...missingRefs] };
}

/**
 * CR-GC-613 — die Scheibe traegt die Prosa, die man zum BAUEN braucht; der Rest traegt Kanten.
 *
 * Gemessen im Code-Test (Lauf gefuehrt-1): drei `graph_context {depth:2}` zu je ~9.300 Zeichen,
 * davon 96 % Format-E — 27 bis 30 Knoten mit voller Beschreibung, einschliesslich ACTOR, FCHAIN
 * und Nachbar-FLOWs. Gebraucht wurden, woertlich aus dem Befund: **die FUNC, ihre SCHEMAs und
 * REQs**. (Am sigllm-Golden nachgemessen: FUNC-register-and-manage-agents 9.136,
 * FUNC-execute-agent-run-persist-state 9.036, FUNC-validate-result-retry-dead-letter 9.007 —
 * dieselbe Groessenordnung, also dieselbe Sache.)
 *
 * Der Schnitt geht deshalb nach TYP, nicht nach Ring. Ein erster Anlauf schnitt ab Ring 2 und
 * sparte gemessen 17 % — weil bei `depth: 2` der Innenring schon fast alles ist. Er sah nur
 * deshalb gruen aus, weil der Test einen kleinen Anker gewaehlt hatte: genau die Sorte
 * Falsch-Gruen, gegen die dieses Repo seine Messtests schreibt.
 *
 * PROSA behalten:
 *   - der ANKER selbst — er ist der Auftrag,
 *   - REQ — was eingeloest werden soll, ist ohne seinen Wortlaut nicht pruefbar,
 *   - SCHEMA — der Datenvertrag IST Text; eine Kante zu ihm sagt nichts ueber seine Form.
 * KANTEN, keine Prosa: MOD, FLOW, UC, ACTOR, FCHAIN, TEST, CR, MS — sie stehen als Knoten und
 * Kante vollstaendig da, ihre Beschreibung ist fuer das Bauen dieses einen Knotens Beiwerk.
 *
 * Bewusst eine MARKE statt einer leeren Beschreibung: sonst koennte der Leser "gekuerzt" nicht
 * von "hat keine Beschreibung" unterscheiden. Sie ist EIN Zeichen, und was es heisst, steht
 * EINMAL als Legende oben — ein ausgeschriebener Hinweis je Knoten kostete auf einer
 * 30-Knoten-Scheibe gemessen 1.178 Zeichen und machte die Kuerzung damit zur Haelfte zunichte.
 * Keine Pfeile im Text (`-wort->` braeche den Format-E-Roundtrip).
 */
const AUSSENRING_MARKE = '…';

/** Die Legende zur Marke — genau eine Zeile, als Format-E-Kommentar. */
export const KUERZUNGS_LEGENDE =
  '// … = Beschreibung gekuerzt (CR-GC-613); graph_get_node liefert den vollen Text';

/** Die Typen, deren Wortlaut zum Bauen des Ankers gebraucht wird. */
const PROSA_TYPEN = new Set(['REQ', 'SCHEMA']);

/**
 * CR-GC-621 — die LISTE kennt keinen Anker, also traegt sie keine Prosa.
 *
 * `kuerzeAussenring` nimmt REQ und SCHEMA aus, weil man aus ihrem Wortlaut den ANKER baut. Eine
 * Liste hat keinen: sie beantwortet „welche Elemente vom Typ X gibt es". Gemessen am eigenen
 * Modell (872 Knoten, `limit: 100` je Typ) kostet die Prosa dort 48 bis 78 Prozent der Antwort —
 * bei REQ 21.012 von 39.740 Zeichen, also genau bei dem Typ, den eine Ausnahme verschont haette.
 *
 * Dieselbe Marke und dieselbe Legende wie CR-GC-613 — der Leser soll „gekuerzt" nicht neu lernen.
 */
export function nurIdentitaet(nodes: GraphNode[], anker?: string): GraphNode[] {
  return nodes.map((n) => (n.description && n.uid !== anker ? { ...n, description: AUSSENRING_MARKE } : n));
}

export function kuerzeAussenring(slice: Graph, ankerId: string): Graph {
  return {
    ...slice,
    nodes: slice.nodes.map((n) =>
      n.uid === ankerId || PROSA_TYPEN.has(n.type) || !n.description
        ? n
        : { ...n, description: AUSSENRING_MARKE },
    ),
  };
}

/**
 * CR-GC-624 — der Strukturboden: Ring 2 ist eine SCHNITTSTELLE, kein geoeffneter Knoten.
 *
 * CR-GC-613 hatte die Prosa geschnitten und die Grenze benannt ("4.080 Zeichen Struktur, bevor ein
 * Wort Prosa dazukommt"). Die Zahl war die Folge einer Darstellung, nicht ein Boden. Nachgemessen
 * ueber alle 125 FUNC-Anker des eigenen Modells bei `depth: 2`, im Mittel je Scheibe: Kantenzeilen
 * 2.801, Attributzeilen 2.593, Identitaetszeilen des Aussenrings 1.730 — 72 % Struktur gegen 27 %
 * Prosa, bei 12 Knoten im Innenring und 42 im Ring 2. Der Fan-out entsteht an Hub-FLOWs und
 * beantwortet "wer fasst diesen Fluss noch an" — die Frage von `graph_impact`.
 *
 * Also dieselbe Darstellung, die `graph_impact` seit CR-GC-373 fuer seine Blackbox-Front benutzt:
 * Identitaet plus Vertragskante, keine Beschreibung, keine Attribute — hier zusaetzlich GRUPPIERT
 * nach Innenknoten und Kantentyp, weil der Fan-out ueber wenige Hubs laeuft.
 *
 * Gemessen: eigenes Modell 9.876 → 3.471, Golden-Anker 6.615 → 3.513.
 *
 * Der Rand wird GEZEIGT, nicht weggelassen: `nodeCount`/`edgeCount` zaehlen weiter die ganze
 * Scheibe, sonst waere die Kuerzung eine Luege ueber den Umfang.
 */
export const RAND_UEBERSCHRIFT = '## Rand (Ring 2 — Schnittstelle, nicht geoeffnet)';

export function schneideRand(slice: Graph, innenIds: Set<string>): { innen: Graph; rand: string } {
  const innen: Graph = {
    nodes: slice.nodes.filter((n) => innenIds.has(n.uid)),
    edges: slice.edges.filter((e) => innenIds.has(e.sourceId) && innenIds.has(e.targetId)),
  };
  // JEDE Kante mit mindestens einem Fuss ausserhalb, gruppiert nach Quelle und Kantentyp.
  //
  // Der erste Anlauf gruppierte nach dem INNENknoten und liess damit still sechs von dreissig
  // Knoten fallen: die Spec-Closure zieht ueber `verify`- und `relation`-Rueckkanten auch Knoten
  // herein, die NUR an Ring-2-Knoten haengen (ein TEST am REQ des zweiten Rings). Nach Quelle
  // gruppiert kommt jede Kante genau einmal vor — und damit jeder Knoten der Scheibe.
  const gruppen = new Map<string, Set<string>>();
  for (const e of slice.edges) {
    if (innenIds.has(e.sourceId) && innenIds.has(e.targetId)) continue;
    const schluessel = `${e.sourceId} ${e.edgeType}>`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, new Set());
    gruppen.get(schluessel)!.add(e.targetId);
  }
  // Deterministisch: gleicher Graph, gleiche Bytes (REQ-deterministic-serialization).
  const rand = [...gruppen.keys()]
    .sort()
    .map((k) => `${k} ${[...gruppen.get(k)!].sort().join(' ')}`)
    .join('\n');
  return { innen, rand };
}

export function buildContextSlice(
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
  // Wirkketten-Rueckkanten (CR-GC-366): seit `FUNC -satisfy-> UC` aus dem Meta-Modell
  // entfaellt, ist `UC -compose-> FCHAIN -compose-> FUNC` der EINZIGE Weg von einer Funktion
  // zu ihrem Use Case. Ohne diese zwei Hops verloere die Spec-Closure genau das, was die
  // Tool-Beschreibung zusagt ("die REQ/UC, die sie erfuellt"). Bewusst an den Quelltyp
  // gebunden statt an `compose` allgemein: ein `MS -compose-> FUNC` ist ein DOWNSTREAM-
  // Container und bleibt draussen (der Unterschied zu graph_impact), ein
  // `FUNC -compose-> FUNC` waere Zerlegung, nicht Spezifikation.
  const typeOf = new Map(graph.nodes.map((n) => [n.uid, n.type]));
  for (const e of graph.edges) {
    if (e.edgeType === COMPOSE_EDGE && typeOf.get(e.sourceId) === 'FCHAIN' && keepNodes.has(e.targetId)) {
      addEdge(e);
    }
  }
  for (const e of graph.edges) {
    if (e.edgeType === COMPOSE_EDGE && typeOf.get(e.sourceId) === 'UC' && keepNodes.has(e.targetId)) {
      addEdge(e);
    }
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

  /**
   * CR-GC-363: Freshness-Banner inline — eine `//`-Kopfzeile vor dem Format-E-
   * Ergebnis, wenn ein vorhandener AF-Stamp hinter dem Live-Graph-Stand liegt.
   * Frischer Stamp → byte-unverändert (kein Rauschen). Die Klassifikation kommt
   * aus `ctx.staleAnalysisBanner()` (computeAnalysisCurrency über die AF-Stamps),
   * hier wird nichts neu gerechnet. Format-E-parsebar: parse überspringt `//`.
   */
  const withFreshnessBanner = (formatE: string): string => {
    const banner = ctx.staleAnalysisBanner();
    return banner ? `${banner}\n${formatE}` : formatE;
  };

  const graph_elements: MCPTool<
    z.infer<typeof GraphElementsInputSchema>,
    | { nodes: GraphNode[]; total: number; graphVersion: number; legende?: string }
    | { formatE: string; total: number; graphVersion: number }
  > = {
    name: 'graph_elements',
    description:
      'List graph elements (nodes) with optional type/search filter. Returns a slice, not a full dump. ' +
      "Output is JSON by default (agent logic); pass format:'formatE' for a human-readable, round-trip-stable " +
      'slice (the selected nodes + the edges induced between them) as Format-E v2 — type per `### <TYPE>` section, uids verbatim ' +
      '(re-importable via the codec, like the committed graph.json). The slice-tools (graph_impact / ' +
      'graph_expand) are ALWAYS Format-E (CR-GC-210). Identity + attributes, descriptions as the cut mark ' +
      '(CR-GC-621); graph_get_node for the wording, prosa:true when the text itself is what you evaluate.',
    inputSchema: GraphElementsInputSchema,
    async handler(input) {
      // Cypher-backed listing via the Kuzu store (KNOW, not grep over the mirror).
      const nodes = await harness.listElements({ type: input.type, search: input.search });
      const total = nodes.length;
      // CR-GC-621: der Schnitt sitzt VOR der Format-Weiche — sonst hinge die Antwortgroesse am
      // Ausgabeformat statt an der Frage, und `formatE` waere der stille Umweg um die Kuerzung.
      const voll = nodes.slice(0, input.limit);
      const sliced = input.prosa ? voll : nurIdentitaet(voll);
      const gekuerzt = sliced.some((n) => n.description === AUSSENRING_MARKE);
      if (input.format === 'formatE') {
        const ids = new Set(sliced.map((n) => n.uid));
        const edges = harness.getGraph().edges.filter((e) => ids.has(e.sourceId) && ids.has(e.targetId));
        const formatE = gcCodec.encode({ nodes: sliced, edges });
        return {
          formatE: gekuerzt ? `${KUERZUNGS_LEGENDE}\n${formatE}` : formatE,
          total,
          graphVersion: graphVersion(),
        };
      }
      return {
        nodes: sliced,
        total,
        graphVersion: graphVersion(),
        ...(gekuerzt ? { legende: KUERZUNGS_LEGENDE } : {}),
      };
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
    {
      formatE: string;
      nodeCount: number;
      edgeCount: number;
      rootId: string;
      roles: Record<string, 'seed' | 'whitebox' | 'blackbox'>;
      graphVersion: number;
    }
  > = {
    name: 'graph_impact',
    description:
      'Compute the exact blast-radius (FUNC-graph-impact / R6 / R12): the root node + its ' +
      'DEPENDENTS (incoming edges — callers/traces/tests that point INTO root) within `depth` ' +
      'hops as a Format-E slice, plus the blackbox frontier at depth+1 (identity-only interface ' +
      'lines — the materialized cut). Never the full graph (anti-grep).',
    inputSchema: GraphImpactInputSchema,
    async handler(input) {
      // CR-GC-365 (Weg b): DIE geteilte Traversierung `impactSlice` aus
      // graph-api-core — dieselbe Funktion, die graph-view-edit rendert.
      // Knotengleich zur frueheren Kuzu-Query (Konformanztest im Paket).
      const slice = await harness.impact(input.id, input.depth);
      const open = slice.nodes.filter((n) => n.role !== 'blackbox');
      const openIds = new Set(open.map((n) => n.uid));
      const openGraph: Graph = {
        nodes: open.map(({ role: _r, distance: _d, ...node }) => node as GraphNode),
        edges: slice.edges.filter((e) => openIds.has(e.sourceId) && openIds.has(e.targetId)),
      };
      // CR-GC-373: Agenten-Sicht — der Konsument dieser Scheibe ist der Agent,
      // nicht der Re-Import; Provenienz (Zeitstempel, weight:1) bleibt weg.
      let formatE = codec.serialize(openGraph, { omitProvenance: true });
      // Blackbox-Front (§8): Identitaet + Vertragskanten, KEINE Beschreibung —
      // der Schnitt steht im Artefakt, nicht bloss in einer Renderer-Absicht.
      const ring = slice.nodes.filter((n) => n.role === 'blackbox');
      if (ring.length > 0) {
        const line = (uid: string, type: string, name: string): string => {
          const contract = [
            ...new Set(
              slice.edges
                .filter((e) => e.sourceId === uid || e.targetId === uid)
                .map((e) => (e.sourceId === uid ? `${e.edgeType}→${e.targetId}` : `${e.sourceId} ${e.edgeType}→`)),
            ),
          ];
          return `${uid} · ${type} · ${name}${contract.length ? ' · ' + contract.join(' ') : ''}`;
        };
        formatE +=
          '\n\n## Blackbox (Slice-Rand bei depth+1 — Schnittstelle, nicht geöffnet)\n' +
          ring.map((n) => line(n.uid, n.type, n.name)).join('\n');
      }
      return {
        rootId: input.id,
        nodeCount: slice.nodes.length,
        edgeCount: slice.edges.length,
        roles: Object.fromEntries(slice.nodes.map((n) => [n.uid, n.role])),
        formatE: withFreshnessBanner(formatE),
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
      'directions), and the new depth. No originals store — recomputed from the live Kuzu store. ' +
      'Prose is carried by the handle, its REQ and its SCHEMA (CR-GC-613/621); graph_get_node for the rest.',
    inputSchema: GraphExpandInputSchema,
    async handler(input) {
      // callers = incoming dependents; all/traces/tests = full neighbourhood (both),
      // with traces/tests pruned to the relevant edge types afterwards.
      const direction = input.branch === 'callers' ? 'in' : 'both';
      let subgraph = await harness.subgraph(input.handle, input.depth, direction);
      if (input.branch === 'traces') subgraph = filterByEdgeTypes(subgraph, input.handle, TRACE_EDGE_TYPES);
      else if (input.branch === 'tests') subgraph = filterByEdgeTypes(subgraph, input.handle, TEST_EDGE_TYPES);
      // CR-GC-621: IDENTITAET, nicht die Kontext-Regel. `graph_context` nimmt REQ und SCHEMA aus,
      // weil man aus ihrem Wortlaut den Anker BAUT; `graph_expand` vertieft einen Blast-Radius (R13)
      // und beantwortet, WAS dranhaengt — geoeffnet wird danach, mit `graph_context`/`graph_get_node`.
      // Gemessen am sigllm-Golden (Anker FUNC-execute-agent-run-persist-state, depth 2): die
      // Kontext-Regel spart hier 12 % (5.735 → 5.038), die Identitaet 50 % (→ 2.852). Zwei Regeln,
      // zwei Fragen — keine dritte. Die Knoten- und Kantenzahlen bleiben die der GANZEN Nachbarschaft.
      const gekuerzt = { ...subgraph, nodes: nurIdentitaet(subgraph.nodes, input.handle) };
      const legende = gekuerzt.nodes.some((n) => n.description === AUSSENRING_MARKE)
        ? `${KUERZUNGS_LEGENDE}\n`
        : '';
      const formatE = legende + codec.serialize(gekuerzt, { omitProvenance: true }); // CR-GC-373: Agenten-Sicht
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
      'exchanges via `io`, the MOD it is `allocate`d to, and the SCHEMA of those FLOW — as one Format-E ' +
      'slice. Use this to IMPLEMENT a node (one call instead of get_node+impact+expand+get_edges). ' +
      'Contrast: graph_impact = DOWNSTREAM blast-radius (who breaks if I change this); graph_expand = ' +
      'manual branch deepening. Never a full dump. `missingRefs` flags FUNCs lacking a realRef. ' +
      'Prose: the anchor, its REQ and its SCHEMA; every other neighbour comes as node and edge ' +
      '(CR-GC-613), and past depth 1 the outer ring is a frontier listing under `## Rand` (CR-GC-624). ' +
      'graph_get_node has the full text.',
    inputSchema: GraphContextInputSchema,
    async handler(input) {
      const graph = harness.getGraph();
      const { slice, missingRefs } = buildContextSlice(graph, input.id, input.depth);
      // CR-GC-624: der Innenring ist die Scheibe EINE Stufe flacher — bei `depth: 1` ist das die
      // ganze Scheibe, der Rand bleibt leer und die Antwort byte-gleich zu vorher.
      const innenIds = new Set(
        (input.depth > 1 ? buildContextSlice(graph, input.id, input.depth - 1).slice : slice).nodes.map((n) => n.uid),
      );
      const { innen, rand } = schneideRand(slice, innenIds);
      // CR-GC-373: Agenten-Sicht; CR-GC-363: Freshness-Banner, wenn AF-Stamps veraltet sind.
      const gekuerzt = kuerzeAussenring(innen, input.id);
      const legende = gekuerzt.nodes.some((n) => n.description === '…') ? `${KUERZUNGS_LEGENDE}\n` : '';
      const formatE =
        legende +
        withFreshnessBanner(codec.serialize(gekuerzt, { omitProvenance: true })) +
        (rand ? `\n\n${RAND_UEBERSCHRIFT}\n${rand}` : '');
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
