#!/usr/bin/env node
/**
 * CR-SM-282 — Spike: was meldet der Blackbox-Regelsatz (L1/L2) an echten Graphen?
 * READ-ONLY, kein Produktionscode, kein Lock.
 *
 * Frage (eine): ist das Signal oder Flut? Eine Regel, die auf dem als gut beurteilten
 * Graphen dutzendfach feuert, ist keine Regel.
 *
 * B1 TR-01   - Baum-Eigenschaft (hoechstens ein compose-Elternteil)
 * B2 Breite  - Kinder je Blackbox INKLUSIVE Wurzelcontainer (den RD-04 heute nicht sieht)
 * B3 Rand    - verschiedene Vertraege je Blackbox, MOD mit und OHNE Compose-Rollup.
 *              Die Differenz ist der Beleg, dass BW-01 etwas hinzufuegt.
 * B4 Schwellen-Sensitivitaet ueber den Schwellenraum.
 *
 * Zaehlbasis Rand = verschiedene SCHEMA (CR-SM-274/276), nicht rohe io-Kanten.
 * Containment: gves `containerClosure` per Pfad importiert, nicht kopiert (CR-SM-281 2.8).
 *
 * Aufruf aus dem graphcode-Repo: node scripts/spike-blackbox-regeln.mjs
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { containerClosure } from '/Users/andreas/Developer/dev/graph-view-edit/src/behavior-flow.mjs';

const R = '/Users/andreas/Developer/dev';
const GRAPHS = [
  ['bok', `${R}/bok/docs/graph/bok.graph.json`, '0 Fehler, als gut beurteilt'],
  ['graph-view-edit', `${R}/graph-view-edit/docs/graph/graph-view-edit.graph.json`, '11 Fehler'],
  ['graphcode', 'docs/graph/graphcode.graph.json', '0 Fehler'],
  ['sirail', `${R}/sirail/docs/graph/sirail.graph.json`, '89 Fehler - nicht konform'],
  ['moneyflow', `${R}/moneyflow/docs/graph/moneyflow.graph.json`, 'Negativkontrolle, 306 Wurzeln'],
];

const load = (p) => { const r = JSON.parse(readFileSync(p, 'utf8')); return { elements: r.elements, traces: r.traces }; };
const push = (m, k, v) => { const s = m.get(k); if (s) s.push(v); else m.set(k, [v]); };
const addTo = (m, k, v) => { const s = m.get(k); if (s) s.add(v); else m.set(k, new Set([v])); };

// ---------------------------------------------------------------------------
// Struktur: Blackboxes je Traeger. Der WURZELCONTAINER ist eine Blackbox --
// genau die, die RD-04 heute nicht sieht (moneyflow: 306 Kinder, RD-04 meldet 0).
// ---------------------------------------------------------------------------
function blackboxes(graph) {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const t = (id) => byId.get(id)?.type;
  const kids = new Map();
  const composeParents = new Map();
  for (const tr of graph.traces) {
    const s = t(tr.source), g = t(tr.target);
    if (tr.type === 'compose' && s === 'FUNC' && g === 'FUNC') { addTo(kids, tr.source, tr.target); push(composeParents, tr.target, tr.source); }
    else if (tr.type === 'compose' && s === 'MOD' && g === 'MOD') { addTo(kids, tr.source, tr.target); push(composeParents, tr.target, tr.source); }
    else if (tr.type === 'allocate' && s === 'FUNC' && g === 'MOD') addTo(kids, tr.target, tr.source);
  }
  const hasParent = new Set(composeParents.keys());
  const rootF = graph.elements.filter((e) => e.type === 'FUNC' && !hasParent.has(e.id)).map((e) => e.id);
  const rootM = graph.elements.filter((e) => e.type === 'MOD' && !hasParent.has(e.id)).map((e) => e.id);

  const boxes = [];
  if (rootF.length) boxes.push({ id: 'ROOT:FUNC', carrier: 'FUNC', root: true, children: rootF });
  if (rootM.length) boxes.push({ id: 'ROOT:MOD', carrier: 'MOD', root: true, children: rootM });
  for (const [id, set] of kids) boxes.push({ id, carrier: t(id), root: false, children: [...set] });

  // TR-01: mehr als ein VERSCHIEDENER compose-Elternteil.
  const treeViolations = [...composeParents.entries()]
    .filter(([, ps]) => new Set(ps).size > 1)
    .map(([child, ps]) => ({ child, parents: [...new Set(ps)] }));

  return { byId, boxes, treeViolations };
}

// ---------------------------------------------------------------------------
// Rand: verschiedene Vertraege, die den Rand DIESER Blackbox queren.
//   rollup=true  -> Mitgliedschaft ueber containerClosure (BW-01/BW-02, neu)
//   rollup=false -> nur DIREKTE allocate-Kanten (heutige module-crossings.ts)
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

function directMembers(graph, box, byId) {
  // Heutige Semantik: nur direkt allozierte FUNCs zaehlen als Mitglieder eines MODs.
  if (box.root) return new Set();
  const t = (id) => byId.get(id)?.type;
  const set = new Set();
  if (box.carrier === 'MOD') {
    for (const tr of graph.traces) if (tr.type === 'allocate' && tr.target === box.id && t(tr.source) === 'FUNC') set.add(tr.source);
  } else {
    set.add(box.id);
    for (const tr of graph.traces) if (tr.type === 'compose' && tr.source === box.id && t(tr.target) === 'FUNC') set.add(tr.target);
  }
  return set;
}

function boundaryOf(graph, box, byId, idx, rollup) {
  const inside = rollup ? containerClosure(graph, [box.id, ...box.children]) : directMembers(graph, box, byId);
  const contracts = new Set();
  for (const f of new Set([...idx.producers.keys(), ...idx.consumers.keys()])) {
    const P = idx.producers.get(f) ?? [], C = idx.consumers.get(f) ?? [];
    const anyIn = P.some((x) => inside.has(x)) || C.some((x) => inside.has(x));
    const anyOut = P.some((x) => !inside.has(x)) || C.some((x) => !inside.has(x));
    if (anyIn && anyOut) for (const k of idx.schemasOf.get(f) ?? [`UNBOUND:${f}`]) contracts.add(k);
  }
  return contracts.size;
}

function analyse(graph) {
  const { byId, boxes, treeViolations } = blackboxes(graph);
  const idx = ioIndex(graph, byId);
  const rows = boxes.map((b) => ({
    id: b.id,
    carrier: b.carrier,
    root: b.root,
    n: b.children.length,
    boundary: boundaryOf(graph, b, byId, idx, true),
    boundaryLeafOnly: b.root ? null : boundaryOf(graph, b, byId, idx, false),
  }));
  return { rows, treeViolations };
}

// ---------------------------------------------------------------------------
const data = GRAPHS.map(([name, p, note]) => {
  const g = load(p);
  return { name, note, g, a: analyse(g) };
});

console.log('# Spike CR-SM-282 - Blackbox-Regeln L1/L2\n');
console.log('Containment: gves `containerClosure` (importiert). Rand-Zaehlbasis: verschiedene SCHEMA (CR-SM-274/276).\n');

console.log('## B1 - TR-01: hoechstens ein compose-Elternteil\n');
console.log('| Graph | Blackboxes | davon Wurzel | TR-01-Verstoesse |');
console.log('|---|---:|---:|---:|');
for (const d of data) console.log(`| ${d.name} | ${d.a.rows.length} | ${d.a.rows.filter((r) => r.root).length} | ${d.a.treeViolations.length} |`);
const trTotal = data.reduce((s, d) => s + d.a.treeViolations.length, 0);
console.log(`\n**TR-01 gesamt: ${trTotal} Verstoesse.** ${trTotal === 0 ? 'Regel kann sofort auf `error` - Absicherung, keine Aufraeumarbeit.' : 'ACHTUNG: Datenkorrektur noetig, TR-01 kann nicht sofort hart werden.'}\n`);

console.log('## B2 - Breite je Blackbox (Verteilung, nicht Maximum)\n');
console.log('| Graph | Blackboxes | max | p90 | Median | >=5 | >=12 | Wurzelcontainer (Kinder) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---|');
const q = (xs, p) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : 0);
for (const d of data) {
  const ns = d.a.rows.map((r) => r.n);
  const roots = d.a.rows.filter((r) => r.root).map((r) => `${r.id}=${r.n}`).join(', ');
  console.log(`| ${d.name} | ${ns.length} | ${Math.max(...ns)} | ${q(ns, 0.9)} | ${q(ns, 0.5)} | ${ns.filter((x) => x >= 5).length} | ${ns.filter((x) => x >= 12).length} | ${roots || '-'} |`);
}

console.log('\n## B3 - Rand je Blackbox: MIT Compose-Rollup (BW-01/02) gegen die heutige Blatt-Rechnung\n');
console.log('| Graph | max Rand (Rollup) | max Rand (heute) | Blackboxes mit Differenz | groesste Differenz |');
console.log('|---|---:|---:|---:|---|');
let rollupAdds = 0;
for (const d of data) {
  const withR = d.a.rows.map((r) => r.boundary);
  const leaf = d.a.rows.filter((r) => r.boundaryLeafOnly !== null);
  const diff = leaf.filter((r) => r.boundary !== r.boundaryLeafOnly);
  rollupAdds += diff.length;
  const biggest = diff.slice().sort((a, b) => (b.boundary - b.boundaryLeafOnly) - (a.boundary - a.boundaryLeafOnly))[0];
  console.log(`| ${d.name} | ${Math.max(...withR)} | ${leaf.length ? Math.max(...leaf.map((r) => r.boundaryLeafOnly)) : 0} | ${diff.length} / ${leaf.length} | ${biggest ? `${biggest.id}: ${biggest.boundaryLeafOnly} -> ${biggest.boundary}` : '-'} |`);
}
console.log(`\n**Muss 3 (Rollup fuegt etwas hinzu): ${rollupAdds > 0 ? `GO - ${rollupAdds} Blackboxes melden mit Rollup eine andere Zahl.` : 'NO-GO - BW-01 waere ueberfluessig und entfaellt aus dem CR.'}**\n`);

console.log('## B4 - Schwellen-Sensitivitaet: Befunde je Graph\n');
const BW = [3, 5, 7, 10];
const BR = [5, 8, 11];
console.log('### Breite (Zahl der Blackboxes ueber der Schwelle)\n');
console.log('| Graph | ' + BR.map((x) => `>=${x}`).join(' | ') + ' |');
console.log('|---|' + BR.map(() => '---:').join('|') + '|');
for (const d of data) console.log(`| ${d.name} | ${BR.map((s) => d.a.rows.filter((r) => r.n >= s).length).join(' | ')} |`);
console.log('\n### Randbreite (Zahl der Blackboxes ueber der Schwelle, mit Rollup)\n');
console.log('| Graph | ' + BW.map((x) => `>=${x}`).join(' | ') + ' |');
console.log('|---|' + BW.map(() => '---:').join('|') + '|');
for (const d of data) console.log(`| ${d.name} | ${BW.map((s) => d.a.rows.filter((r) => r.boundary >= s).length).join(' | ')} |`);

console.log('\n## Muss 1 - Signal statt Flut: was traegt bok (0 Fehler, als gut beurteilt)?\n');
const bok = data.find((d) => d.name === 'bok');
console.log('| Schwellenpaar (Breite warning / Rand warning) | bok warnings | graphcode | moneyflow |');
console.log('|---|---:|---:|---:|');
for (const br of BR) for (const bw of BW) {
  const cnt = (d) => d.a.rows.filter((r) => r.n >= br || r.boundary >= bw).length;
  console.log(`| ${br} / ${bw} | ${cnt(bok)} | ${cnt(data.find((d) => d.name === 'graphcode'))} | ${cnt(data.find((d) => d.name === 'moneyflow'))} |`);
}

console.log('\n## Muss 2 - feuern die bekannt schlechten Strukturen?\n');
for (const d of data) {
  const worst = d.a.rows.slice().sort((a, b) => b.n - a.n)[0];
  const widest = d.a.rows.slice().sort((a, b) => b.boundary - a.boundary)[0];
  console.log(`- **${d.name}** (${d.note}): breiteste Blackbox \`${worst.id}\` mit ${worst.n} Kindern; groesster Rand \`${widest.id}\` mit ${widest.boundary} Vertraegen`);
}

// Degenerate aus bok (CR-SM-281 S4, gleicher Inhalt, zerstoerte Struktur) - Muss 2, zweiter Teil.
const clone = (g) => ({ elements: g.elements.map((e) => ({ ...e })), traces: g.traces.map((x) => ({ ...x })) });
const tm = (g) => new Map(g.elements.map((e) => [e.id, e.type]));
const nest = (bt) => (x) => (x.type === 'compose' && ((bt.get(x.source) === 'FUNC' && bt.get(x.target) === 'FUNC') || (bt.get(x.source) === 'MOD' && bt.get(x.target) === 'MOD'))) || x.type === 'allocate';
const base = data.find((d) => d.name === 'bok').g;
function allInOne(b) { const g = clone(b), bt = tm(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); g.elements = g.elements.filter((e) => e.type !== 'MOD'); g.elements.push({ id: 'MOD-mono', type: 'MOD', name: 'Monolith' }); g.traces = g.traces.filter((x) => !nest(bt)(x) && bt.get(x.source) !== 'MOD' && bt.get(x.target) !== 'MOD'); for (const i of f) g.traces.push({ source: i, target: 'MOD-mono', type: 'allocate' }); return g; }
function onePer(b) { const g = clone(b), bt = tm(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); g.elements = g.elements.filter((e) => e.type !== 'MOD'); g.traces = g.traces.filter((x) => !nest(bt)(x) && bt.get(x.source) !== 'MOD' && bt.get(x.target) !== 'MOD'); for (const i of f) { g.elements.push({ id: 'MOD-' + i, type: 'MOD', name: i }); g.traces.push({ source: i, target: 'MOD-' + i, type: 'allocate' }); } return g; }
function flat(b) { const g = clone(b), bt = tm(b); g.traces = g.traces.filter((x) => !(x.type === 'compose' && ((bt.get(x.source) === 'FUNC' && bt.get(x.target) === 'FUNC') || (bt.get(x.source) === 'MOD' && bt.get(x.target) === 'MOD')))); return g; }
function wired(b) { const g = clone(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); let k = 0; for (const x of f) for (const y of f) { if (x >= y) continue; const fl = 'FLOW-x' + k++; g.elements.push({ id: fl, type: 'FLOW', name: fl }); g.traces.push({ source: x, target: fl, type: 'io' }, { source: fl, target: y, type: 'io' }); } return g; }

console.log('\n## Muss 2, zweiter Teil - die vier Degenerate aus bok (Schwellen 11 / 5)\n');
console.log('| Zustand | Blackboxes | max Breite | max Rand | Befunde (n>=11 oder Rand>=5) |');
console.log('|---|---:|---:|---:|---:|');
for (const [nm, gg] of [['bok (Original)', base], ['alles-in-ein-MOD', allInOne(base)], ['jede-FUNC-ein-MOD', onePer(base)], ['flach-ohne-Ebene', flat(base)], ['maximal-verkantet', wired(base)]]) {
  const a = analyse(gg);
  const hits = a.rows.filter((r) => r.n >= 11 || r.boundary >= 5).length;
  console.log(`| ${nm} | ${a.rows.length} | ${Math.max(...a.rows.map((r) => r.n))} | ${Math.max(...a.rows.map((r) => r.boundary))} | ${hits} |`);
}

console.log('\n## Soll - korreliert die Befundzahl mit dem Urteil?\n');
console.log('| Graph | Blackboxes | Befunde bei 5/3 | Befunde je Blackbox |');
console.log('|---|---:|---:|---:|');
for (const d of data) {
  const f = d.a.rows.filter((r) => r.n >= 5 || r.boundary >= 3).length;
  console.log(`| ${d.name} | ${d.a.rows.length} | ${f} | ${(f / d.a.rows.length).toFixed(2)} |`);
}
