#!/usr/bin/env node
// Graph → docs re-exporter (CR-GC-113) — the single SSOT sync path.
// REPLACES the retired scripts/seed-graph.mjs.
//
// Renders the live graph back into commit-able docs:
//   docs/views/spec.md · architecture.md · cr-list.md · references.md
//
// EXPORT SOURCE = the IN-MEMORY authoritative graph (the JSON that importGraph
// loads and the gate mutates), NOT a fresh Kuzu reload. Kuzu storage is LOSSY
// for arbitrary attributes (only declared columns persist); reloading it would
// silently drop status/kinds/method/nested-attributes. So we build the Graph
// from the committed SSOT JSON via the exact importGraph mapping, then render.
// Full-attribute Kuzu persistence is a known follow-up.
//
// Logic lives in src/exporter.ts (built to dist/); this runner is thin.
// Manual / CI sync use only. It REFUSES to clobber if anything is off.
//
// Usage: node scripts/export-graph.mjs
// @author andreas@siglochconsulting
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isCanonicalSnapshot,
  exportMarkdown,
  elementToNode,
  MARKDOWN_VIEWS,
  VIEW_FILENAMES,
} from '../dist/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH_JSON = join(REPO_ROOT, 'docs/graph/graphcode.graph.json');
const VIEWS_DIR = join(REPO_ROOT, 'docs/views');

/** elements/traces → nodes/edges via the SHARED import mapping (CR-GC-219, no parallel path). */
function toGraph(ontology) {
  const nodes = (ontology.elements ?? []).map((e) => elementToNode(e));
  const edges = (ontology.traces ?? []).map((t) => {
    const { source, target, type, ...rest } = t;
    return { sourceId: source, targetId: target, edgeType: type, attributes: rest };
  });
  return { nodes, edges };
}

const raw = readFileSync(GRAPH_JSON, 'utf8');
const ontology = JSON.parse(raw);
const graph = toGraph(ontology);

// REFUSE-TO-CLOBBER guard 1: an empty / malformed graph means a broken SSOT —
// rendering empty docs would silently destroy committed views.
if (graph.nodes.length === 0) {
  console.error('\n⛔ export-graph: SSOT graph has 0 elements — refusing to write empty docs.\n');
  process.exit(1);
}

// REFUSE-TO-CLOBBER guard 2: round-trip integrity. exportGraphJson is the exact
// inverse of importGraph; if re-serializing the SSOT is not byte-identical to the
// committed file, the in-memory model and the file disagree — abort rather than
// emit views built from a mismatched graph. Stamp-blind since CR-GC-313: the
// `graphVersion` trailer graph_export writes is metadata about the snapshot, not
// part of the model — the comparison itself stays byte-exact (src/exporter.ts).
if (!isCanonicalSnapshot(raw, graph)) {
  console.error(
    '\n⛔ export-graph: re-export of the SSOT is NOT byte-identical to\n' +
    '   docs/graph/graphcode.graph.json. The graph file is not in canonical\n' +
    '   form (or was hand-edited off-canon). Refusing to render views.\n' +
    '   Fix: canonicalize the JSON, then re-run.\n');
  process.exit(1);
}

mkdirSync(VIEWS_DIR, { recursive: true });
for (const view of MARKDOWN_VIEWS) {
  const md = exportMarkdown(graph, view);
  const out = join(VIEWS_DIR, VIEW_FILENAMES[view]);
  writeFileSync(out, md, 'utf8');
  console.log(`✔ ${view.padEnd(13)} → docs/views/${VIEW_FILENAMES[view]}`);
}
console.log(`\n✔ Rendered ${MARKDOWN_VIEWS.length} views from ${graph.nodes.length} elements / ${graph.edges.length} traces.`);
