#!/usr/bin/env node
// CR-GC-436 (Spike, Trockenübung) — der Handschnitt als IN-MEMORY-Simulation:
// Ziel-Modulschnitt (8 Module + surface + extern) und code-gedeckte FLOW-Konsolidierungen,
// beide Top-Sichten und die Kohäsion vorher/nachher. KEIN Store, KEIN Gate, KEIN Write —
// reiner Vorschlag; die Züge selbst bräuchten CR-GC-435 (Umhängen = delete+add allocate).
// Usage: node scripts/spike-arch-handschnitt.mjs
// @author andreas@siglochconsulting
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { moduleMetrics } from '@sigloch/contracts/se';
import { buildAdjacency, detectCommunities, modularityOf, modularityQ } from '@sigloch/se-engine';
import { elementToNode } from '../dist/index.js';
import { toOntologyGraph } from '../dist/conformance/conformance.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'docs/graph/graphcode.graph.json'), 'utf8'));

// ── Der Vorschlag ───────────────────────────────────────────────────────────
// Ziel-Module aus CNM-Communities (Q=0.595) + Coder-Zuordnung der realen Dateien.
// skills bleibt BEWUSST ein Modul (Bedienschicht, 25 Markdown-Treiber in EINEM
// Verzeichnis — 0-Kohäsion ist dort Kategorie, kein Defekt).
const REALLOC = {
  // Splitter-Module auflösen (7 FUNC in 5 Mini-MODs):
  'FUNC-emit-trajectory': 'MOD-store',        // src/emit.ts — Hook am Store-Lifecycle
  'FUNC-emit-update-event': 'MOD-store',
  'FUNC-migrate-schema': 'MOD-store',         // Schema-Drift = Store-Belang
  'FUNC-schema-guard': 'MOD-store',
  'FUNC-score-completeness': 'MOD-metrics-engine', // external, zur externen Mess-Familie
  'FUNC-check-code-conformance': 'MOD-gate',  // src/conformance.ts — Regel-Auswertung
  'FUNC-list-elements': 'MOD-mcp-tools',      // src/element-slice.ts — ein Read-Tool

  // host-bridge → live (Dashboard/SSE als EIN Modul, src/viewer/host.ts + host-shim.ts):
  'FUNC-broadcast-diff': 'MOD-live', 'FUNC-health-endpoint': 'MOD-live',
  'FUNC-own-kuzu-host': 'MOD-live', 'FUNC-serve-sse': 'MOD-live', 'FUNC-host-socket': 'MOD-live',
  'FUNC-block-live-dashboard': 'MOD-live', 'FUNC-block-schaufenster': 'MOD-live',

  // repo-root-Blöcke: ins Modul ihrer Kinder-Mehrheit (Blöcke sind Rollups, keine Bewohner):
  'FUNC-block-speicherwerk': 'MOD-store', 'FUNC-block-gedaechtnis': 'MOD-codec',
  'FUNC-block-gate': 'MOD-gate', 'FUNC-block-messwerk': 'MOD-steering',
  'FUNC-block-anschluss': 'MOD-mcp-tools', 'FUNC-block-ruestzeug': 'MOD-mcp-tools',
  'FUNC-block-betrieb': 'MOD-cli', 'FUNC-block-antrieb': 'MOD-executor',

  // Umbenennung nur im Kopf: MOD-harness → MOD-store (Lifecycle) + MOD-gate (mutate/rules).
  'FUNC-mutate': 'MOD-gate', 'FUNC-evaluate-rules': 'MOD-gate', 'FUNC-load-config': 'MOD-gate',
  'FUNC-fit-advisory': 'MOD-gate', 'FUNC-preflight': 'MOD-gate', 'FUNC-tool-context': 'MOD-mcp-tools',
  'FUNC-graph-suggest': 'MOD-steering',
};
const RENAME = { 'MOD-harness': 'MOD-store', 'MOD-docs': 'MOD-views', 'MOD-skills': 'MOD-agent-surface' };

// FLOW-Konsolidierungen, die dem CODE folgen (bestehende Typen bündeln bereits):
const FLOW_MERGE = {
  // SteeringSnapshot (src/steering-snapshot.ts) bündelt og+violations+report in EINEM Wert:
  'FLOW-measurement-vector': 'FLOW-steering-snapshot',
  'FLOW-arch-fitness': 'FLOW-steering-snapshot',
  'FLOW-dimension-readiness': 'FLOW-steering-snapshot',
  'FLOW-phase-readiness': 'FLOW-steering-snapshot',
  // MutateResult trägt fitAdvisory + steeringDelta als Felder (contracts/harness):
  'FLOW-fit-advisory': 'FLOW-gate-verdict',
  'FLOW-steering-delta': 'FLOW-gate-verdict',
  // Graph-als-Wert: ein Typ (Graph) — Snapshot ist kein zweiter Datenvertrag:
  'FLOW-graph-snapshot': 'FLOW-graph-state',
};

