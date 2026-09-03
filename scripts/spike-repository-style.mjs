#!/usr/bin/env node
// CR-DRAFT-GC-466 — Spike M2 + M3, ohne Kuzu nachvollziehbar (liest nur die SSOT).
//
//   M2  Ist `architectural` ABLEITBAR? Menge A = die FLOWs, die am Gate-FUNC (`mutate`)
//       per `io` hängen — verglichen mit den drei in CR-DRAFT-GC-461 benannten Flüssen.
//   M3  CR-460 korrigiert: Strukturknoten (FUNC mit compose-Kindern, ohne realRef, ohne io)
//       aus dem arch-Teilgraphen — (A wörtlich) samt Kanten; (M3a) mit DURCHGEZOGENEN
//       compose-Pfaden; (M3b1) nur die Blattebene ohne compose. Je Variante der ℝ⁶-Vektor.
//
// Aufruf aus dem Repo: node scripts/spike-repository-style.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';

const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/graph/graphcode.graph.json', import.meta.url)), 'utf8'));
const G = { elements: raw.elements, traces: raw.traces };
const by = new Map(G.elements.map((e) => [e.id, e]));
const nm = (id) => (by.get(id)?.name ?? id).split(' — ')[0].split(' (')[0];
const rr = (e) => (e.attributes && e.attributes.realRef) || e.realRef;

// ---------------------------------------------------------------- M2
console.log('## M2 — Menge A: FLOWs am Gate-FUNC');
const gate = G.elements.find((e) => e.type === 'FUNC' && rr(e) && /kernel\/harness\.ts$/.test(rr(e).file) && rr(e).symbol === 'mutate');
const A = new Set();
for (const t of G.traces) {
  if (t.type !== 'io') continue;
  if (t.source === gate.id && by.get(t.target)?.type === 'FLOW') A.add(t.target);
  if (t.target === gate.id && by.get(t.source)?.type === 'FLOW') A.add(t.source);
}
const named = ['FLOW-graph-state', 'FLOW-mutate-cmd', 'FLOW-gate-verdict'];
console.log(`Gate: ${gate.id} (${gate.name})`);
console.log(`A = { ${[...A].map(nm).join(', ')} }`);
console.log(`benannt (CR-461) ⊆ A: ${named.every((n) => A.has(n))} · A \\ benannt: ${[...A].filter((f) => !named.includes(f)).map(nm).join(', ') || '–'}`);

// ---------------------------------------------------------------- M3
console.log('\n## M3 — Strukturknoten und der arch-Vektor');
const isFF = (t) => t.type === 'compose' && by.get(t.source)?.type === 'FUNC' && by.get(t.target)?.type === 'FUNC';
const hasKids = new Set(G.traces.filter(isFF).map((t) => t.source));
const hasIo = new Set(G.traces.filter((t) => t.type === 'io').flatMap((t) => [t.source, t.target]));
const structural = new Set(G.elements.filter((e) => e.type === 'FUNC' && hasKids.has(e.id) && !hasIo.has(e.id) && !rr(e)).map((e) => e.id));
const parentOf = new Map(G.traces.filter(isFF).map((t) => [t.target, t.source]));
const lift = (id) => { let p = parentOf.get(id); while (p && structural.has(p)) p = parentOf.get(p); return p; };
const naive = { elements: G.elements.filter((e) => !structural.has(e.id)), traces: G.traces.filter((t) => !structural.has(t.source) && !structural.has(t.target)) };
const contracted = { elements: naive.elements, traces: [] };
for (const t of G.traces) {
  if (structural.has(t.source) || structural.has(t.target)) {
    if (isFF(t) && structural.has(t.source) && !structural.has(t.target)) { const p = lift(t.target); if (p) contracted.traces.push({ ...t, source: p }); }
    continue;
  }
  contracted.traces.push(t);
}
const leaf = { elements: G.elements.filter((e) => !hasKids.has(e.id)), traces: G.traces.filter((t) => !isFF(t) && !hasKids.has(t.source) && !hasKids.has(t.target)) };
const base = metrics(G, { layer: 'arch' });
console.log(`Strukturknoten: ${structural.size}`);
console.log('| Variante | ' + METRIC_DIMENSIONS.join(' | ') + ' |');
console.log('|---|' + METRIC_DIMENSIONS.map(() => '---:').join('|') + '|');
for (const [label, g] of [['heute (flach)', G], ['CR-460 A wörtlich', naive], ['M3a Pfade durchgezogen', contracted], ['M3b1 Blattebene', leaf]]) {
  const m = metrics(g, { layer: 'arch' });
  console.log(`| ${label} | ` + METRIC_DIMENSIONS.map((d) => m[d].toFixed(3) + (g !== G ? ` (${m[d] - base[d] >= 0 ? '+' : ''}${(m[d] - base[d]).toFixed(3)})` : '')).join(' | ') + ' |');
}
