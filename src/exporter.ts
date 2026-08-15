/**
 * Graph → Markdown/JSON Re-Exporter (CR-GC-113, MOD-docs).
 *
 * The single SSOT sync path: render the live graph back into commit-able docs.
 * Realizes FUNC-export-markdown / REQ-doc-export / REQ-pre-export-markdown /
 * REQ-post-export-markdown / FUNC-render-views; SCHEMA-markdown-view is the
 * MarkdownView schema below.
 *
 * EXPORT SOURCE = the harness IN-MEMORY authoritative working copy
 * (`harness.getGraph()`), NOT a fresh Kuzu reload.
 *   Kuzu is the durable QUERY INDEX, but its storage is LOSSY for arbitrary
 *   attributes — KuzuAdapter only persists declared property columns
 *   (name/description + declared props), so a raw Kuzu reload drops
 *   status/kinds/method/nested-`attributes`/etc. The full-fidelity graph is the
 *   JSON loaded by `importGraph()` and updated by the gate on every `mutate()`.
 *   Full-attribute Kuzu persistence is a known follow-up.
 *
 * `exportGraphJson` is the exact INVERSE of `GraphCodeHarness.importGraph`:
 *   element = { id: node.uid, type, name, description, ...node.attributes }
 *   trace   = { source: edge.sourceId, target: edge.targetId, type: edge.edgeType, ...edge.attributes }
 * Serialized canonically as `JSON.stringify(obj, null, 2) + "\n"` — the canonical
 * form the graph-integrity safety-net asserts, and byte-identical across calls.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { TestRefsSchema, RealRefSchema, type TestRef, type RealRef } from '@sigloch/contracts/se';
import { renderSrs } from './views/srs.js';
import { renderNfr, renderRtm, renderIcd, renderTestConcept, renderTestMatrix, renderIntPlan } from './views/incose.js';
import { renderChangelog, renderFmea, renderConOps, renderTrade, renderImplPlan } from './views/graphcode.js';

// ---------------------------------------------------------------------------
// SCHEMA-markdown-view — app-specific, NOT in @sigloch/contracts.
// ---------------------------------------------------------------------------

/**
 * MarkdownView (SCHEMA-markdown-view): which generated, human-readable view to
 * render. Each renders deterministically with a GENERATED header.
 *
 * Foundation views (architecture/cr-list/references) mirror FLOW-export-request;
 * CR-GC-220 adds the SE-artifact projections (srs/nfr/rtm/icd/testconcept/
 * testmatrix/intplan/changelog + the render-form of fmea/conops/trade/implplan) so
 * EVERY render-able artifact is a deterministic function of the graph, not an
 * agent-rendered `se-view:*` skill.
 *
 * CR-GC-305 removed the `spec` view (raw dump of every element grouped by type).
 * It answered the same question as `srs` — the ISO-29148 narrative — with different
 * completeness, i.e. two requirements documents and one truth. `srs` is the
 * requirements view; the full element inventory is the graph JSON itself.
 */
// The view CATALOG (which views exist, their order, their filenames) moved to
// @sigloch/graphcode-client (CR-GC-264) so a viewer can list and link the views
// without depending on the exporter — and through it on the store. The RENDERERS
// below stay here. Re-exported so every existing import path keeps working.
import { MARKDOWN_VIEWS, VIEW_FILENAMES, type MarkdownView } from '@sigloch/graphcode-client';

/**
 * The Zod face of the catalog, built HERE from the shared list with graphcode's
 * own zod — the client package stays zod-free so two zod copies can never make
 * these schema types un-assignable.
 */
export const MarkdownViewSchema = z.enum(MARKDOWN_VIEWS);

export { MARKDOWN_VIEWS, VIEW_FILENAMES };
export type { MarkdownView };

// ---------------------------------------------------------------------------
// exportGraphJson — inverse of importGraph, canonical serialization.
// ---------------------------------------------------------------------------

