#!/usr/bin/env node
// CR-GC-436 Nachtrag (Trockenübung 2) — der REGELKREIS-Schnitt als IN-MEMORY-Simulation:
// 5 Zielmodule (kernel · projections · loop · surface · agent-surface), FLOW-Konsolidierung
// auf die 5 tragenden Verträge (Command/Verdict/Event/Snapshot/Slice) + Graph-als-Wert,
// SCHEMA-Konsolidierung analog. KEIN Store, KEIN Gate, KEIN Write — reiner Vorschlag.
// Unterschied zum Handschnitt (spike-arch-handschnitt.mjs): dort wurde die Partition
// optimiert, hier werden erst die KANTEN geändert (Verträge), dann geschnitten.
// Usage: node scripts/spike-arch-regelkreis.mjs
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

// ── Zielmodule (Regelkreis): jede der 107 FUNCs bekommt genau eine der 5 Rollen ──
const M = {
  kernel: [ // Store + Gate + Regeln + OpLog + Query-Port — die zwei Ports apply()/query()
    'FUNC-mutate', 'FUNC-evaluate-rules', 'FUNC-load-config', 'FUNC-preflight',
    'FUNC-save-graph', 'FUNC-load-graph', 'FUNC-open-store', 'FUNC-close-store',
    'FUNC-claim-store-lock', 'FUNC-create-harness', 'FUNC-import', 'FUNC-seed-from-json',
    'FUNC-reseed', 'FUNC-apply-reseed', 'FUNC-merge-nodes', 'FUNC-migrate-schema',
    'FUNC-schema-guard', 'FUNC-bootstrap', 'FUNC-graph-impact', 'FUNC-graph-expand',
    'FUNC-list-elements', 'FUNC-resolve-tests-from-code', 'FUNC-deduce-tests',
    'FUNC-block-gate', 'FUNC-block-speicherwerk',
  ],
  projections: [ // pure Committed-Graph → X, Subscriber des Commit-Events
    'FUNC-take-steering-snapshot', 'FUNC-compute-readiness', 'FUNC-compute-phase-readiness',
    'FUNC-score-completeness', 'FUNC-compute-steering-delta', 'FUNC-fit-advisory',
    'FUNC-nd-similarity', 'FUNC-module-metrics', 'FUNC-arch-fitness',
    'FUNC-check-code-conformance', 'FUNC-encode', 'FUNC-decode', 'FUNC-export-markdown',
    'FUNC-graph-export-snapshot', 'FUNC-auto-export', 'FUNC-export-marker',
    'FUNC-emit-trajectory', 'FUNC-emit-update-event',
    'FUNC-block-messwerk', 'FUNC-block-gedaechtnis', 'FUNC-block-dokumentenwerk',
  ],
  loop: [ // der Autopilot als CLIENT des Kernels: Snapshot rein, Commands raus
    'FUNC-goal-steerer', 'FUNC-block-arch-optimierung', 'FUNC-block-q-improvement',
    'FUNC-block-se-steuerung', 'FUNC-generation-step', 'FUNC-next-step',
    'FUNC-rank-candidates', 'FUNC-graph-suggest', 'FUNC-target-profile-load',
    'FUNC-run-executor', 'FUNC-build-round-injection', 'FUNC-extract-mutate',
    'FUNC-block-antrieb',
  ],
  surface: [ // Adapter auf dieselben zwei Ports + Event-Stream: MCP, CLI, Host, Viewer
    'FUNC-cli-dispatch', 'FUNC-harness-cli', 'FUNC-upgrade', 'FUNC-collect-status',
    'FUNC-session-shutdown', 'FUNC-gve-supervise', 'FUNC-gve-sessions',
    'FUNC-import-code-verb', 'FUNC-rewind', 'FUNC-run-verb', 'FUNC-serve-stdio',
    'FUNC-bind-tools', 'FUNC-tool-context', 'FUNC-host-socket', 'FUNC-own-kuzu-host',
    'FUNC-serve-sse', 'FUNC-health-endpoint', 'FUNC-broadcast-diff',
    'FUNC-block-live-dashboard', 'FUNC-block-schaufenster', 'FUNC-block-anschluss',
    'FUNC-block-betrieb', 'FUNC-block-ruestzeug',
  ],
  'agent-surface': [ // die 25 Markdown-Treiber — Bedienschicht, bewusst eigenes Modul
    'FUNC-author-req', 'FUNC-author-uc', 'FUNC-close-violations', 'FUNC-import-code',
    'FUNC-import-doc', 'FUNC-render-views', 'FUNC-se-conops', 'FUNC-se-fmea',
    'FUNC-se-generate', 'FUNC-se-help', 'FUNC-se-irr', 'FUNC-se-plan', 'FUNC-se-retro',
    'FUNC-se-review', 'FUNC-se-status', 'FUNC-se-trade', 'FUNC-target-profile',
    'FUNC-test', 'FUNC-test-ui', 'FUNC-view-changelog', 'FUNC-view-conops',
    'FUNC-view-fmea', 'FUNC-view-icd', 'FUNC-view-intplan', 'FUNC-view-rtm',
  ],
};
const REALLOC = {};
for (const [mod, funcs] of Object.entries(M)) for (const f of funcs) REALLOC[f] = `MOD-${mod}`;

