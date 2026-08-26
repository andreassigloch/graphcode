#!/usr/bin/env node
// CR-GC-436 (Spike, Trockenübung) — Vermessung der beiden Top-Sichten des Selbstmodells:
//   1. TOP-Level-Funktionssicht (Blöcke + gehobene io-Kanten, wie die zugeklappte layout-flow-View)
//   2. TOP-MOD-Sicht (abgeleitete Modul-Kopplung: FUNC-allocate-MOD × FUNC-io-FLOW-io-FUNC)
// plus die natürliche Community-Struktur (CNM aus @sigloch/se-engine) als Gegenprobe zum
// deklarierten Schnitt. NUR LESEN — kein Store, kein Gate, kein Write (CR-436: Trockenübung).
// Usage: node scripts/spike-arch-top-views.mjs
// @author andreas@siglochconsulting
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { moduleMetrics } from '@sigloch/contracts/se';
import { buildAdjacency, detectCommunities, modularityOf, modularityQ } from '@sigloch/se-engine';
import { elementToNode } from '../dist/index.js';
import { toOntologyGraph } from '../dist/conformance.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'docs/graph/graphcode.graph.json'), 'utf8'));

const nodes = raw.elements.map(elementToNode);
const edges = raw.traces.map(({ source, target, type, ...rest }) => ({ sourceId: source, targetId: target, edgeType: type, attributes: rest }));
const graph = { nodes, edges };
const og = toOntologyGraph(graph);

const type = new Map(nodes.map((n) => [n.uid, n.type]));
const name = new Map(nodes.map((n) => [n.uid, n.name]));