/** Element shape in the materialized OntologyGraph JSON (`id` first, attrs spread). */
function nodeToElement(node: GraphNode): Record<string, unknown> {
  return {
    id: node.uid,
    type: node.type,
    name: node.name,
    description: node.description ?? '',
    // Spread attributes back to top-level, preserving their insertion order so
    // status/created_at/updated_at/kinds/method/nested-attributes land exactly
    // where importGraph put them. Inverse of `{ id, type, name, description, ...rest }`.
    ...node.attributes,
  };
}

/**
 * Flatten the redundant double-nested `attributes` artifact (CR-GC-219). A committed
 * element that carries a literal `attributes` object lands it as `node.attributes.attributes`
 * (the `...rest` spread nests it). This merges that object UP one level — preserving real
 * metadata (operatingMode / constraint / …) as top-level attributes — while
 * DROPPING `level`/`tool` that merely restate one of the element's `testRefs` (redundant), an empty
 * `{}`, and the nesting key itself. Idempotent: an element with no nested `attributes` is
 * returned unchanged, so re-import/export never reintroduces the nesting.
 */
function flattenNestedAttributes(rest: Record<string, unknown>): Record<string, unknown> {
  const nested = rest.attributes;
  if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) return rest;
  const { attributes: _drop, ...top } = rest;
  // CR-GC-338: `testRefs` ist eine Liste — redundant ist ein Wert nur, wenn IRGENDEIN
  // Eintrag ihn schon traegt. Gegen den ersten zu pruefen loeschte bei gemischten Runnern
  // (vitest + playwright) den falschen.
  const testRefs = Array.isArray(top.testRefs) ? (top.testRefs as Record<string, unknown>[]) : [];
  const out: Record<string, unknown> = { ...top };
  for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
    // Drop level/tool that merely restate a runnable binding (testRefs) — redundant.
    if ((k === 'level' || k === 'tool') && testRefs.some((r) => r && r[k] === v)) continue;
    // Flatten up one level; never clobber an existing top-level attribute.
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/**
 * Map a committed OntologyGraph JSON element to a `GraphNode` (the inverse of `nodeToElement`),
 * flattening the nested `attributes` artifact (CR-GC-219). The single import mapping — shared by
 * `harness.importGraph` and `scripts/export-graph.mjs` (no parallel path).
 */
export function elementToNode(e: Record<string, unknown>): GraphNode {
  const { id, type, name, description, ...rest } = e as {
    id: string;
    type: string;
    name?: string;
    description?: string;
    [k: string]: unknown;
  };
  return {
    uid: id,
    type,
    name: name ?? id,
    description: description ?? '',
    attributes: flattenNestedAttributes(rest),
  };
}

/** Trace shape in the materialized OntologyGraph JSON. */
function edgeToTrace(edge: GraphEdge): Record<string, unknown> {
  return {
    source: edge.sourceId,
    target: edge.targetId,
    type: edge.edgeType,
    ...edge.attributes,
  };
}

/**
 * Reconstruct the committed JSON shape `{ elements, traces }` from a Graph and
 * serialize CANONICALLY (`JSON.stringify(obj, null, 2) + "\n"`).
 *
 * DETERMINISTIC and SOURCE-ORDER-INDEPENDENT (REQ-deterministic-serialization R3):
 * elements are sorted by uid, traces by (source, type, target). Attribute key
 * order is preserved by importGraph / the Kuzu `attrs_json` round-trip. This makes
 * the export byte-identical whether the graph came from the committed JSON, the
 * gate's in-memory array, or a reload from the Kuzu SSOT — the precondition for
 * CR-GC-201's provenance check (committed JSON == export(store)).
 */
export function exportGraphJson(graph: Graph): string {
  const elements = [...graph.nodes]
    .sort((a, b) => a.uid.localeCompare(b.uid))
    .map(nodeToElement);
  const traces = [...graph.edges]
    .sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) ||
        a.edgeType.localeCompare(b.edgeType) ||
        a.targetId.localeCompare(b.targetId),
    )
    .map(edgeToTrace);
  return JSON.stringify({ elements, traces }, null, 2) + '\n';
}