// ── FLOW-Konsolidierung: die 5 tragenden Verträge + Graph-als-Wert + Kleinbündel ──
const FLOW_MERGE = {
  // COMMAND — jede Schreibabsicht ist ein MutateCommand-Batch:
  'FLOW-suggested-edit': 'FLOW-mutate-cmd', 'FLOW-formatE-candidates': 'FLOW-mutate-cmd',
  'FLOW-action': 'FLOW-mutate-cmd',
  // VERDICT — MutateResult trägt Violations, FitAdvisory, SteeringDelta als Felder (contracts):
  'FLOW-violations': 'FLOW-gate-verdict', 'FLOW-fit-advisory': 'FLOW-gate-verdict',
  'FLOW-steering-delta': 'FLOW-gate-verdict', 'FLOW-bootstrap-result': 'FLOW-gate-verdict',
  // SNAPSHOT — der EINE Messpfad; alles Weitere ist Projektion desselben Werts:
  'FLOW-measurement-vector': 'FLOW-steering-snapshot', 'FLOW-arch-fitness': 'FLOW-steering-snapshot',
  'FLOW-dimension-readiness': 'FLOW-steering-snapshot', 'FLOW-phase-readiness': 'FLOW-steering-snapshot',
  'FLOW-completeness': 'FLOW-steering-snapshot', 'FLOW-module-metrics': 'FLOW-steering-snapshot',
  'FLOW-round-findings': 'FLOW-steering-snapshot',
  // GRAPH-ALS-WERT — draft/committed/recalled/merged/… sind Zustände EINES Typs,
  // und draft verlässt den Kernel nie (kein Modulrand-Vertrag mehr):
  'FLOW-graph-snapshot': 'FLOW-graph-state', 'FLOW-committed-graph': 'FLOW-graph-state',
  'FLOW-draft-graph': 'FLOW-graph-state', 'FLOW-recalled-state': 'FLOW-graph-state',
  'FLOW-merged-graph': 'FLOW-graph-state', 'FLOW-migrated-graph': 'FLOW-graph-state',
  'FLOW-parsed-graph': 'FLOW-graph-state', 'FLOW-capture-draft': 'FLOW-graph-state',
  'FLOW-branch-graphs': 'FLOW-graph-state',
  // SLICE — jede Query-Antwort ist eine Format-E-Scheibe:
  'FLOW-expanded-subgraph': 'FLOW-impact-subgraph', 'FLOW-element-slice': 'FLOW-impact-subgraph',
  'FLOW-impacted-tests': 'FLOW-impact-subgraph',
  // QUERY — ein TypedQuery-Vertrag statt vier Request-Formen:
  'FLOW-expand-request': 'FLOW-query-request', 'FLOW-export-request': 'FLOW-query-request',
  'FLOW-view-request': 'FLOW-query-request',
  // EVENT — der Viewer-Strom IST der versionierte Update-Event-Strom:
  'FLOW-viewer-stream': 'FLOW-live-event',
  // Kleinbündel, die dem Code folgen:
  'FLOW-bulk-formatE': 'FLOW-formatE-artifact',     // ein Format-E-Vertrag
  'FLOW-rendered-view': 'FLOW-markdown-docs',       // eine generierte View-Form
  'FLOW-authoring-request': 'FLOW-skill-request',   // ein Skill-Aufruf-Vertrag
  'FLOW-round-injection': 'FLOW-round-prompt',      // ein Runden-Kontext
  'FLOW-round-scope': 'FLOW-round-prompt',
};

// ── SCHEMA-Konsolidierung (die Datenverträge zu den gemergten FLOWs) ──
const SCHEMA_MERGE = {
  'SCHEMA-measurement-vector': 'SCHEMA-steering-snapshot',
  'SCHEMA-module-metrics': 'SCHEMA-steering-snapshot',
  'SCHEMA-action': 'SCHEMA-mutate-command',
  'SCHEMA-fit-advisory': 'SCHEMA-mutate-result',      // heute schon Feld von MutateResult
  'SCHEMA-steering-delta': 'SCHEMA-mutate-result',    // heute schon Feld von MutateResult
  'SCHEMA-phase-readiness': 'SCHEMA-readiness-report',
  'SCHEMA-completeness': 'SCHEMA-readiness-report',
  'SCHEMA-impacted-tests': 'SCHEMA-test-selection',   // Übergabe wird kernel-intern
};