// ── Basis laden, Vorschlag anwenden (nur in-memory) ────────────────────────
function buildGraph(apply) {
  const nodes = raw.elements
    .filter((e) => !(apply && FLOW_MERGE[e.id]))
    .map((e) => elementToNode(RENAME[e.id] && apply ? { ...e, id: e.id } : e));
  const seen = new Set();
  const edges = [];
  for (const t of raw.traces) {
    let { source, target, type } = t;
    if (apply) {
      if (FLOW_MERGE[source]) source = FLOW_MERGE[source];
      if (FLOW_MERGE[target]) target = FLOW_MERGE[target];
      if (type === 'allocate' && REALLOC[source]) target = REALLOC[source];
      if (type === 'allocate') target = RENAME[target] ?? target;
    }
    const k = `${source}>${type}>${target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({ sourceId: source, targetId: target, edgeType: type, attributes: {} });
  }
  if (apply) for (const n of nodes) if (RENAME[n.uid]) n.uid = RENAME[n.uid];
  // allocate-Ziele, die es als MOD noch nicht gibt (MOD-store etc. via RENAME abgedeckt;
  // MOD-live/MOD-gate neu): als MOD-Knoten ergänzen.
  const have = new Set(nodes.map((n) => n.uid));
  for (const e of edges) if (e.edgeType === 'allocate' && !have.has(e.targetId)) {
    nodes.push({ uid: e.targetId, type: 'MOD', name: e.targetId.replace('MOD-', ''), description: 'Spike-Zielmodul (Vorschlag)', attributes: {} });
    have.add(e.targetId);
  }
  return { nodes, edges };
}

function measure(graph, label) {
  const type = new Map(graph.nodes.map((n) => [n.uid, n.type]));
  const parent = new Map();
  for (const e of graph.edges) if (e.edgeType === 'compose' && type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FUNC') parent.set(e.targetId, e.sourceId);
  const top = (id) => { let x = id; while (parent.has(x)) x = parent.get(x); return x; };
  const prod = new Map(), cons = new Map();
  for (const e of graph.edges.filter((e) => e.edgeType === 'io')) {
    if (type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FLOW') (prod.get(e.targetId) ?? prod.set(e.targetId, []).get(e.targetId)).push(e.sourceId);
    if (type.get(e.sourceId) === 'FLOW' && type.get(e.targetId) === 'FUNC') (cons.get(e.sourceId) ?? cons.set(e.sourceId, []).get(e.sourceId)).push(e.targetId);
  }
  const alloc = new Map();
  for (const e of graph.edges.filter((e) => e.edgeType === 'allocate' && type.get(e.sourceId) === 'FUNC')) alloc.set(e.sourceId, e.targetId);
  const modOf = (f) => alloc.get(f) ?? alloc.get(top(f));
  const pairs = [];
  for (const [fl, cc] of cons) for (const c of cc) for (const p of prod.get(fl) ?? []) if (p !== c) pairs.push({ p, c, fl });
  const intra = pairs.filter((x) => modOf(x.p) && modOf(x.p) === modOf(x.c)).length;
  const topPairs = new Map();
  for (const { p, c, fl } of pairs) { const a = top(p), b = top(c); if (a === b) continue; const k = `${a}>${b}`; (topPairs.get(k) ?? topPairs.set(k, new Set()).get(k)).add(fl); }
  const modPairs = new Map();
  for (const { p, c, fl } of pairs) { const a = modOf(p), b = modOf(c); if (!a || !b || a === b) continue; const k = `${a}>${b}`; (modPairs.get(k) ?? modPairs.set(k, new Set()).get(k)).add(fl); }
  const inst = (m) => [...m.values()].reduce((a, s) => a + s.size, 0);
  const bidir = (m) => [...m.keys()].filter((k) => m.has(k.split('>').reverse().join('>'))).length / 2;
  const par = (m) => [...m.values()].filter((s) => s.size > 1).reduce((a, s) => a + s.size - 1, 0);
  const og = toOntologyGraph(graph);
  const adj = buildAdjacency(og);
  const decl = new Map(); { let i = 0; const idx = new Map(); for (const [f, m] of alloc) { if (!idx.has(m)) idx.set(m, i++); decl.set(f, idx.get(m)); } }
  const qDecl = modularityOf(adj, new Map([...detectCommunities(adj).keys()].map((k) => [k, decl.get(k) ?? -1])));
  const mm = moduleMetrics(og).filter((m) => m.cohesion);
  const nulls = mm.filter((m) => m.cohesion.internal === 0).length;
  console.log(`\n== ${label}`);
  console.log(`Blatt: ${pairs.length} Verbindungen, intern ${intra} (${(100 * intra / pairs.length).toFixed(1)} %) · Q(deklariert)=${qDecl.toFixed(3)} (CNM-Referenz ${modularityQ(adj).toFixed(3)})`);
  console.log(`Sicht 1 (Blöcke): ${topPairs.size} Kanten / ${inst(topPairs)} Instanzen · bidirektional ${bidir(topPairs)} · parallel-überzählig ${par(topPairs)}`);
  console.log(`Sicht 2 (MOD):    ${modPairs.size} Kanten / ${inst(modPairs)} Instanzen · Paare ${new Set([...modPairs.keys()].map((k) => k.split('>').sort().join('~'))).size} · bidirektional ${bidir(modPairs)} · parallel-überzählig ${par(modPairs)}`);
  console.log(`Module mit Kohäsion: ${mm.length}, davon 0-intern: ${nulls}`);
  for (const m of mm) console.log(`   ${m.moduleId.padEnd(20)} FUNCs ${String(m.allocatedFuncs).padStart(2)} · int ${String(m.cohesion.internal).padStart(2)} / ext ${String(m.cohesion.external).padStart(3)} / ratio ${m.cohesion.ratio.toFixed(2)}`);
  return { pairs: pairs.length, intra };
}

measure(buildGraph(false), 'VORHER (graphVersion ' + raw.graphVersion + ')');
measure(buildGraph(true), 'NACHHER (Handschnitt-Vorschlag, in-memory)');