// ── FUNC-Hierarchie: Blatt → oberster Block (die Hebung der zugeklappten Sicht) ──
const parent = new Map();
for (const e of edges) if (e.edgeType === 'compose' && type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FUNC') parent.set(e.targetId, e.sourceId);
const top = (id) => { let x = id; while (parent.has(x)) x = parent.get(x); return x; };

// ── Blatt-Verbindungen: producer-FUNC → FLOW → consumer-FUNC (der 434er-Nenner) ──
const producersOf = new Map(); // flow -> FUNC[]
const consumersOf = new Map();
for (const e of edges.filter((e) => e.edgeType === 'io')) {
  if (type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FLOW') (producersOf.get(e.targetId) ?? producersOf.set(e.targetId, []).get(e.targetId)).push(e.sourceId);
  if (type.get(e.sourceId) === 'FLOW' && type.get(e.targetId) === 'FUNC') (consumersOf.get(e.sourceId) ?? consumersOf.set(e.sourceId, []).get(e.sourceId)).push(e.targetId);
}
const alloc = new Map();
for (const e of edges.filter((e) => e.edgeType === 'allocate' && type.get(e.sourceId) === 'FUNC')) alloc.set(e.sourceId, e.targetId);
const modOf = (f) => alloc.get(f) ?? alloc.get(top(f)); // Blatt zuerst, sonst Block-Allokation

const leafPairs = []; // {from,to,flow}
for (const [flow, cons] of consumersOf) for (const c of cons) for (const p of producersOf.get(flow) ?? []) {
  if (p !== c) leafPairs.push({ from: p, to: c, flow });
}
const intra = leafPairs.filter((x) => modOf(x.from) && modOf(x.from) === modOf(x.to));
console.log(`\n== Blatt-Ebene (der CR-436-Nenner) — graphVersion ${raw.graphVersion}`);
console.log(`FUNC→FUNC-Verbindungen via FLOW: ${leafPairs.length} · davon modulintern: ${intra.length} (${(100 * intra.length / leafPairs.length).toFixed(1)} %)`);

// ── Sicht 1: TOP-Level-Funktionssicht ──
const withActors = [];
for (const e of edges.filter((e) => e.edgeType === 'io')) {
  const s = type.get(e.sourceId), t = type.get(e.targetId);
  if (s === 'ACTOR' && t === 'FLOW') for (const c of consumersOf.get(e.targetId) ?? []) withActors.push({ from: e.sourceId, to: top(c), flow: e.targetId });
  if (s === 'FLOW' && t === 'ACTOR') for (const p of producersOf.get(e.sourceId) ?? []) withActors.push({ from: top(p), to: e.targetId, flow: e.sourceId });
}
const topPairs = new Map(); // 'a>b' -> Set(flow)
for (const { from, to, flow } of leafPairs) {
  const a = top(from), b = top(to);
  if (a === b) continue;
  const k = `${a}>${b}`;
  (topPairs.get(k) ?? topPairs.set(k, new Set()).get(k)).add(flow);
}
const topPairsAct = new Map([...topPairs].map(([k, v]) => [k, new Set(v)]));
for (const { from, to, flow } of withActors) {
  const k = `${from}>${to}`;
  (topPairsAct.get(k) ?? topPairsAct.set(k, new Set()).get(k)).add(flow);
}
const inst = (m) => [...m.values()].reduce((a, s) => a + s.size, 0);
const topFuncs = new Set([...new Set(nodes.filter((n) => n.type === 'FUNC').map((n) => top(n.uid)))]);
const bidir = [...topPairs.keys()].filter((k) => topPairs.has(k.split('>').reverse().join('>')));
console.log(`\n== Sicht 1 — TOP-Level-Funktionssicht`);
console.log(`Blöcke: ${topFuncs.size} · gerichtete Block-Kanten: ${topPairs.size} (Instanzen: ${inst(topPairs)})`);
console.log(`… mit ACTORen: Kanten ${topPairsAct.size} (Instanzen: ${inst(topPairsAct)})`);
console.log(`bidirektionale Block-Paare (Kreuz-und-quer im engsten Sinn): ${bidir.length / 2}`);
const parallel = [...topPairs].filter(([, v]) => v.size > 1).sort((a, b) => b[1].size - a[1].size);
console.log(`parallele Kanten (>1 FLOW je gerichtetem Block-Paar): ${parallel.length} Paare, ${parallel.reduce((a, [, v]) => a + v.size - 1, 0)} überzählige Instanzen`);
for (const [k, v] of parallel.slice(0, 8)) console.log(`   ${k}  ×${v.size}  [${[...v].join(', ')}]`);

// ── Sicht 2: TOP-MOD-Sicht ──
const modPairs = new Map();
for (const { from, to, flow } of leafPairs) {
  const a = modOf(from), b = modOf(to);
  if (!a || !b || a === b) continue;
  const k = `${a}>${b}`;
  (modPairs.get(k) ?? modPairs.set(k, new Set()).get(k)).add(flow);
}
const undirMod = new Set([...modPairs.keys()].map((k) => k.split('>').sort().join('~')));
const modBidir = [...modPairs.keys()].filter((k) => modPairs.has(k.split('>').reverse().join('>')));
const mods = nodes.filter((n) => n.type === 'MOD');
console.log(`\n== Sicht 2 — TOP-MOD-Sicht (abgeleitete Kopplung)`);
console.log(`MODs: ${mods.length} · gerichtete MOD-Kanten: ${modPairs.size} · ungerichtete Paare: ${undirMod.size} · Instanzen: ${inst(modPairs)}`);
console.log(`bidirektionale MOD-Paare: ${modBidir.length / 2} · maximale Paardichte: ${undirMod.size}/${(mods.length * (mods.length - 1)) / 2}`);
const modParallel = [...modPairs].filter(([, v]) => v.size > 1).sort((a, b) => b[1].size - a[1].size);
for (const [k, v] of modParallel.slice(0, 10)) console.log(`   ${k}  ×${v.size}`);

// ── Modul-Kennzahlen (dieselbe Rechnung wie graph_metrics/MT-01/MT-02) ──
console.log(`\n== moduleMetrics (contracts) — Kohäsion je MOD`);
for (const m of moduleMetrics(og)) {
  const c = m.cohesion ? `int ${m.cohesion.internal} / ext ${m.cohesion.external} / ratio ${m.cohesion.ratio.toFixed(2)}` : 'n/a';
  console.log(`   ${m.moduleId.padEnd(22)} FUNCs ${String(m.allocatedFuncs).padStart(2)} · ${c} · lcom4 ${m.lcom4 ?? '—'}${m.rollupContainer ? ' (Rollup)' : ''}`);
}

// ── Natürliche Communities (CNM) vs. deklarierter Schnitt ──
const adj = buildAdjacency(og);
const communities = detectCommunities(adj);
const qNat = modularityQ(adj);
const declared = new Map();
{ let i = 0; const idx = new Map(); for (const f of alloc.keys()) { const m = alloc.get(f); if (!idx.has(m)) idx.set(m, i++); declared.set(f, idx.get(m)); } }
const qDecl = modularityOf(adj, new Map([...communities.keys()].map((k) => [k, declared.get(k) ?? -1])));
console.log(`\n== Communities: CNM-Q=${qNat.toFixed(3)} vs. deklarierter Schnitt Q=${qDecl.toFixed(3)}`);
const byComm = new Map();
for (const [id, c] of communities) { if (type.get(id) !== 'FUNC') continue; (byComm.get(c) ?? byComm.set(c, []).get(c)).push(id); }
const big = [...byComm.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length);
for (const [c, members] of big.slice(0, 12)) {
  const modsIn = [...new Set(members.map((f) => modOf(f) ?? '∅'))];
  console.log(`   C${c} (${members.length} FUNC, MODs: ${modsIn.join(', ')})`);
  console.log(`      ${members.slice(0, 10).join(', ')}${members.length > 10 ? ` …+${members.length - 10}` : ''}`);
}

// ── Hub-FLOWs (Fächer über Modul-/Blockgrenzen) ──
console.log(`\n== Hub-FLOWs (Blöcke×MODs, die ein FLOW verbindet)`);
const hubs = [];
for (const fl of new Set([...producersOf.keys(), ...consumersOf.keys()])) {
  const touching = new Set([...(producersOf.get(fl) ?? []), ...(consumersOf.get(fl) ?? [])]);
  const blocks = new Set([...touching].map(top));
  const ms = new Set([...touching].map((f) => modOf(f)).filter(Boolean));
  if (blocks.size >= 3) hubs.push({ fl, blocks: blocks.size, mods: ms.size, deg: touching.size });
}
hubs.sort((a, b) => b.blocks - a.blocks);
for (const h of hubs.slice(0, 10)) console.log(`   ${h.fl.padEnd(28)} Blöcke ${h.blocks} · MODs ${h.mods} · FUNCs ${h.deg}`);
