// Typ-Ökonomie: was kostet jeder Elementtyp im Graphen, und was passiert mit
// Trefferquote/Token, wenn CR und MS aus Seeds, Whitebox und Blast-Radius fallen?

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openFixture, sliceOf, tok, uidsOf } from './measure.mjs';
import { JOBS } from './jobs.mjs';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const fx = await openFixture(join(REPO, 'docs/graph/graphcode.graph.json'), 'diet');
const graph = fx.graph();

// Was kostet jeder Typ im GANZEN Graphen?
const byType = {};
for (const n of graph.nodes) {
  const t = (byType[n.type] ??= { n: 0, tok: 0 });
  t.n++; t.tok += tok(`${n.uid} ${n.name} ${n.description ?? ''}`);
}
const totalTok = Object.values(byType).reduce((a, b) => a + b.tok, 0);
console.log('=== Graph-Anteil je Typ (555 Knoten) ===');
for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].tok - a[1].tok))
  console.log(`${t.padEnd(7)} ${String(v.n).padStart(4)} Knoten  ${String(v.tok).padStart(6)} tok  ${(100*v.tok/totalTok).toFixed(1)}%`);
console.log(`${'GESAMT'.padEnd(7)} ${String(graph.nodes.length).padStart(4)} Knoten  ${String(totalTok).padStart(6)} tok`);

// Diät: CR + MS aus Seeds, W und B streichen — bleibt die Trefferquote?
const DIET = new Set(['CR', 'MS']);
for (const job of JOBS.filter((j) => j.name.startsWith('J2'))) {
  const seedsAll = job.seeds;
  const seedsDiet = seedsAll.filter((u) => !DIET.has(graph.nodes.find((n) => n.uid === u)?.type));

  const build = async (seeds, diet) => {
    const w = new Set(seeds);
    for (const s of seeds) {
      try { for (const u of uidsOf((await fx.reg['graph_context'].handler({ id: s, depth: 1 })).formatE)) w.add(u); } catch {}
    }
    if (diet) for (const u of [...w]) if (DIET.has(graph.nodes.find((n) => n.uid === u)?.type)) w.delete(u);
    return w;
  };
  const b = new Set();
  for (const s of seedsAll) for (const n of (await fx.harness.impact(s, 1)).nodes) b.add(n.uid);
  const bDiet = new Set([...b].filter((u) => !DIET.has(graph.nodes.find((n) => n.uid === u)?.type)));

  const wFull = await build(seedsAll, false);
  const wDiet = await build(seedsDiet, true);
  const gt = job.groundTruth;
  const sl = (s) => sliceOf(graph, s);
  console.log(`\n=== ${job.name.split(' ')[0]} ===`);
  console.log(`Seeds:  ${seedsAll.length} → ohne CR/MS: ${seedsDiet.length}`);
  console.log(`W voll: ${wFull.size} Knoten / ${tok(sl(wFull).formatE)} tok · GT ${gt.filter(u=>wFull.has(u)).length}/${gt.length}`);
  console.log(`W Diät: ${wDiet.size} Knoten / ${tok(sl(wDiet).formatE)} tok · GT ${gt.filter(u=>wDiet.has(u)).length}/${gt.length}`);
  console.log(`B voll: ${b.size} / ${tok(sl(b).formatE)} tok  →  B Diät: ${bDiet.size} / ${tok(sl(bDiet).formatE)} tok`);
}

await fx.close();