// ── Basis laden, Vorschlag anwenden (nur in-memory) ────────────────────────
const MERGE = { ...FLOW_MERGE, ...SCHEMA_MERGE };
function buildGraph(apply) {
  const nodes = raw.elements
    .filter((e) => !(apply && MERGE[e.id]))
    .map(elementToNode);
  const seen = new Set();
  const edges = [];
  for (const t of raw.traces) {
    let { source, target, type } = t;
    if (apply) {
      if (MERGE[source]) source = MERGE[source];
      if (MERGE[target]) target = MERGE[target];
      if (type === 'allocate' && REALLOC[source]) target = REALLOC[source];
    }
    if (source === target) continue;
    const k = `${source}>${type}>${target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({ sourceId: source, targetId: target, edgeType: type, attributes: {} });
  }
  if (apply) {
    const have = new Set(nodes.map((n) => n.uid));
    for (const e of edges) if (e.edgeType === 'allocate' && !have.has(e.targetId)) {
      nodes.push({ uid: e.targetId, type: 'MOD', name: e.targetId.replace('MOD-', ''), description: 'Regelkreis-Zielmodul (Vorschlag)', attributes: {} });
      have.add(e.targetId);
    }
    // Alt-MODs ohne verbliebene allocate-Kante fallen weg (kein Geisterschnitt):
    const usedMods = new Set(edges.filter((e) => e.edgeType === 'allocate').map((e) => e.targetId));
    const keep = new Set(nodes.filter((n) => n.type !== 'MOD' || usedMods.has(n.uid)).map((n) => n.uid));
    const nodes2 = nodes.filter((n) => keep.has(n.uid));
    const edges2 = edges.filter((e) => keep.has(e.sourceId) && keep.has(e.targetId));
    return { nodes: nodes2, edges: edges2 };
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
  const flows = graph.nodes.filter((n) => n.type === 'FLOW').length;
  const schemas = graph.nodes.filter((n) => n.type === 'SCHEMA').length;
  const mods = graph.nodes.filter((n) => n.type === 'MOD').length;
  console.log(`\n== ${label}`);
  console.log(`Bestand: ${mods} MODs · ${flows} FLOWs · ${schemas} SCHEMAs`);
  console.log(`Blatt: ${pairs.length} Verbindungen, intern ${intra} (${(100 * intra / pairs.length).toFixed(1)} %) · Q(deklariert)=${qDecl.toFixed(3)} (CNM-Referenz ${modularityQ(adj).toFixed(3)})`);
  console.log(`Sicht 1 (Blöcke): ${topPairs.size} Kanten / ${inst(topPairs)} Instanzen · bidirektional ${bidir(topPairs)} · parallel-überzählig ${par(topPairs)}`);
  console.log(`Sicht 2 (MOD):    ${modPairs.size} Kanten / ${inst(modPairs)} Instanzen · Paare ${new Set([...modPairs.keys()].map((k) => k.split('>').sort().join('~'))).size} · bidirektional ${bidir(modPairs)} · parallel-überzählig ${par(modPairs)}`);
  console.log(`Module mit Kohäsion: ${mm.length}, davon 0-intern: ${nulls}`);
  for (const m of mm) console.log(`   ${m.moduleId.padEnd(22)} FUNCs ${String(m.allocatedFuncs).padStart(2)} · int ${String(m.cohesion.internal).padStart(3)} / ext ${String(m.cohesion.external).padStart(3)} / ratio ${m.cohesion.ratio.toFixed(2)}`);
  // Die dicken Pfeile: welcher Vertrag trägt wie viele Modulrand-Querungen?
  const perFlow = new Map();
  for (const { p, c, fl } of pairs) { const a = modOf(p), b = modOf(c); if (!a || !b || a === b) continue; (perFlow.get(fl) ?? perFlow.set(fl, 0)); perFlow.set(fl, perFlow.get(fl) + 1); }
  const topFlows = [...perFlow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`Modulrand-Verkehr je FLOW (Top): ${topFlows.map(([f, n]) => `${f.replace('FLOW-', '')} ×${n}`).join(' · ')}`);
  // Kandidat für die fehlende Dimension: Vokabular + Konzentration am Modulrand
  const crossTotal = [...perFlow.values()].reduce((a, b) => a + b, 0);
  const top5 = [...perFlow.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  console.log(`Modulrand-Vokabular: ${perFlow.size} verschiedene FLOWs queren Grenzen · Top-5-Konzentration ${(100 * top5 / crossTotal).toFixed(1)} %`);
  return { pairs: pairs.length, intra };
}

measure(buildGraph(false), 'VORHER (graphVersion ' + raw.graphVersion + ')');
measure(buildGraph(true), 'NACHHER (Regelkreis: 5 Module + 5 Verträge, in-memory)');
console.log(`\nKonsolidierung: ${Object.keys(FLOW_MERGE).length} FLOWs gemergt (62 → ${62 - Object.keys(FLOW_MERGE).length}) · ${Object.keys(SCHEMA_MERGE).length} SCHEMAs gemergt (30 → ${30 - Object.keys(SCHEMA_MERGE).length})`);
