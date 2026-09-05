#!/usr/bin/env node
/**
 * CR-SM-281 §2.7 — Spike: rekursive Messung je Container. READ-ONLY, kein Produktionscode.
 *
 * Frage (eine): rankt der je Container gemessene Vektor den Known-Answer-Set richtig —
 * einschliesslich der Degenerate, an denen der globale Vektor scheitert?
 *
 * KEINE zweite Definition von "Enthaltensein": die Traversierung ist gves `containerClosure`
 * (behavior-flow.mjs), per Pfad importiert. Besteht der Spike, ist Schritt 0b die Befoerderung
 * genau dieser Funktion nach @sigloch/contracts (CR-SM-281 §2.8). Die sechs Formeln sind
 * `metrics()` aus @sigloch/se-engine — auch die wird nicht nachgebaut.
 *
 * Aufruf aus dem graphcode-Repo: node scripts/spike-rekursive-metrik.mjs
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { containerClosure } from '/Users/andreas/Developer/dev/graph-view-edit/src/behavior-flow.mjs';

const W = JSON.parse(readFileSync('.graphcode/target-profile.json', 'utf8')).weights;
const dot = (v) => v.reduce((a, x, i) => a + x * (W[METRIC_DIMENSIONS[i]] ?? 0), 0);
const vecOf = (g) => { const m = metrics(g, { layer: 'arch' }); return METRIC_DIMENSIONS.map((d) => m[d]); };
const n3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');

const file = (p) => { const r = JSON.parse(readFileSync(p, 'utf8')); return { elements: r.elements, traces: r.traces }; };
const at = (ref) => { const r = JSON.parse(execFileSync('git', ['show', `${ref}:docs/graph/graphcode.graph.json`], { encoding: 'utf8', maxBuffer: 64 << 20 })); return { elements: r.elements, traces: r.traces }; };

const push = (m, k, v) => { const s = m.get(k); if (s) s.push(v); else m.set(k, [v]); };
const add = (m, k, v) => { const s = m.get(k); if (s) s.add(v); else m.set(k, new Set([v])); };

// ---------------------------------------------------------------------------
// S1 — Container-Zerlegung. Ein Container ist ein Knoten mit direkten Kindern
// (FUNC-compose-FUNC, MOD-compose-MOD, FUNC-allocate-MOD) plus die zwei
// Wurzel-Container (die Forest-Wurzeln je Baum).
// ---------------------------------------------------------------------------
function structure(graph) {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const t = (id) => byId.get(id)?.type;
  const kids = new Map();
  const composeParents = new Map();
  for (const tr of graph.traces) {
    const st = t(tr.source), tt = t(tr.target);
    if (tr.type === 'compose' && st === 'FUNC' && tt === 'FUNC') { add(kids, tr.source, tr.target); push(composeParents, tr.target, tr.source); }
    else if (tr.type === 'compose' && st === 'MOD' && tt === 'MOD') { add(kids, tr.source, tr.target); push(composeParents, tr.target, tr.source); }
    else if (tr.type === 'allocate' && st === 'FUNC' && tt === 'MOD') add(kids, tr.target, tr.source);
  }
  const hasComposeParent = new Set(composeParents.keys());
  const rootF = graph.elements.filter((e) => e.type === 'FUNC' && !hasComposeParent.has(e.id)).map((e) => e.id);
  const rootM = graph.elements.filter((e) => e.type === 'MOD' && !hasComposeParent.has(e.id)).map((e) => e.id);
  const containers = [];
  if (rootF.length) containers.push({ id: 'ROOT:FUNC', children: rootF });
  if (rootM.length) containers.push({ id: 'ROOT:MOD', children: rootM });
  for (const [id, set] of kids) containers.push({ id, children: [...set] });
  const multiParent = [...composeParents.entries()].filter(([, ps]) => new Set(ps).size > 1);
  return { byId, containers, multiParent };
}

// ---------------------------------------------------------------------------
// S2 — Kind-Graph eines Containers: Knoten = direkte Kinder, Kante = io-Pfad
// (FUNC -io-> FLOW -io-> FUNC) zwischen ihren Teilbaeumen. Zaehlbasis fuer den
// Rand sind VERSCHIEDENE Vertraege (SCHEMA), wie CR-SM-274/276 — nicht Kanten.
// ---------------------------------------------------------------------------
function ioIndex(graph, byId) {
  const t = (id) => byId.get(id)?.type;
  const producers = new Map(), consumers = new Map(), schemasOf = new Map();
  for (const tr of graph.traces) {
    if (tr.type === 'io' && t(tr.source) === 'FUNC' && t(tr.target) === 'FLOW') push(producers, tr.target, tr.source);
    else if (tr.type === 'io' && t(tr.source) === 'FLOW' && t(tr.target) === 'FUNC') push(consumers, tr.source, tr.target);
    else if (tr.type === 'relation' && t(tr.source) === 'FLOW' && t(tr.target) === 'SCHEMA') push(schemasOf, tr.source, tr.target);
  }
  return { producers, consumers, schemasOf };
}

function childGraph(graph, container, byId, idx) {
  const ownerOf = new Map();
  for (const child of container.children) for (const n of containerClosure(graph, [child])) ownerOf.set(n, child);

  const edges = new Set();
  const boundary = new Set();
  for (const f of new Set([...idx.producers.keys(), ...idx.consumers.keys()])) {
    const contracts = idx.schemasOf.get(f) ?? [`UNBOUND:${f}`];
    const P = idx.producers.get(f) ?? [], C = idx.consumers.get(f) ?? [];
    for (const p of P) for (const c of C) {
      const op = ownerOf.get(p), oc = ownerOf.get(c);
      if (op && oc) { if (op !== oc) edges.add(`${op} ${oc}`); }
      else if (op || oc) for (const k of contracts) boundary.add(k);
    }
  }
  return {
    elements: container.children.map((id) => byId.get(id)).filter(Boolean),
    traces: [...edges].map((k) => { const [source, target] = k.split(' '); return { source, target, type: 'io' }; }),
    boundary: boundary.size,
  };
}

// ---------------------------------------------------------------------------
// S3 — Aggregat. Nur Container mit >= 2 Kindern sind messbar; Ein-Kind-Container
// werden GEZAEHLT statt gemessen — sie sind die Signatur von "alles in einen".
// ---------------------------------------------------------------------------
const MIN_CHILDREN = 2;
function recursive(graph) {
  const { byId, containers, multiParent } = structure(graph);
  const idx = ioIndex(graph, byId);
  const rows = [];
  let singleChild = 0;
  for (const c of containers) {
    if (c.children.length < MIN_CHILDREN) { singleChild++; continue; }
    const cg = childGraph(graph, c, byId, idx);
    const v = vecOf(cg);
    rows.push({ id: c.id, n: c.children.length, boundary: cg.boundary, edges: cg.traces.length, v, w: dot(v) });
  }
  if (!rows.length) return { min: NaN, mean: NaN, neutral: NaN, rows: [], singleChild, multiParent, maxBreadth: 0, maxBoundary: 0 };
  rows.sort((a, b) => a.w - b.w);
  // ITERATION 2 (s. Kopf "Korrektur"): Aggregat ueber ELEMENTE, nicht ueber Container.
  // Jedes Kind gehoert zu genau einem Container; eine geloeschte Ebene verschiebt Elemente,
  // sie entfernt sie nicht. Damit ist das Aggregat invariant gegen die Container-ZAHL --
  // die Eigenschaft, die `min` fehlt und die der Degenerat sonst ausnutzt.
  const mass = rows.reduce((a, r) => a + r.n, 0);
  const mean = rows.reduce((a, r) => a + r.n * r.w, 0) / mass;
  const neutral = rows.reduce((a, r) => a + r.n * (r.v.reduce((x, y) => x + y, 0) / r.v.length), 0) / mass;
  // SENSITIVITAET (Iteration 3): ein Container ohne innere io-Kante traegt kein Signal.
  // Familien-Konvention `moduleMetrics.instability` -- "null when no signal, no substitute value".
  const meas = rows.filter((r) => r.edges > 0);
  const mMass = meas.reduce((a, r) => a + r.n, 0);
  const meanM = mMass ? meas.reduce((a, r) => a + r.n * r.w, 0) / mMass : NaN;
  const neutralM = mMass ? meas.reduce((a, r) => a + r.n * (r.v.reduce((x, y) => x + y, 0) / r.v.length), 0) / mMass : NaN;
  return {
    min: rows[0].w,
    mean,
    neutral,
    meanM,
    neutralM,
    unmeasurable: rows.length - meas.length,
    measured: meas.length,
    rows,
    singleChild,
    multiParent,
    maxBreadth: Math.max(...rows.map((r) => r.n)),
    maxBoundary: Math.max(...rows.map((r) => r.boundary)),
  };
}

// ---------------------------------------------------------------------------
// S4 — Degenerate, abgeleitet aus EINEM Graphen (bok, nach Urteil der beste):
// gleicher Inhalt, nur die Struktur zerstoert. Jeder muss unter sein Original.
// ---------------------------------------------------------------------------
const clone = (g) => ({ elements: g.elements.map((e) => ({ ...e })), traces: g.traces.map((t) => ({ ...t })) });
const typeMap = (g) => new Map(g.elements.map((e) => [e.id, e.type]));
const isNesting = (bt) => (tr) => {
  const s = bt.get(tr.source), t = bt.get(tr.target);
  return (tr.type === 'compose' && s === 'FUNC' && t === 'FUNC') || (tr.type === 'compose' && s === 'MOD' && t === 'MOD') || tr.type === 'allocate';
};

function degAllInOne(base) {
  const g = clone(base), bt = typeMap(base);
  const funcs = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id);
  g.elements = g.elements.filter((e) => e.type !== 'MOD');
  g.elements.push({ id: 'MOD-mono', type: 'MOD', name: 'Monolith' });
  g.traces = g.traces.filter((tr) => !isNesting(bt)(tr) && bt.get(tr.source) !== 'MOD' && bt.get(tr.target) !== 'MOD');
  for (const f of funcs) g.traces.push({ source: f, target: 'MOD-mono', type: 'allocate' });
  return g;
}
function degOnePer(base) {
  const g = clone(base), bt = typeMap(base);
  const funcs = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id);
  g.elements = g.elements.filter((e) => e.type !== 'MOD');
  g.traces = g.traces.filter((tr) => !isNesting(bt)(tr) && bt.get(tr.source) !== 'MOD' && bt.get(tr.target) !== 'MOD');
  for (const f of funcs) { g.elements.push({ id: `MOD-${f}`, type: 'MOD', name: `mod ${f}` }); g.traces.push({ source: f, target: `MOD-${f}`, type: 'allocate' }); }
  return g;
}
function degFlat(base) {
  const g = clone(base), bt = typeMap(base);
  g.traces = g.traces.filter((tr) => !(tr.type === 'compose' && ((bt.get(tr.source) === 'FUNC' && bt.get(tr.target) === 'FUNC') || (bt.get(tr.source) === 'MOD' && bt.get(tr.target) === 'MOD'))));
  return g;
}
function degWired(base) {
  const g = clone(base);
  const funcs = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id);
  let k = 0;
  for (const a of funcs) for (const b of funcs) {
    if (a >= b) continue;
    const fl = `FLOW-x${k++}`;
    g.elements.push({ id: fl, type: 'FLOW', name: fl });
    g.traces.push({ source: a, target: fl, type: 'io' }, { source: fl, target: b, type: 'io' });
  }
  return g;
}

// ---------------------------------------------------------------------------
const R = '/Users/andreas/Developer/dev';
const REAL = [
  ['bok', `${R}/bok/docs/graph/bok.graph.json`],
  ['graph-view-edit', `${R}/graph-view-edit/docs/graph/graph-view-edit.graph.json`],
  ['graphcode', 'docs/graph/graphcode.graph.json'],
  ['sirail', `${R}/sirail/docs/graph/sirail.graph.json`],
  ['moneyflow-NEGATIVKONTROLLE', `${R}/moneyflow/docs/graph/moneyflow.graph.json`],
];

console.log('# Spike CR-SM-281 2.7 - rekursive Messung je Container\n');
console.log('Containment: gve `containerClosure` (importiert, nicht kopiert) - Formeln: `metrics()` aus se-engine');
console.log(`Gewichte: ${JSON.stringify(W)}\n`);

console.log('## S1 - Baum-Vorpruefung (Abbruch, wenn mehr als wenige Knoten zwei compose-Eltern haben)\n');
console.log('Iteration 2: `min` als Aggregat verworfen (nicht container-zahl-invariant, s. CR 2.9); Aggregat ist das elementgewichtete Mittel.\n');
console.log('| Graph | Elemente | Container (>=2 Kinder) | Ein-Kind-Container | Knoten mit 2+ compose-Eltern |');
console.log('|---|---:|---:|---:|---:|');
const loaded = REAL.map(([name, p]) => [name, file(p)]);
const recs = new Map();
for (const [name, g] of loaded) {
  const r = recursive(g);
  recs.set(name, r);
  console.log(`| ${name} | ${g.elements.length} | ${r.rows.length} | ${r.singleChild} | ${r.multiParent.length}${r.multiParent.length ? ' WARN' : ''} |`);
}

console.log('\n## S2/S3 - je Graph. AGGREGAT = elementgewichtetes Mittel (Iteration 2), `min` nur noch Diagnose\n');
console.log('| Graph | **mean w*m** | neutral (Gewichte 1) | min (Diagnose) | max Kinder | max Rand (Vertraege) | schlechtester Container |');
console.log('|---|---:|---:|---:|---:|---:|---|');
for (const [name] of loaded) {
  const r = recs.get(name), worst = r.rows[0];
  console.log(`| ${name} | **${n3(r.mean)}** | ${n3(r.neutral)} | ${n3(r.min)} | ${r.maxBreadth} | ${r.maxBoundary} | ${worst ? `${worst.id} (${worst.n} Kinder, Rand ${worst.boundary})` : '-'} |`);
}

console.log('\n### Sensitivitaet (Iteration 3): Container ohne innere io-Kante ausgeschlossen\n');
console.log('| Graph | messbar / gesamt | mean(messbar) | neutral(messbar) |');
console.log('|---|---:|---:|---:|');
for (const [name] of loaded) { const r = recs.get(name); console.log(`| ${name} | ${r.measured} / ${r.rows.length} | ${n3(r.meanM)} | ${n3(r.neutralM)} |`); }
const mfM = recs.get('moneyflow-NEGATIVKONTROLLE');
const govM = loaded.filter(([n]) => n !== 'moneyflow-NEGATIVKONTROLLE').map(([n]) => recs.get(n));
console.log(`\nMuss 1 unter Ausschluss: ${govM.every((r) => mfM.meanM < r.meanM) ? 'haelt' : 'reisst'} (gewichtet) / ${govM.every((r) => mfM.neutralM < r.neutralM) ? 'haelt' : 'reisst'} (neutral)`);

console.log('\n### Muss 1 - moneyflow unter jedem governten Graphen?\n');
const mf = recs.get('moneyflow-NEGATIVKONTROLLE').mean;
const mfN = recs.get('moneyflow-NEGATIVKONTROLLE').neutral;
const governed = loaded.filter(([n]) => n !== 'moneyflow-NEGATIVKONTROLLE').map(([n]) => [n, recs.get(n).mean]);
const ok1 = governed.every(([, v]) => mf < v);
const ok1n = loaded.filter(([n]) => n !== 'moneyflow-NEGATIVKONTROLLE').every(([n]) => mfN < recs.get(n).neutral);
console.log(`moneyflow mean = ${n3(mf)} | governte Mittel: ${governed.map(([n, v]) => `${n} ${n3(v)}`).join(' | ')}`);
console.log(`neutral gewichtet: moneyflow ${n3(mfN)} vs ${loaded.filter(([n]) => n !== 'moneyflow-NEGATIVKONTROLLE').map(([n]) => `${n} ${n3(recs.get(n).neutral)}`).join(' | ')} -> ${ok1n ? 'haelt' : 'reisst'}`);
console.log(`**${ok1 ? 'GO' : 'NO-GO'}** - ${ok1 ? 'die Negativkontrolle haelt.' : 'moneyflow ueberholt einen governten Graphen.'}\n`);

console.log('### Muss 2 - die vier Degenerate, abgeleitet aus bok (gleicher Inhalt, zerstoerte Struktur)\n');
const bok = loaded.find(([n]) => n === 'bok')[1];
const DEG = [['alles-in-ein-MOD', degAllInOne(bok)], ['jede-FUNC-ein-MOD', degOnePer(bok)], ['flach-ohne-Ebene', degFlat(bok)], ['maximal-verkantet', degWired(bok)]];
console.log('| Degenerat (aus bok) | mean w*m | neutral | Container | Ein-Kind | max Kinder | max Rand | unter bok? |');
console.log('|---|---:|---:|---:|---:|---:|---:|---|');
const bokMean = recs.get('bok').mean, bokNeutral = recs.get('bok').neutral;
let ok2 = true, ok2n = true;
for (const [name, g] of DEG) {
  const r = recursive(g);
  const pass = r.mean < bokMean;
  const passN = r.neutral < bokNeutral;
  ok2 = ok2 && pass; ok2n = ok2n && passN;
  console.log(`| ${name} | ${n3(r.mean)} | ${n3(r.neutral)} | ${r.rows.length} | ${r.singleChild} | ${r.maxBreadth} | ${r.maxBoundary} | ${pass ? 'ja' : 'NEIN'}${passN ? '' : ' (neutral auch NEIN)'} |`);
}
console.log(`\n**${ok2 ? 'GO' : 'NO-GO'}** - bok mean = ${n3(bokMean)}, neutral ${n3(bokNeutral)} (neutral: ${ok2n ? 'GO' : 'NO-GO'})\n`);

console.log('### Muss 3 - die vier Paare aus Teil 1 (P1 global: -0,129 gegen die Doktrin)\n');
const P = [['P1 Ebene einziehen (CR-GC-459)', '4cb5a3b^', '4cb5a3b'], ['P2 Messung in den Kern', 'c826ff2', 'ae4b57d'], ['P3 measure als Sub-MOD', 'ae4b57d', 'f2f3b62'], ['P4 Graph-State hat einen Schreiber', 'e197995', 'b8e17f3']];
console.log('| Paar | mean vorher | mean nachher | d mean | d neutral | rankt richtig? |');
console.log('|---|---:|---:|---:|---:|---|');
for (const [label, a, b] of P) {
  const ra = recursive(at(a)), rb = recursive(at(b));
  const d = rb.mean - ra.mean, dn = rb.neutral - ra.neutral;
  console.log(`| ${label} | ${n3(ra.mean)} | ${n3(rb.mean)} | ${(d >= 0 ? '+' : '') + n3(d)} | ${(dn >= 0 ? '+' : '') + n3(dn)} | ${d > 1e-6 ? 'ja' : d < -1e-6 ? 'NEIN' : 'blind'} |`);
}

console.log('\n## Streuung je Dimension ueber alle gemessenen Container (Entscheidung 3)\n');
const all = [...recs.values()].flatMap((r) => r.rows.map((x) => x.v));
console.log('| Dimension | min | max | Spanne |');
console.log('|---|---:|---:|---:|');
METRIC_DIMENSIONS.forEach((d, i) => {
  const xs = all.map((v) => v[i]);
  const mn = Math.min(...xs), mx = Math.max(...xs);
  console.log(`| ${d} | ${n3(mn)} | ${n3(mx)} | ${n3(mx - mn)}${mx - mn < 0.3 ? ' UNTER 0,3' : ''} |`);
});

console.log('\n## Die drei schlechtesten Container je governtem Graphen (Diagnose)\n');
for (const [name] of loaded) {
  const r = recs.get(name);
  console.log(`**${name}** - ${r.rows.slice(0, 3).map((x) => `${x.id}: w*m ${n3(x.w)}, ${x.n} Kinder, Rand ${x.boundary}, Kanten ${x.edges}`).join(' | ') || '-'}`);
}
