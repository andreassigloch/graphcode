/**
 * harness-import.ts — the IMPORT / SEED / RESEED path (split out of harness.ts by
 * CR-GC-260, the one candidate that CR names for this module).
 *
 * These three operations write the store WITHOUT going through the Apply-Gate: they
 * load an already-materialized graph (the committed SSOT) rather than apply a command
 * batch. That is exactly why they are worth reading on their own — the gate's rules do
 * not run here, so the invariant this path owns is `unverifiedReqs`: a bulk import
 * bypasses R-01, so every REQ without a verify-traced TEST is SURFACED (and, for
 * untrusted input, rejected). CR-GC-203 item 6.
 *
 * What did NOT move, deliberately: the Apply-Gate (`applyMutation`), the store lock (O2)
 * and the write mutex (O3) stay in harness.ts. The gate is governance, not formatting —
 * `reseed()` still calls into this module from INSIDE the O3 mutex, so a reseed can never
 * interleave with a mutate.
 *
 * @author andreas@siglochconsulting
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Graph, GraphNode, GraphEdge, StorageAdapter } from '@sigloch/graph-api-core';
import { elementToNode } from './exporter.js';
import { clearExportPending } from './export-marker.js';

/** Default location of the committed SSOT graph, relative to the repo root. */
export const DEFAULT_GRAPH_JSON = 'docs/graph/graphcode.graph.json';

/** Shape of the materialized OntologyGraph in docs/graph/*.graph.json. */
export interface OntologyJson {
  elements: Array<{ id: string; type: string; name: string; description?: string; [k: string]: unknown }>;
  traces: Array<{ source: string; target: string; type: string; [k: string]: unknown }>;
}

export interface ImportResult {
  nodes: number;
  edges: number;
  unverifiedReqs: string[];
}

/**
 * The narrow slice of the harness this path touches — the store handle, the in-memory
 * working copy and the repo root. Passing it explicitly (instead of the whole harness)
 * keeps the gate out of reach from here by construction.
 */
export interface ImportTarget {
  readonly storage: StorageAdapter;
  readonly repoRoot: string;
  /** The scope's systemId — names the SYS anchor this path ensures (CR-GC-302). */
  readonly systemId: string;
  getGraph(): Graph;
  setGraph(graph: Graph): void;
}

/**
 * Ensure the imported node set carries a SYS anchor (CR-GC-302).
 *
 * The SYS node anchors AF-01..05 (the analysis-freshness stamps live under
 * `SYS.attributes.analysisFreshness.<artifact>.graphVersion`) and
 * `graph_generate`'s intent (read from `SYS.description`). Without one, the AF rules
 * take their vacuous exemption ("nothing to anchor on yet") — a never-performed
 * analysis then looks exactly like a completed one. Code-shaped imports (graphify:
 * FUNC/MOD/FLOW/SCHEMA) never bring a SYS, so the substrate supplies it.
 *
 * ENSURE, never overwrite: any source-supplied SYS — one or several — is returned
 * untouched. Two SYS is a modelling problem the rules report; making it three would
 * not help. The anchor carries no description on purpose: an invented intent would
 * be worse than an empty one, since `graph_generate` reads it as the human's words.
 */
export function ensureSystemNode(nodes: GraphNode[], systemId: string): GraphNode[] {
  if (nodes.some((n) => n.type === 'SYS')) return nodes;
  return [
    ...nodes,
    {
      uid: `SYS-${systemId}`,
      type: 'SYS',
      name: systemId,
      description: '',
      attributes: { status: 'draft' },
    },
  ];
}

/**
 * Import a materialized OntologyGraph (elements/traces) into the store, making
 * the DB the runtime SSOT (REQ-graph-is-ssot / REQ-import-se-ontology).
 * elements → GraphNode (uid=id, type, name, description, attributes=rest),
 * traces   → GraphEdge (sourceId=source, targetId=target, edgeType=type).
 */