/**
 * Is the committed SSOT still in canonical form? (CR-GC-313)
 *
 * The guard behind `scripts/export-graph.mjs`: re-derive the JSON from the graph the
 * committed file describes and compare bytes. A hand-edit off-canon — a changed
 * description, a reordered element, a stray field — makes the two differ, and views
 * must not be rendered from a model the file no longer matches.
 *
 * STAMP-BLIND on purpose. CR-GC-300 added a `graphVersion` trailer at WRITE time in
 * `graph_export`; `exportGraphJson` does not produce it, so a naive byte compare
 * failed on every snapshot written since — the guard rejected healthy SSOTs and the
 * script became unusable. The version is a metadatum ABOUT the snapshot, not part of
 * the model it serializes: it is stripped from both sides before comparing. Making
 * the script stamp along instead was rejected — it holds no store, so it could only
 * mirror the committed number back at itself and would fake a check it cannot do.
 *
 * Everything else stays byte-exact. This relaxes the guard's INPUT, never its verdict.
 */
export function isCanonicalSnapshot(raw: string, graph: Graph): boolean {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false; // unparseable is never canonical
  }
  const { graphVersion: _stamp, ...model } = parsed;
  return JSON.stringify(model, null, 2) + '\n' === exportGraphJson(graph);
}

// ---------------------------------------------------------------------------
// exportMarkdown — deterministic views with a GENERATED header.
// ---------------------------------------------------------------------------

/**
 * Marks a file as machine-generated; do-not-hand-edit. Stable across calls.
 * CR-GC-236: `name` is the export/member name (`graph_export {name}` respectively
 * `scope.systemId`) — title prefix and SSOT path follow it, so a consumer repo's
 * views never claim `graphcode.graph.json` as their source of truth.
 */
export function generatedHeader(name: string, title: string, subtitle: string): string {
  const ssot = `docs/graph/${name}.graph.json`;
  return [
    `<!-- GENERATED by @sigloch/graphcode exportMarkdown — DO NOT HAND-EDIT.`,
    `     Source of truth: ${ssot} (the live graph).`,
    `     Re-render on model change: node scripts/export-graph.mjs -->`,
    ``,
    `# ${name} — ${title}`,
    ``,
    `> GENERATED from \`${ssot}\` (SSOT). ${subtitle}`,
    ``,
  ].join('\n');
}

/** Stable lexicographic comparator on uid. */
export function byUid(a: GraphNode, b: GraphNode): number {
  return a.uid.localeCompare(b.uid);
}

