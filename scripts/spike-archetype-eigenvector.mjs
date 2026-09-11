#!/usr/bin/env node
// CR-GC-438 (Spike, Trockenübung) — ist „Vertragskonzentration" (D7) eine EIGENSTÄNDIGE
// 7. Dimension neben den R⁶, oder eine Linearkombination davon?
//
// Nur lesend: liest die Familie-Graphen als JSON, misst R⁶ (se-engine `metrics`, layer 'arch')
// und D7 (Zählbasis SCHEMA, nicht FLOW-Label), rechnet die Regression D7 ~ R⁶ und die
// Anti-Gaming-Probe. KEIN Store, KEIN Gate, KEIN Write, kein Kuzu.
//
// Usage: node scripts/spike-archetype-eigenvector.mjs [--json]
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { evaluateAllRules, cr01CrossingFlowCount, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

const DEV = '/Users/andreas/Developer/dev';
const PROD = '/Users/andreas/Developer/prod';
const JSON_OUT = process.argv.includes('--json');

// ── Kandidaten: alle Familie-Graphen, die als exportierter SSOT auf Platte liegen ──────
// `note` = Vorbehalt, der im Ergebnis mitgeführt wird (nicht ersetzt, nicht umgangen).
const CANDIDATES = [
  { id: 'graphcode', path: `${DEV}/graphcode/docs/graph/graphcode.graph.json`, pattern: 'Kernel' },
  { id: 'sigloch-modules', path: `${DEV}/sigloch-modules/docs/graph/sigloch-modules.graph.json`, pattern: 'Föderiert' },
  { id: 'graphcodedemo', path: `${PROD}/graphcodedemo/docs/graph/graphcodedemo.graph.json`, pattern: 'Föderiert' },
  {
    id: 'sirail', path: `${DEV}/sirail/docs/graph/sirail.graph.json`, pattern: 'Layered',
    note: 'Store/SSOT divergent — .graphcode/EXPORT_PENDING seit 2026-08-18; gemessen wird der STALE Export, nicht der Live-Store',
  },
  { id: 'moneyflow', path: `${DEV}/moneyflow/docs/graph/moneyflow.graph.json`, pattern: 'Layered' },
  { id: 'siconizer', path: `${DEV}/siconizer/docs/graph/siconizer.graph.json`, pattern: 'Pipeline' },
  { id: 'graph-view-edit', path: `${DEV}/graph-view-edit/docs/graph/graph-view-edit.graph.json`, pattern: 'Layered' },
  { id: 'gc_test-graphview', path: `${DEV}/gc_test-graphview/docs/graph/gc_test-graphview.graph.json`, pattern: 'Layered' },
  { id: 'gc_test-sqlite', path: `${DEV}/gc_test-sqlite/docs/graph/gc_test-sqlite.graph.json`, pattern: 'Kernel' },
  {
    id: 'aimpro-familie', path: `${DEV}/aimpro/docs/spike/familie.graph.json`, pattern: 'Föderiert',
    note: 'historisch — aimpro ist 2026-08-22 aus der Familie ausgetreten; der Graph ist der letzte Familie-Stand',
  },
  // Sekundär (synthetisch, Greenfield-Rig) — nur in der Sensitivitäts-Regression:
  { id: 'greenfield-trial', path: `${DEV}/greenfield-trial/docs/graph/greenfield-trial.graph.json`, pattern: 'Layered', secondary: true },
  { id: 'gve-sandbox', path: `${DEV}/graph-view-edit-sandbox/docs/graph/graph-view-edit.graph.json`, pattern: 'Layered', secondary: true },
  // Ausdrücklich mitgeführt, damit der Ausschluss BENANNT wird statt zu verschwinden:
  {
    id: 'kadjar', path: `${DEV}/graph-view-edit/docs/graph/kadjar.graph.json`, pattern: '—',
    // CR-SM-285: der Vorbehalt ist erledigt. `descriptionOf` las `el.description ?? ''` und starb
    // an jedem Nicht-String; jetzt zaehlt nur ein echter String. kadjar laeuft mit 1509 Befunden
    // durch. Der Hinweis bleibt als Historie stehen, damit die Zeile nicht ohne Grund verschwindet.
    note: 'BQ-06-Crash behoben mit CR-SM-285 (descriptionOf robust gegen Nicht-Strings) — laeuft durch',
  },
  { id: 'bok', path: `${DEV}/bok/docs/graph/bok.graph.json`, pattern: '—' },
  { id: 'graphify', path: `${DEV}/graphify/docs/graph/graphify.graph.json`, pattern: 'Pipeline' },
];

// ── Graph-Mechanik ─────────────────────────────────────────────────────────────────────
function index(g) {
  const type = new Map(g.elements.map((e) => [e.id, e.type]));
  const parent = new Map(); // FUNC-Block → Kind (compose): Kind erbt das Modul des Blocks
  for (const t of g.traces)
    if (t.type === 'compose' && type.get(t.source) === 'FUNC' && type.get(t.target) === 'FUNC')
      parent.set(t.target, t.source);
  const top = (id) => { let x = id, n = 0; while (parent.has(x) && n++ < 50) x = parent.get(x); return x; };
  const alloc = new Map();
  for (const t of g.traces)
    if (t.type === 'allocate' && type.get(t.source) === 'FUNC') alloc.set(t.source, t.target);
  const modOf = (f) => alloc.get(f) ?? alloc.get(top(f));
  // FLOW → Set<SCHEMA>  (Grammatik: FLOW -relation-> SCHEMA [1..1]; >1 = R-18-Verstoß)
  const schemaOf = new Map();
  for (const t of g.traces)
    if (t.type === 'relation' && type.get(t.source) === 'FLOW' && type.get(t.target) === 'SCHEMA')
      (schemaOf.get(t.source) ?? schemaOf.set(t.source, new Set()).get(t.source)).add(t.target);
  const prod = new Map(), cons = new Map();
  for (const t of g.traces) {
    if (t.type !== 'io') continue;
    if (type.get(t.source) === 'FUNC' && type.get(t.target) === 'FLOW')
      (prod.get(t.target) ?? prod.set(t.target, []).get(t.target)).push(t.source);
    if (type.get(t.source) === 'FLOW' && type.get(t.target) === 'FUNC')
      (cons.get(t.source) ?? cons.set(t.source, []).get(t.source)).push(t.target);
  }
  return { type, top, alloc, modOf, schemaOf, prod, cons };
}

/**
 * D7 — Vertragskonzentration am Modulrand. Zwei orthogonale Achsen:
 *
 * `count` = **was** ein Vertrag ist:
 *   'schema' — das SCHEMA des FLOWs (die vom CR verlangte Zählbasis; ein FLOW-Label-Merge
 *              ohne Vertrags-Merge darf das Vokabular nicht schrumpfen). FLOWs ohne SCHEMA
 *              zählen als je eigener, UNBENANNTER Vertrag: ein untypisierter Randfluss ist
 *              kein gebündelter Vertrag, sondern ein fehlender.
 *   'flow'   — das FLOW-Label. Nur als Gaming-Referenz, nicht als Kennzahl.
 *
 * `traffic` = **wie** Randverkehr gezählt wird:
 *   'pair' — je (Produzent p, FLOW f, Konsument c) mit modul(p) ≠ modul(c). Die Zählweise
 *            aus CR-436 — hub-empfindlich: ein FLOW-Merge multipliziert Produzenten×Konsumenten
 *            (CR-436 Befund 3), ohne dass im Code Kopplung entsteht.
 *   'edge' — je io-KANTE an einem Randfluss, mit 1/|SCHEMAs| gewichtet. Invariant gegen den
 *            Produkt-Effekt: ein Merge erhält die Kantenzahl. Das ist die empfohlene Basis.
 *
 * V     = Zahl verschiedener Verträge am Rand (Modulrand-Vokabular)
 * C5    = Anteil der 5 schwersten Verträge am Randverkehr (Top-k-Konzentration, k=5)
 * Neff  = exp(Shannon-Entropie) = effektive Zahl der Randverträge
 * D7    = 5·(1 − (Neff−1)/max(1, X−1))  ∈ [0,5]; 5 = alles über EINEN Vertrag,
 *         0 = jede Querung ihr eigener Vertrag. Normiert gegen X, damit große Systeme
 *         nicht automatisch „konzentriert" aussehen.
 */
function d7(g, { count = 'schema', traffic = 'pair' } = {}) {
  const ix = index(g);
  const counts = new Map();
  let X = 0, unbound = 0;
  const contractsOf = (flow) => {
    if (count === 'flow') return [flow];
    const s = [...(ix.schemaOf.get(flow) ?? [])];
    return s.length ? s : [`UNBOUND:${flow}`];
  };
  const bump = (k, w) => {
    counts.set(k, (counts.get(k) ?? 0) + w);
    X += w;
    if (k.startsWith('UNBOUND:')) unbound += w;
  };
  for (const [flow, consumers] of ix.cons) {
    const producers = ix.prod.get(flow) ?? [];
    const contracts = contractsOf(flow);
    if (traffic === 'edge') {
      // Randfluss = Produzenten und Konsumenten liegen in ≥ 2 verschiedenen Modulen
      const mods = new Set([...producers, ...consumers].map(ix.modOf).filter(Boolean));
      if (mods.size < 2) continue;
      const edges = [...producers, ...consumers].filter((f) => ix.modOf(f)).length;
      for (const k of contracts) bump(k, edges / contracts.length);
      continue;
    }
    for (const c of consumers) {
      const mc = ix.modOf(c);
      if (!mc) continue;
      for (const p of producers) {
        if (p === c) continue;
        const mp = ix.modOf(p);
        if (!mp || mp === mc) continue;
        for (const k of contracts) bump(k, 1);
      }
    }
  }
  const vals = [...counts.values()].sort((a, b) => b - a);
  const V = vals.length;
  if (!X || !V) return { X: 0, V: 0, C5: null, Neff: null, D7: null, unboundShare: null };
  const C5 = vals.slice(0, 5).reduce((a, b) => a + b, 0) / X;
  const H = -vals.reduce((a, n) => a + (n / X) * Math.log(n / X), 0);
  const Neff = Math.exp(H);
  const D7 = 5 * (1 - (Neff - 1) / Math.max(1, X - 1));
  return { X, V, C5, Neff, D7, unboundShare: unbound / X };
}

/** Warum ein Graph keinen messbaren Modulrand hat — benennen statt ersetzen. */
function whyUnmeasurable(g) {
  const type = new Map(g.elements.map((e) => [e.id, e.type]));
  const io = g.traces.filter((t) => t.type === 'io');
  const f2f = io.filter((t) => type.get(t.source) === 'FUNC' && type.get(t.target) === 'FLOW').length;
  const fl2f = io.filter((t) => type.get(t.source) === 'FLOW' && type.get(t.target) === 'FUNC').length;
  const alloc = g.traces.filter((t) => t.type === 'allocate' && type.get(t.source) === 'FUNC').length;
  const cnt = (t) => g.elements.filter((e) => e.type === t).length;
  const parts = [`MOD ${cnt('MOD')} · FUNC ${cnt('FUNC')} · FLOW ${cnt('FLOW')} · SCHEMA ${cnt('SCHEMA')} · allocate ${alloc}`];
  if (!f2f && fl2f) parts.push(`kein FLOW hat einen FUNC-Produzenten (io FUNC→FLOW = 0, FLOW→FUNC = ${fl2f}) — R-10-Vorlast`);
  else if (!f2f && !fl2f) parts.push('keine io-Kanten zwischen FUNC und FLOW');
  else parts.push(`io FUNC→FLOW ${f2f} / FLOW→FUNC ${fl2f}, aber 0 Querung über eine Modulgrenze`);
  return parts.join(' — ');
}

/** CR-01 (crossingFlows) — wie IMPLEMENTIERT vs. wie im Regelkopf GEMEINT. */
function cr01Balance(g, threshold = 3) {
  const ix = index(g);
  // (a) wie IMPLEMENTIERT — die ausgelieferte Regel selbst, nicht nachgebaut:
  const shipped = cr01CrossingFlowCount(g, { ...DEFAULT_METRIC_POLICY, crossingFlows: { warning: threshold } });
  const shippedNull = cr01CrossingFlowCount(g, { ...DEFAULT_METRIC_POLICY, crossingFlows: null });
  // (b) wie gemeint: io-PFADE FUNC→FLOW→FUNC je MOD-Paar, roh vs. distinct-SCHEMA
  const raw = new Map(), dist = new Map();
  for (const [flow, consumers] of ix.cons) {
    const producers = ix.prod.get(flow) ?? [];
    const schemas = [...(ix.schemaOf.get(flow) ?? [`UNBOUND:${flow}`])];
    for (const c of consumers) for (const p of producers) {
      if (p === c) continue;
      const a = ix.modOf(p), b = ix.modOf(c);
      if (!a || !b || a === b) continue;
      const k = [a, b].sort().join('::');
      raw.set(k, (raw.get(k) ?? 0) + 1);
      for (const s of schemas) (dist.get(k) ?? dist.set(k, new Set()).get(k)).add(s);
    }
  }
  const over = (m, sz) => [...m.values()].filter((v) => (sz ? v.size : v) >= threshold).length;
  return {
    implemented: {
      pairs: shipped.length,
      warnings: shipped.filter((v) => v.severity === 'warning').length,
      withNull: shippedNull.length,
    },
    rawPaths: { pairs: raw.size, warnings: over(raw) },
    distinctContracts: { pairs: dist.size, warnings: over(dist, true) },
  };
}

// ── Lineare Algebra: OLS, R², adjustiertes R², LOO-CV, Permutations-Null ───────────────
function ols(Xrows, y) {
  const n = Xrows.length, p = Xrows[0].length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p + 1 }, (_, j) =>
    j < p ? Xrows.reduce((a, r) => a + r[i] * r[j], 0) : Xrows.reduce((a, r, k) => a + r[i] * y[k], 0)));
  for (let c = 0; c < p; c++) { // Gauß mit Pivot + Ridge-Epsilon gegen Singularität
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    if (Math.abs(A[c][c]) < 1e-10) A[c][c] += 1e-8;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j];
    }
  }
  const beta = A.map((r, i) => r[p] / r[i][i] || 0).map((v, i) => A[i][p] / A[i][i]);
  const yhat = Xrows.map((r) => r.reduce((a, v, i) => a + v * beta[i], 0));
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const ssTot = y.reduce((a, v) => a + (v - ybar) ** 2, 0);
  const ssRes = y.reduce((a, v, i) => a + (v - yhat[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  return { beta, yhat, r2, ssRes, ssTot, n, p };
}
function looR2(Xrows, y) {
  const n = Xrows.length;
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const ssTot = y.reduce((a, v) => a + (v - ybar) ** 2, 0);
  let ssRes = 0;
  for (let k = 0; k < n; k++) {
    const Xk = Xrows.filter((_, i) => i !== k), yk = y.filter((_, i) => i !== k);
    const { beta } = ols(Xk, yk);
    ssRes += (y[k] - Xrows[k].reduce((a, v, i) => a + v * beta[i], 0)) ** 2;
  }
  return 1 - ssRes / ssTot;
}
function pearson(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
  const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
  const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
  return da && db ? num / (da * db) : 0;
}
function permutationNull(Xrows, y, iters = 2000, seed = 20260827) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const obs = ols(Xrows, y).r2;
  let ge = 0, sum = 0;
  for (let t = 0; t < iters; t++) {
    const yy = y.slice();
    for (let i = yy.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [yy[i], yy[j]] = [yy[j], yy[i]]; }
    const r2 = ols(Xrows, yy).r2;
    sum += r2;
    if (r2 >= obs) ge++;
  }
  return { obs, nullMean: sum / iters, p: (ge + 1) / (iters + 1) };
}

// ── Die drei Spike-Zustände aus CR-436 (in-memory nachgestellt) ────────────────────────
function transform(raw, { realloc = {}, flowMerge = {}, schemaMerge = {} }) {
  const MERGE = { ...flowMerge, ...schemaMerge };
  const elements = raw.elements.filter((e) => !MERGE[e.id]).map((e) => ({ ...e }));
  const have = new Set(elements.map((e) => e.id));
  const seen = new Set(), traces = [];
  for (const t of raw.traces) {
    let { source, target, type } = t;
    if (MERGE[source]) source = MERGE[source];
    if (MERGE[target]) target = MERGE[target];
    if (type === 'allocate' && realloc[source]) target = realloc[source];
    if (source === target) continue;
    const k = `${source}>${type}>${target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    traces.push({ ...t, source, target, type });
  }
  for (const t of traces)
    if (t.type === 'allocate' && !have.has(t.target)) {
      elements.push({ id: t.target, type: 'MOD', name: t.target.replace('MOD-', ''), description: 'Spike-Zielmodul (Vorschlag)', status: 'draft' });
      have.add(t.target);
    }
  const used = new Set(traces.filter((t) => t.type === 'allocate').map((t) => t.target));
  const keep = new Set(elements.filter((e) => e.type !== 'MOD' || used.has(e.id)).map((e) => e.id));
  return {
    elements: elements.filter((e) => keep.has(e.id)),
    traces: traces.filter((t) => keep.has(t.source) && keep.has(t.target)),
    graphVersion: raw.graphVersion,
  };
}

// Handschnitt (8er-Schnitt) — Auszug aus dem CR-GC-436-Spike (Lauf B, zurueckgebaut)
const HANDSCHNITT = {
  realloc: {
    'FUNC-emit-trajectory': 'MOD-store', 'FUNC-emit-update-event': 'MOD-store',
    'FUNC-migrate-schema': 'MOD-store', 'FUNC-schema-guard': 'MOD-store',
    'FUNC-score-completeness': 'MOD-metrics-engine', 'FUNC-check-code-conformance': 'MOD-gate',
    'FUNC-list-elements': 'MOD-mcp-tools',
    'FUNC-broadcast-diff': 'MOD-live', 'FUNC-health-endpoint': 'MOD-live',
    'FUNC-own-kuzu-host': 'MOD-live', 'FUNC-serve-sse': 'MOD-live', 'FUNC-host-socket': 'MOD-live',
    'FUNC-block-live-dashboard': 'MOD-live', 'FUNC-block-schaufenster': 'MOD-live',
    'FUNC-block-speicherwerk': 'MOD-store', 'FUNC-block-gedaechtnis': 'MOD-codec',
    'FUNC-block-gate': 'MOD-gate', 'FUNC-block-messwerk': 'MOD-steering',
    'FUNC-block-anschluss': 'MOD-mcp-tools', 'FUNC-block-ruestzeug': 'MOD-mcp-tools',
    'FUNC-block-betrieb': 'MOD-cli', 'FUNC-block-antrieb': 'MOD-executor',
    'FUNC-mutate': 'MOD-gate', 'FUNC-evaluate-rules': 'MOD-gate', 'FUNC-load-config': 'MOD-gate',
    'FUNC-fit-advisory': 'MOD-gate', 'FUNC-preflight': 'MOD-gate',
    'FUNC-tool-context': 'MOD-mcp-tools', 'FUNC-graph-suggest': 'MOD-steering',
  },
  flowMerge: {
    'FLOW-measurement-vector': 'FLOW-steering-snapshot', 'FLOW-arch-fitness': 'FLOW-steering-snapshot',
    'FLOW-dimension-readiness': 'FLOW-steering-snapshot', 'FLOW-phase-readiness': 'FLOW-steering-snapshot',
    'FLOW-fit-advisory': 'FLOW-gate-verdict', 'FLOW-steering-delta': 'FLOW-gate-verdict',
    'FLOW-graph-snapshot': 'FLOW-graph-state',
  },
  schemaMerge: {},
};

// Regelkreis (5 Module + 5 Verträge) — Auszug aus dem CR-GC-436-Nachtrag
const RK_MODULES = {
  kernel: ['FUNC-mutate', 'FUNC-evaluate-rules', 'FUNC-load-config', 'FUNC-preflight', 'FUNC-graph-store', 'FUNC-claim-store-lock', 'FUNC-create-harness', 'FUNC-import', 'FUNC-seed-from-json', 'FUNC-reseed', 'FUNC-apply-reseed', 'FUNC-merge-nodes', 'FUNC-migrate-schema', 'FUNC-schema-guard', 'FUNC-bootstrap', 'FUNC-graph-impact', 'FUNC-graph-expand', 'FUNC-list-elements', 'FUNC-resolve-tests-from-code', 'FUNC-deduce-tests', 'FUNC-block-gate', 'FUNC-block-speicherwerk'],
  projections: ['FUNC-take-steering-snapshot', 'FUNC-compute-readiness', 'FUNC-compute-phase-readiness', 'FUNC-score-completeness', 'FUNC-compute-steering-delta', 'FUNC-fit-advisory', 'FUNC-nd-similarity', 'FUNC-module-metrics', 'FUNC-arch-fitness', 'FUNC-check-code-conformance', 'FUNC-encode', 'FUNC-decode', 'FUNC-export-markdown', 'FUNC-graph-export-snapshot', 'FUNC-auto-export', 'FUNC-export-marker', 'FUNC-emit-trajectory', 'FUNC-emit-update-event', 'FUNC-block-messwerk', 'FUNC-block-gedaechtnis', 'FUNC-block-dokumentenwerk'],
  loop: ['FUNC-goal-steerer', 'FUNC-block-arch-optimierung', 'FUNC-block-q-improvement', 'FUNC-block-se-steuerung', 'FUNC-generation-step', 'FUNC-next-step', 'FUNC-rank-candidates', 'FUNC-graph-suggest', 'FUNC-target-profile-load', 'FUNC-run-executor', 'FUNC-build-round-injection', 'FUNC-extract-mutate', 'FUNC-block-antrieb'],
  surface: ['FUNC-cli-dispatch', 'FUNC-harness-cli', 'FUNC-upgrade', 'FUNC-collect-status', 'FUNC-session-shutdown', 'FUNC-gve-supervise', 'FUNC-gve-sessions', 'FUNC-import-code-verb', 'FUNC-rewind', 'FUNC-run-verb', 'FUNC-serve-stdio', 'FUNC-bind-tools', 'FUNC-tool-context', 'FUNC-host-socket', 'FUNC-own-kuzu-host', 'FUNC-serve-sse', 'FUNC-health-endpoint', 'FUNC-broadcast-diff', 'FUNC-block-live-dashboard', 'FUNC-block-schaufenster', 'FUNC-block-anschluss', 'FUNC-block-betrieb', 'FUNC-block-ruestzeug'],
  'agent-surface': ['FUNC-author-req', 'FUNC-author-uc', 'FUNC-close-violations', 'FUNC-import-code', 'FUNC-import-doc', 'FUNC-render-views', 'FUNC-se-conops', 'FUNC-se-fmea', 'FUNC-se-generate', 'FUNC-se-help', 'FUNC-se-irr', 'FUNC-se-plan', 'FUNC-se-retro', 'FUNC-se-review', 'FUNC-se-status', 'FUNC-se-trade', 'FUNC-target-profile', 'FUNC-test', 'FUNC-test-ui', 'FUNC-view-changelog', 'FUNC-view-conops', 'FUNC-view-fmea', 'FUNC-view-icd', 'FUNC-view-intplan', 'FUNC-view-rtm'],
};
const RK_FLOW_MERGE = {
  'FLOW-suggested-edit': 'FLOW-mutate-cmd', 'FLOW-formatE-candidates': 'FLOW-mutate-cmd', 'FLOW-action': 'FLOW-mutate-cmd',
  'FLOW-violations': 'FLOW-gate-verdict', 'FLOW-fit-advisory': 'FLOW-gate-verdict', 'FLOW-steering-delta': 'FLOW-gate-verdict', 'FLOW-bootstrap-result': 'FLOW-gate-verdict',
  'FLOW-measurement-vector': 'FLOW-steering-snapshot', 'FLOW-arch-fitness': 'FLOW-steering-snapshot', 'FLOW-dimension-readiness': 'FLOW-steering-snapshot', 'FLOW-phase-readiness': 'FLOW-steering-snapshot', 'FLOW-completeness': 'FLOW-steering-snapshot', 'FLOW-module-metrics': 'FLOW-steering-snapshot', 'FLOW-round-findings': 'FLOW-steering-snapshot',
  'FLOW-graph-snapshot': 'FLOW-graph-state', 'FLOW-committed-graph': 'FLOW-graph-state', 'FLOW-draft-graph': 'FLOW-graph-state', 'FLOW-recalled-state': 'FLOW-graph-state', 'FLOW-merged-graph': 'FLOW-graph-state', 'FLOW-migrated-graph': 'FLOW-graph-state', 'FLOW-parsed-graph': 'FLOW-graph-state', 'FLOW-capture-draft': 'FLOW-graph-state', 'FLOW-branch-graphs': 'FLOW-graph-state',
  'FLOW-expanded-subgraph': 'FLOW-impact-subgraph', 'FLOW-element-slice': 'FLOW-impact-subgraph', 'FLOW-impacted-tests': 'FLOW-impact-subgraph',
  'FLOW-expand-request': 'FLOW-query-request', 'FLOW-export-request': 'FLOW-query-request', 'FLOW-view-request': 'FLOW-query-request',
  'FLOW-viewer-stream': 'FLOW-live-event',
  'FLOW-bulk-formatE': 'FLOW-formatE-artifact', 'FLOW-rendered-view': 'FLOW-markdown-docs',
  'FLOW-authoring-request': 'FLOW-skill-request', 'FLOW-round-injection': 'FLOW-round-prompt', 'FLOW-round-scope': 'FLOW-round-prompt',
};
const RK_SCHEMA_MERGE = {
  'SCHEMA-measurement-vector': 'SCHEMA-steering-snapshot', 'SCHEMA-module-metrics': 'SCHEMA-steering-snapshot',
  'SCHEMA-action': 'SCHEMA-mutate-command', 'SCHEMA-fit-advisory': 'SCHEMA-mutate-result',
  'SCHEMA-steering-delta': 'SCHEMA-mutate-result', 'SCHEMA-phase-readiness': 'SCHEMA-readiness-report',
  'SCHEMA-completeness': 'SCHEMA-readiness-report', 'SCHEMA-impacted-tests': 'SCHEMA-test-selection',
};
const RK_REALLOC = {};
for (const [m, fs_] of Object.entries(RK_MODULES)) for (const f of fs_) RK_REALLOC[f] = `MOD-${m}`;

// ── Messmatrix bauen ───────────────────────────────────────────────────────────────────
// unter 10 Randquerungen ist jede Konzentrationszahl ein Artefakt; per Env für die
// Sensitivitätsprüfung absenkbar (GC438_MIN_X=5 nimmt graph-view-edit mit auf)
const MIN_X = Number(process.env.GC438_MIN_X ?? 10);
const rows = [], excluded = [];
function measureRow(id, g, meta) {
  const cnt = (t) => g.elements.filter((e) => e.type === t).length;
  const shape = { MOD: cnt('MOD'), FUNC: cnt('FUNC'), FLOW: cnt('FLOW'), SCHEMA: cnt('SCHEMA') };
  const d = d7(g, { count: 'schema', traffic: 'pair' });
  const de = d7(g, { count: 'schema', traffic: 'edge' });
  if (d.D7 === null) return { skip: `Modulrand nicht messbar — ${whyUnmeasurable(g)}`, shape };
  if (d.X < MIN_X) return { skip: `nur ${d.X} Randquerungen (< ${MIN_X}) — Konzentrationszahl wäre Artefakt`, shape };
  let rules = null, rulesErr = null;
  try { rules = evaluateAllRules(g, DEFAULT_METRIC_POLICY).length; }
  catch (e) { rulesErr = e.message; }
  return {
    row: {
      id, ...meta, graphVersion: g.graphVersion ?? '—', shape,
      m: metrics(g, { layer: 'arch' }), d, de, rules, rulesErr, cr01: cr01Balance(g),
    },
  };
}
for (const c of CANDIDATES) {
  if (!existsSync(c.path)) { excluded.push({ ...c, reason: 'Datei nicht vorhanden' }); continue; }
  let g;
  try { g = JSON.parse(readFileSync(c.path, 'utf8')); }
  catch (e) { excluded.push({ ...c, reason: `JSON nicht parsebar: ${e.message}` }); continue; }
  const r = measureRow(c.id, g, { pattern: c.pattern, note: c.note, secondary: !!c.secondary, real: true });
  if (r.skip) excluded.push({ ...c, reason: r.skip }); else rows.push(r.row);
}

// Spike-Zustände (auf dem AKTUELLEN SSOT nachgestellt — v208 aus CR-436 ist Historie)
const gcRaw = JSON.parse(readFileSync(`${DEV}/graphcode/docs/graph/graphcode.graph.json`, 'utf8'));
for (const [id, spec] of [
  ['graphcode~handschnitt', HANDSCHNITT],
  ['graphcode~regelkreis', { realloc: RK_REALLOC, flowMerge: RK_FLOW_MERGE, schemaMerge: RK_SCHEMA_MERGE }],
]) {
  const g = transform(gcRaw, spec);
  const r = measureRow(id, g, {
    pattern: 'Kernel', real: false,
    note: `Spike-Zustand aus CR-436, in-memory auf v${gcRaw.graphVersion} nachgestellt (kein Gate, kein Store)`,
  });
  if (r.skip) excluded.push({ id, reason: r.skip }); else rows.push({ ...r.row, graphVersion: `${gcRaw.graphVersion}*` });
}

// ── Ausgabe: Messmatrix ────────────────────────────────────────────────────────────────
const f = (v, n = 3) => (v === null || v === undefined ? '   —  ' : v.toFixed(n));
console.log('\n' + '='.repeat(112));
console.log('CR-GC-438 — Messmatrix 7×N  (R⁶ = se-engine metrics, layer:"arch" · D7 = Vertragskonzentration, Zählbasis SCHEMA)');
console.log('='.repeat(112));
console.log('Graph                    ver     mod   flt   flw   coh   via   scl  |  D7pair   V    X  C5%  | D7edge   V     X  C5%');
for (const r of rows) {
  const m = r.m, d = r.d, e = r.de;
  console.log(
    `${r.id.padEnd(24)} ${String(r.graphVersion).padEnd(6)} ${f(m.modifiability, 2)}  ${f(m.faultTolerance, 2)}  ${f(m.flowEfficiency, 2)}  ` +
    `${f(m.coherence, 2)}  ${f(m.viability, 2)}  ${f(m.scalability, 2)}  | ${f(d.D7, 2).padStart(5)} ${String(d.V).padStart(4)} ${String(d.X).padStart(5)} ` +
    `${f(d.C5 * 100, 0).padStart(4)}  | ${f(e.D7, 2).padStart(5)} ${String(e.V).padStart(4)} ${f(e.X, 0).padStart(5)} ${f(e.C5 * 100, 0).padStart(4)}`);
}
console.log('\nNicht in die Matrix aufgenommen (benannt, nicht ersetzt):');
for (const e of excluded) console.log(`  · ${e.id.padEnd(22)} ${e.reason}${e.note ? `\n      Vorbehalt: ${e.note}` : ''}`);
console.log('\nVorbehalte an aufgenommenen Zeilen:');
for (const r of rows.filter((x) => x.note)) console.log(`  · ${r.id.padEnd(22)} ${r.note}`);
for (const r of rows.filter((x) => x.rulesErr)) console.log(`  · ${r.id.padEnd(22)} rules_evaluate CRASH: ${r.rulesErr}`);

// ── Eigenvektor-Test ───────────────────────────────────────────────────────────────────
function regression(set, label, pick) {
  const y = set.map(pick);
  const X = set.map((r) => [1, ...METRIC_DIMENSIONS.map((k) => r.m[k])]);
  const fit = ols(X, y);
  const loo = looR2(X, y);
  const perm = permutationNull(X, y);
  const adj = 1 - (1 - fit.r2) * (set.length - 1) / Math.max(1, set.length - 7);
  console.log(`\n── Regression  [${label}]  N=${set.length}, Prädiktoren=6 (+Intercept), Rest-df=${set.length - 7}`);
  console.log(`   R²          = ${fit.r2.toFixed(4)}   ← Schwelle des CR: R² ≥ 0,80 ⇒ D7 abgeleitet (Kill 1)`);
  console.log(`   R²_adj      = ${adj.toFixed(4)}   ·  R²_LOO = ${loo.toFixed(4)} (prädiktiv)`);
  console.log(`   Permutation: R²_null(mean) = ${perm.nullMean.toFixed(4)}, p(R² ≥ beobachtet) = ${perm.p.toFixed(4)}`);
  // Einzel-Prädiktor: df-ehrlich (p=1), deshalb der belastbare Teil des Befunds
  const singles = METRIC_DIMENSIONS.map((k) => {
    const r = pearson(set.map((s) => s.m[k]), y);
    const X1 = set.map((s) => [1, s.m[k]]);
    return { k, r, r2: ols(X1, y).r2, loo: looR2(X1, y) };
  }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  console.log('   paarweise |r| + Einzel-Prädiktor-Fit (p=1, df-ehrlich):');
  for (const s of singles)
    console.log(`      ${s.k.padEnd(15)} r = ${(s.r >= 0 ? ' ' : '') + s.r.toFixed(3)}   R²₁ = ${s.r2.toFixed(3)}   R²₁_LOO = ${s.loo.toFixed(3)}`);
  return { r2: fit.r2, adj, loo, perm, singles };
}
console.log('\n' + '='.repeat(112));
console.log('EIGENVEKTOR-TEST (Kill-Kriterium 1)');
console.log('='.repeat(112));
const primary = rows.filter((r) => !r.secondary);
const VARIANTS = [
  ['D7 pair/schema (CR-436-Zählweise)', (r) => r.d.D7],
  ['D7 edge/schema (hub-invariant)', (r) => r.de.D7],
  ['C5 pair/schema (Top-5-Anteil)', (r) => r.d.C5],
  ['V/X pair/schema (Vokabulardichte)', (r) => r.d.V / r.d.X],
];
const regs = {};
for (const [name, pick] of VARIANTS) regs[name] = regression(primary, `${name} ~ R⁶ · primär (reale SSOTs + 2 Spike-Zustände)`, pick);
const regAll = regression(rows, 'D7 pair/schema ~ R⁶ · sensitiv (+ synthetische Rig-Graphen)', (r) => r.d.D7);
const regPrimary = regs['D7 pair/schema (CR-436-Zählweise)'];
console.log('\nZusammenfassung Kill 1 über alle D7-Varianten (Schwelle R² ≥ 0,80):');
for (const [name] of VARIANTS)
  console.log(`   ${name.padEnd(36)} R² = ${regs[name].r2.toFixed(4)}  ⇒ ${regs[name].r2 >= 0.8 ? 'KILL 1 GREIFT' : 'Kill 1 greift nicht'}   (R²_LOO ${regs[name].loo.toFixed(2)}, p_perm ${regs[name].perm.p.toFixed(3)})`);

// ── Anti-Gaming-Probe (Kill-Kriterium 2) ───────────────────────────────────────────────
console.log('\n' + '='.repeat(112));
console.log('ANTI-GAMING-PROBE (Kill-Kriterium 2) — FLOW-Label-Merge OHNE SCHEMA-Merge');
console.log('='.repeat(112));
const base = gcRaw;
const labelOnly = transform(base, { flowMerge: RK_FLOW_MERGE }); // 35 FLOW-Merges, 0 SCHEMA-Merges
const bothMerge = transform(base, { flowMerge: RK_FLOW_MERGE, schemaMerge: RK_SCHEMA_MERGE });
const probe = [
  ['Basis (graphcode SSOT)', base],
  ['nur FLOW-Label gemergt (35×), SCHEMA unangetastet', labelOnly],
  ['FLOW + SCHEMA gemergt (35× / 8×)', bothMerge],
];
console.log('Der Zug: 35 FLOW-Knoten auf 14 Labels zusammenlegen, die 30 SCHEMAs unangetastet lassen.');
console.log('Kill 2 = bewegt dieser Zug die D7-Zahl, ist die Zählbasis falsch.\n');
console.log('Variante                                            |  FLOW/pair  V    D7 | SCHEMA/pair  V    D7 | SCHEMA/edge  V    D7');
for (const [label, g] of probe) {
  const p = (o) => `${String(o.V).padStart(4)} ${f(o.D7, 2).padStart(5)}`;
  console.log(`${label.padEnd(51)} |       ${p(d7(g, { count: 'flow' }))} |        ${p(d7(g))} |        ${p(d7(g, { count: 'schema', traffic: 'edge' }))}`);
}
const rel = (a, b) => `${a > b ? '−' : '+'}${(100 * Math.abs(a - b) / a).toFixed(0)} %`;
const b0 = { f: d7(base, { count: 'flow' }), s: d7(base), e: d7(base, { count: 'schema', traffic: 'edge' }) };
const b1 = { f: d7(labelOnly, { count: 'flow' }), s: d7(labelOnly), e: d7(labelOnly, { count: 'schema', traffic: 'edge' }) };
console.log('\nVokabular-Bewegung durch den reinen Label-Merge:');
console.log(`   Zählbasis FLOW  : V ${b0.f.V} → ${b1.f.V} (${rel(b0.f.V, b1.f.V)})  — gameable, genau der Zug, den Kill 2 fürchtet`);
console.log(`   Zählbasis SCHEMA: V ${b0.s.V} → ${b1.s.V} (${rel(b0.s.V, b1.s.V)})  — kein Vokabular-Gewinn`);
console.log(`   D7 SCHEMA/pair  : ${b0.s.D7.toFixed(2)} → ${b1.s.D7.toFixed(2)} (Δ ${(b1.s.D7 - b0.s.D7).toFixed(2)}), Randverkehr X ${b0.s.X} → ${b1.s.X}`);
console.log(`   D7 SCHEMA/edge  : ${b0.e.D7.toFixed(2)} → ${b1.e.D7.toFixed(2)} (Δ ${(b1.e.D7 - b0.e.D7).toFixed(2)}), Randverkehr X ${b0.e.X.toFixed(0)} → ${b1.e.X.toFixed(0)}`);
// R-18-Kardinalität: der Label-Merge erzeugt FLOWs mit >1 SCHEMA — die Grammatik verbietet das
const multi = (g) => {
  const ix = index(g);
  return [...ix.schemaOf.values()].filter((s) => s.size > 1).length;
};
console.log(`\nFLOWs mit >1 SCHEMA (Grammatik: FLOW -relation-> SCHEMA [1..1], R-18):`);
for (const [label, g] of probe) console.log(`   ${label.padEnd(51)} ${multi(g)}`);

// ── Preset-Diskriminierung (Kill-Kriterium 3) ──────────────────────────────────────────
console.log('\n' + '='.repeat(112));
console.log('PRESET-DISKRIMINIERUNG (Kill-Kriterium 3) — trennen die Ist-Vektoren die Muster?');
console.log('='.repeat(112));
console.log('Grundgesamtheit: nur REALE Repo-SSOTs — die zwei Spike-Zustände sind Varianten desselben');
console.log('Repos und dürfen ein Muster nicht doppelt bevölkern.\n');
const byPattern = new Map();
for (const r of rows.filter((x) => x.real && !x.secondary))
  (byPattern.get(r.pattern) ?? byPattern.set(r.pattern, []).get(r.pattern)).push(r);
const dims = [...METRIC_DIMENSIONS, 'D7'];
const valOf = (r, k) => (k === 'D7' ? r.d.D7 : r.m[k]);
console.log('Muster        n   ' + dims.map((d) => d.slice(0, 6).padStart(7)).join(''));
for (const [p, rs] of byPattern) {
  const mean = (k) => rs.reduce((a, r) => a + valOf(r, k), 0) / rs.length;
  console.log(`${p.padEnd(13)} ${String(rs.length).padStart(2)}   ` + dims.map((d) => mean(d).toFixed(2).padStart(7)).join(''));
}
const realRows = rows.filter((x) => x.real && !x.secondary);
const separatingDims = (ra, rb) => dims.filter((d) => {
  const A = ra.map((r) => valOf(r, d)), B = rb.map((r) => valOf(r, d));
  const [aLo, aHi] = [Math.min(...A), Math.max(...A)], [bLo, bHi] = [Math.min(...B), Math.max(...B)];
  return aHi < bLo || bHi < aLo;
});
console.log('\nPaarweise Trennung (nur Muster mit n ≥ 2; „trennt" = Wertebereiche überlappen auf der Dimension NICHT):');
const pats = [...byPattern.entries()].filter(([, rs]) => rs.length >= 2);
if (pats.length < 2) console.log('  Kein Musterpaar mit je n ≥ 2 im Bestand — Diskriminierung nicht prüfbar.');
for (let i = 0; i < pats.length; i++) for (let j = i + 1; j < pats.length; j++) {
  const [pa, ra] = pats[i], [pb, rb] = pats[j];
  const sep = separatingDims(ra, rb).map((d) => {
    const A = ra.map((r) => valOf(r, d)), B = rb.map((r) => valOf(r, d));
    return `${d} (${Math.min(...A).toFixed(2)}–${Math.max(...A).toFixed(2)} vs ${Math.min(...B).toFixed(2)}–${Math.max(...B).toFixed(2)})`;
  });
  console.log(`  ${pa} (n=${ra.length}) vs ${pb} (n=${rb.length}): ${sep.length ? `trennt auf ${sep.length} Dim. — ${sep.join(' · ')}` : 'KEINE trennende Dimension'}`);
}
// Wie oft trennen ZUFÄLLIGE Zweiergruppen? Ohne diese Null ist „trennt auf 2 Dimensionen"
// bei n=2 keine Aussage, sondern Arithmetik.
{
  let s = 20260827;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let hits = 0, sumDims = 0;
  const iters = 5000;
  for (let t = 0; t < iters; t++) {
    const pool = realRows.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const nd = separatingDims(pool.slice(0, 2), pool.slice(2, 4)).length;
    sumDims += nd;
    if (nd >= 1) hits++;
  }
  console.log(`\n  Zufalls-Null (${realRows.length} reale Graphen, zwei zufällige Zweiergruppen, ${iters} Ziehungen):`);
  console.log(`  P(mindestens 1 trennende Dimension) = ${(hits / iters).toFixed(3)} · Erwartungswert trennender Dimensionen = ${(sumDims / iters).toFixed(2)}`);
  console.log('  ⇒ „trennt auf 1–2 Dimensionen" bei n=2 liegt im Zufallsbereich; als Beleg reicht es nicht.');
}
const MUSTER = ['Kernel', 'Pipeline', 'Layered', 'Föderiert', 'Broker', 'Plugin'];
const belegt = MUSTER.map((m) => `${m}: n=${(byPattern.get(m) ?? []).length}`);
console.log(`\n  Besetzung der 6-Muster-Hypothese am Bestand — ${belegt.join(' · ')}`);
console.log(`  ⇒ ${MUSTER.filter((m) => !(byPattern.get(m) ?? []).length).join(' und ')} haben KEINEN Vertreter: für diese Presets gibt es keinen Messbeleg.`);

// ── CR-01-Kipp-Bilanz (Vorgehen 5) ─────────────────────────────────────────────────────
console.log('\n' + '='.repeat(112));
console.log('CR-01-KIPP-BILANZ — Befunde je Graph: wie implementiert · als io-PFAD roh · distinct-Verträge (Schwelle warning ≥ 3)');
console.log('='.repeat(112));
console.log('„implementiert" = die ausgelieferte cr01CrossingFlowCount aus @sigloch/contracts/se, direkt aufgerufen.');
console.log('„roher io-Pfad"/„distinct-Vertrag" = wie der Regelkopf es MEINT (FUNC→FLOW→FUNC je MOD-Paar).\n');
console.log('Graph                     implementiert     roher io-Pfad       distinct-Vertrag    Kipp (roh→distinct)');
for (const r of rows) {
  const c = r.cr01;
  console.log(`${r.id.padEnd(24)}  ${String(c.implemented.warnings).padStart(3)} warn /${String(c.implemented.pairs).padStart(4)} B   ` +
    `${String(c.rawPaths.warnings).padStart(3)} warn /${String(c.rawPaths.pairs).padStart(4)} P    ` +
    `${String(c.distinctContracts.warnings).padStart(3)} warn /${String(c.distinctContracts.pairs).padStart(4)} P     ` +
    `${String(c.rawPaths.warnings - c.distinctContracts.warnings).padStart(4)} kippen`);
}
const sum = (sel) => rows.reduce((a, r) => a + sel(r.cr01), 0);
console.log(`\nSumme über alle ${rows.length} Zeilen: implementiert ${sum((c) => c.implemented.warnings)} warnings / ` +
  `${sum((c) => c.implemented.pairs)} Befunde gesamt · als io-Pfad gemeint: roh ${sum((c) => c.rawPaths.warnings)} · ` +
  `distinct ${sum((c) => c.distinctContracts.warnings)}`);
// CR-SM-285: die alte Schlusszeile behauptete, die ausgelieferte CR-01 suche direkte
// `FUNC -io-> FUNC`-Kanten. Das galt bis CR-SM-274/276 und ist seither falsch — die Tabelle
// darueber zeigt es selbst: `implementiert` und `distinct-Vertrag` sind spaltengleich. Ein
// Instrument, dessen Prosa der eigenen Messung widerspricht, liefert die Zahl und die falsche
// Deutung gleich mit; das ist die Fehlerklasse, die CR-SM-285 als Ganzes adressiert. Die Aussage
// wird jetzt AUS DEN ZAHLEN abgeleitet statt behauptet.
const implW = sum((c) => c.implemented.warnings);
const rawW = sum((c) => c.rawPaths.warnings);
const distW = sum((c) => c.distinctContracts.warnings);
console.log(`crossingFlows:null kippt ${sum((c) => c.implemented.pairs - c.implemented.withNull)} Befunde.`);
console.log(
  implW === distW
    ? `Die ausgelieferte CR-01 zaehlt VERSCHIEDENE Vertraege auf dem io-Pfad FUNC→FLOW→FUNC ` +
      `(implementiert ${implW} = distinct ${distW}, roh waere ${rawW}) — seit CR-SM-274/276 deckungsgleich mit dem Regelkopf.`
    : `ACHTUNG: implementiert ${implW} weicht von distinct ${distW} ab — die Regel misst etwas anderes als ihr Kopf sagt.`);

if (JSON_OUT) console.log('\nJSON\n' + JSON.stringify({ rows, excluded, regPrimary: { r2: regPrimary.r2, adj: regPrimary.adj, loo: regPrimary.loo, perm: regPrimary.perm }, regAll: { r2: regAll.r2, adj: regAll.adj, loo: regAll.loo, perm: regAll.perm } }, null, 2));