export async function importOntologyGraph(
  target: ImportTarget,
  ontology: OntologyJson,
  opts?: { rejectUnverifiedReqs?: boolean },
): Promise<ImportResult> {
  // Single import mapping, shared with scripts/export-graph.mjs (CR-GC-219): flattens the
  // redundant nested `attributes` artifact so the SSOT never carries it.
  // CR-GC-302: the SYS anchor is ensured HERE, on the one choke point every bulk path
  // funnels through (seedFromJsonFile → importOntologyGraph, applyReseed →
  // seedFromJsonFile), so there is no second place to forget it.
  const nodes: GraphNode[] = ensureSystemNode(
    ontology.elements.map((e) => elementToNode(e as Record<string, unknown>)),
    target.systemId,
  );
  const edges: GraphEdge[] = ontology.traces.map((t) => {
    const { source, target, type, ...rest } = t;
    return { sourceId: source, targetId: target, edgeType: type, attributes: rest };
  });

  // REQ-with-test invariant (CR-GC-203 item 6): bulk import bypasses the gate's
  // R-01 check, so a REQ without a verify-traced TEST could enter silently (how
  // the historical unverified REQs landed). SURFACE every such REQ here so the
  // bypass is never silent; `rejectUnverifiedReqs` makes it a hard refusal for
  // untrusted imports. The self-seed loads the already-governed committed graph
  // (spec-green) so it flags nothing — and must NOT reject, or bootstrap would
  // deadlock on any future accrued debt (see bootstrap.ts).
  const verifiedReqs = new Set(edges.filter((e) => e.edgeType === 'verify').map((e) => e.targetId));
  const unverifiedReqs = nodes.filter((n) => n.type === 'REQ' && !verifiedReqs.has(n.uid)).map((n) => n.uid);
  if (opts?.rejectUnverifiedReqs && unverifiedReqs.length > 0) {
    throw new Error(
      `Import rejected: ${unverifiedReqs.length} REQ(s) without a verify-traced TEST ` +
        `(${unverifiedReqs.join(', ')}). Author each REQ together with a concept-level TEST + verify ` +
        `trace — the REQ-with-test invariant holds on every write path (CR-GC-203 item 6).`,
    );
  }

  await target.storage.saveNodes(nodes);
  await target.storage.saveEdges(edges);
  target.setGraph({ nodes, edges });
  return { nodes: nodes.length, edges: edges.length, unverifiedReqs };
}

/** Load + import the materialized graph JSON from `<repoRoot>/docs/graph/`. */
export async function seedFromJsonFile(
  target: ImportTarget,
  relPath = DEFAULT_GRAPH_JSON,
  opts?: { rejectUnverifiedReqs?: boolean },
): Promise<ImportResult> {
  const abs = join(target.repoRoot, relPath);
  const raw = await readFile(abs, 'utf8');
  return importOntologyGraph(target, JSON.parse(raw) as OntologyJson, opts);
}

/**
 * Clear the store IN-PROCESS through the open handle (`deleteNodes` issues
 * `DETACH DELETE`, dropping incident edges with each node — no separate edge wipe),
 * then re-import the committed graph. Replaces the stop-server → `rm .graphcode/kuzu*`
 * → restart dance, which corrupts the store when the file is removed under a live
 * handle. Discards any un-exported gate mutations; pairs with the CR-GC-201 drift
 * warning. The CALLER holds the O3 write mutex — never invoke this bare.
 */
export async function applyReseed(
  target: ImportTarget,
  relPath: string,
): Promise<{ nodes: number; edges: number }> {
  const uids = target.getGraph().nodes.map((n) => n.uid);
  if (uids.length) await target.storage.deleteNodes(uids);
  target.setGraph({ nodes: [], edges: [] });
  const result = await seedFromJsonFile(target, relPath);
  // CR-GC-217: the store now equals the committed snapshot again — clear the
  // drift marker so a post-checkout recall (`git checkout <sha>` + reseed) leaves
  // a clean working state, not a phantom "export pending".
  clearExportPending(target.repoRoot);
  return result;
}