/** A single-line, table-safe rendering of a description (no newlines / pipes). */
export function cell(text: string): string {
  return (text ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim();
}

/** Nodes of the given types, uid-sorted. Internal to this renderer (see views/helpers.ts). */
function nodesOfTypes(graph: Graph, types: string[]): GraphNode[] {
  const set = new Set(types);
  return graph.nodes.filter((n) => set.has(n.type)).sort(byUid);
}

/** Module / function / system structure with allocate edges (the `architecture` view). */
function renderArchitecture(graph: Graph, name: string): string {
  const header = generatedHeader(
    name,
    'Architektur',
    'SYS / MOD / FUNC mit allocate-Zuordnung. Deterministisch generiert.',
  );
  const lines: string[] = [header];

  const structural = nodesOfTypes(graph, ['SYS', 'MOD', 'FUNC']);
  lines.push('## Strukturknoten', '', '| uid | type | name |', '|---|---|---|');
  for (const n of structural) {
    lines.push(`| \`${n.uid}\` | ${n.type} | ${cell(n.name)} |`);
  }
  lines.push('');

  // FUNC -allocate-> MOD assignment, sorted deterministically.
  const allocations = graph.edges
    .filter((e) => e.edgeType === 'allocate')
    .map((e) => ({ s: e.sourceId, t: e.targetId }))
    .sort((a, b) => a.s.localeCompare(b.s) || a.t.localeCompare(b.t));
  lines.push('## Allokation (FUNC -allocate-> MOD)', '', '| function | module |', '|---|---|');
  for (const a of allocations) {
    lines.push(`| \`${a.s}\` | \`${a.t}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

/** CR list (the `cr-list` view): every CR node with status. */
function renderCrList(graph: Graph, name: string): string {
  const header = generatedHeader(
    name,
    'Change-Requests',
    'Alle CR-Knoten, sortiert nach uid. Deterministisch generiert.',
  );
  const crs = nodesOfTypes(graph, ['CR']);
  const lines: string[] = [header];
  lines.push('| uid | name | status | description |', '|---|---|---|---|');
  for (const n of crs) {
    const status = String(n.attributes['status'] ?? '');
    lines.push(`| \`${n.uid}\` | ${cell(n.name)} | ${status} | ${cell(n.description ?? '')} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Traceability references (the `references` view): every trace, sorted. */
function renderReferences(graph: Graph, name: string): string {
  const header = generatedHeader(
    name,
    'Traceability-References',
    'Alle Traces (source -type-> target), deterministisch sortiert.',
  );
  const traces = [...graph.edges]
    .map((e) => ({ s: e.sourceId, t: e.targetId, ty: e.edgeType }))
    .sort((a, b) => a.s.localeCompare(b.s) || a.ty.localeCompare(b.ty) || a.t.localeCompare(b.t));
  const lines: string[] = [header];
  lines.push('| source | type | target |', '|---|---|---|');
  for (const e of traces) {
    lines.push(`| \`${e.s}\` | ${e.ty} | \`${e.t}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Render a deterministic Markdown view of the graph with a GENERATED header.
 * Same (graph, view) → byte-identical output. Ordering is by uid / type / trace
 * key only (no insertion-order dependence). Renders no Mermaid, so the `()`/`|`
 * blank-diagram hazard does not apply; table cells are sanitized regardless.
 */
export function exportMarkdown(graph: Graph, view: MarkdownView, name = 'graphcode'): string {
  const v = MarkdownViewSchema.parse(view);
  switch (v) {
    case 'architecture':
      return renderArchitecture(graph, name);
    case 'cr-list':
      return renderCrList(graph, name);
    case 'references':
      return renderReferences(graph, name);
    case 'srs':
      return renderSrs(graph, name);
    case 'nfr':
      return renderNfr(graph, name);
    case 'rtm':
      return renderRtm(graph, name);
    case 'icd':
      return renderIcd(graph, name);
    case 'testconcept':
      return renderTestConcept(graph, name);
    case 'testmatrix':
      return renderTestMatrix(graph, name);
    case 'intplan':
      return renderIntPlan(graph, name);
    case 'changelog':
      return renderChangelog(graph, name);
    case 'fmea':
      return renderFmea(graph, name);
    case 'conops':
      return renderConOps(graph, name);
    case 'trade':
      return renderTrade(graph, name);
    case 'implplan':
      return renderImplPlan(graph, name);
  }
}

// ---------------------------------------------------------------------------
// Test-stub materialization (CR-GC-205 Item 4) — spec-time scaffolding so a TEST
// testRefs NEVER resolve to a phantom file. A TEST can be bound to a file before
// it is implemented; rendering a minimal `it.todo` stub guarantees the file
// exists (graph_tests → real selective run, no false-green) while vitest reports
// the stub pending (suite stays green). Concept-only TESTs (no run artifact yet)
// are skipped. PURE — returns {file, content} for every bound TEST; the caller
// (graph_export) writes only files that don't already exist and NEVER overwrites.
// ---------------------------------------------------------------------------

/** A runnable stub the export would scaffold for one graph TEST binding. */
export interface TestStub {
  file: string;
  content: string;
}

export function renderTestStubs(graph: Graph): TestStub[] {
  const verifiesByTest = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.edgeType !== 'verify') continue;
    const arr = verifiesByTest.get(e.sourceId) ?? [];
    arr.push(e.targetId);
    verifiesByTest.set(e.sourceId, arr);
  }
  const stubs: TestStub[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'TEST') continue;
    if (node.attributes?.concept === true) continue; // concept-only: no run artifact
    const parsed = TestRefsSchema.safeParse(node.attributes?.testRefs);
    if (!parsed.success) continue; // unbound TEST → R-19 surfaces it, nothing to scaffold
    // CR-GC-338: ein Stub JE EINTRAG — sonst bleibt bei einer Abnahme mit Unit- und
    // Visual-Lauf die zweite Datei ein Phantom, und genau das soll hier nicht passieren.
    for (const ref of parsed.data) {
      stubs.push({ file: ref.file, content: renderStub(node, ref, verifiesByTest.get(node.uid) ?? []) });
    }
  }
  return stubs;
}

// ---------------------------------------------------------------------------
// Schema-stub materialization (BOK-CR-026 §6b) — the SCHEMA arm of the same
// no-phantom-file guarantee the TEST stubs give. R-26 makes `realRef` the single
// SCHEMA binding, but a binding alone still allowed "bound in the graph, nothing
// in the code": nothing ever created the Zod file. Rendering a minimal
// `z.unknown()` export makes the binding resolvable (RC-03/RC-04 see a real
// export instead of a missing file) and leaves an explicit TODO where the real
// contract goes. concept-only / external SCHEMAs are skipped — they are exempt
// from the binding requirement and have no artifact to scaffold. Non-TS
// realizations (`lang` other than ts/tsx/js) are skipped too: a Zod stub would be
// the wrong artifact. PURE — the caller (graph_export) writes only files that do
// not already exist and NEVER overwrites.
// ---------------------------------------------------------------------------

/** A Zod stub the export would scaffold for one graph SCHEMA binding. */
export interface SchemaStub {
  file: string;
  content: string;
}

const TS_LANGS = new Set(['ts', 'tsx', 'js', 'jsx', 'typescript', 'javascript']);

/** Turn a node name/uid into a usable TS identifier for a stub export. */
function stubSymbol(node: GraphNode): string {
  const cleaned = (node.name || node.uid).replace(/[^A-Za-z0-9_$]/g, '');
  const identifier = /^[A-Za-z_$]/.test(cleaned) ? cleaned : `Schema${cleaned}`;
  return identifier.length > 0 ? identifier : 'Schema';
}

export function renderSchemaStubs(graph: Graph): SchemaStub[] {
  const stubs: SchemaStub[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'SCHEMA') continue;
    if (node.attributes?.concept === true || node.attributes?.external === true) continue;
    const parsed = RealRefSchema.safeParse(node.attributes?.realRef);
    if (!parsed.success) continue; // unbound SCHEMA → R-26 surfaces it, nothing to scaffold
    const ref = parsed.data;
    if (ref.lang !== undefined && !TS_LANGS.has(ref.lang)) continue;
    stubs.push({ file: ref.file, content: renderSchemaStub(node, ref) });
  }
  return stubs;
}

function renderSchemaStub(node: GraphNode, ref: RealRef): string {
  const symbol = ref.symbol ?? stubSymbol(node);
  const desc = node.description ? ` ${node.description}` : '';
  return [
    '/**',
    ` * GENERATED STUB (BOK-CR-026) — materialized from the graph binding ${node.uid}.`,
    ` * ${node.name}.${desc}`,
    ' * Replace z.unknown() with the real contract. Until then the SCHEMA realRef',
    ' * resolves to a real export (no phantom path) instead of a missing file.',
    ' */',
    "import { z } from 'zod/v4';",
    '',
    `// TODO(${node.uid}): define the actual shape.`,
    `export const ${symbol} = z.unknown();`,
    `export type ${symbol}Type = z.infer<typeof ${symbol}>;`,
    '',
  ].join('\n');
}

function renderStub(node: GraphNode, ref: TestRef, verifies: string[]): string {
  const label = ref.case ?? `implement ${node.uid}`;
  const verifyNote = verifies.length > 0 ? ` — verifies ${verifies.join(', ')}` : '';
  return [
    '/**',
    ` * GENERATED STUB (CR-GC-205) — materialized from the graph binding ${node.uid}.`,
    ` * ${node.name}${verifyNote}.`,
    ' * Replace it.todo with the real test. Until then graph_tests resolves a real',
    ' * file (no phantom path) and vitest reports it pending, so the suite stays green.',
    ' */',
    "import { describe, it } from 'vitest';",
    '',
    `describe(${JSON.stringify(`${node.uid}: ${node.name}`)}, () => {`,
    `  it.todo(${JSON.stringify(label)});`,
    '});',
    '',
  ].join('\n');
}
