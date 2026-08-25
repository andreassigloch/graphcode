#!/usr/bin/env node
/**
 * CR-GC-408 — Spike: Ebenen-Reife vor Tiefe. READ-ONLY Analyse, kein Produktionscode.
 *
 * Misst drei Dinge auf sechs realen Graphen (docs/graph/<repo>.graph.json):
 *
 *   1. Ebenen-Konformanz-Score je Graph, in vier Komponenten zerlegt.
 *   2. Korrelation Score <-> die 8 readiness-Themenscores (Redundanz-Check),
 *      plus Rework-Evidenz aus der git-History des jeweiligen graph.json.
 *   3. Nudge-Replay auf historischen graphcode-Staenden: haette ein
 *      konformanz-gewichtetes Ranking den CR-GC-405-Retrofit (vier
 *      Funktionsbloecke) VOR den damaligen Leaf-FUNCs vorgeschlagen?
 *
 * Nichts hier wird importiert, nichts exportiert, nichts geschrieben.
 * Aufruf: node scripts/spike-ebenen-konformanz.mjs
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { computeReadiness } from '@sigloch/se-engine';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

// ---------------------------------------------------------------------------
// Datenbasis — die sechs Repos aus der CR-Tabelle. Pfade selbst geprueft.
// ---------------------------------------------------------------------------
const REPOS = [
  { name: 'graphcode', root: '/Users/andreas/Developer/dev/graphcode' },
  { name: 'moneyflow', root: '/Users/andreas/Developer/dev/moneyflow' },
  { name: 'sirail', root: '/Users/andreas/Developer/dev/sirail' },
  { name: 'graphcodedemo', root: '/Users/andreas/Developer/prod/graphcodedemo' },
  { name: 'sigloch-modules', root: '/Users/andreas/Developer/dev/sigloch-modules' },
  { name: 'graph-view-edit', root: '/Users/andreas/Developer/dev/graph-view-edit' },
].map((r) => ({ ...r, rel: `docs/graph/${r.name}.graph.json` }));

const FOCUS = 0.8; // readyThreshold, wie takeSteeringSnapshot ihn faehrt

// ---------------------------------------------------------------------------
// Struktur-Extraktion: die FUNC-Zerlegungs-Forest + Kettenschritte + allocate.
// ---------------------------------------------------------------------------
function structureOf(graph) {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const funcs = graph.elements.filter((e) => e.type === 'FUNC').map((e) => e.id);
  const kids = new Map();
  const parents = new Map();
  const chainSteps = new Set();
  const allocated = new Set();
  for (const t of graph.traces) {
    const s = byId.get(t.source);
    const d = byId.get(t.target);
    if (!s || !d) continue;
    if (t.type === 'compose' && s.type === 'FUNC' && d.type === 'FUNC') {
      if (!kids.has(t.source)) kids.set(t.source, []);
      kids.get(t.source).push(t.target);
      if (!parents.has(t.target)) parents.set(t.target, []);
      parents.get(t.target).push(t.source);
    }
    if (t.type === 'compose' && s.type === 'FCHAIN' && d.type === 'FUNC') chainSteps.add(t.target);
    if (t.type === 'allocate' && s.type === 'FUNC' && d.type === 'MOD') allocated.add(t.source);
  }
  const blocks = funcs.filter((f) => kids.has(f)); // zerlegte FUNC = Block
  const roots = funcs.filter((f) => !parents.has(f));
  const leaves = funcs.filter((f) => !kids.has(f));
  // hat der Knoten irgendeinen Block-Vorfahren?
  const hasBlockAncestor = (f) => {
    const seen = new Set();
    let front = parents.get(f) ?? [];
    while (front.length) {
      const nx = [];
      for (const p of front) {
        if (seen.has(p)) continue;
        seen.add(p);
        nx.push(...(parents.get(p) ?? []));
      }
      front = nx;
    }
    return seen.size > 0;
  };
  const depthOf = (f) => {
    let d = 1;
    let front = [f];
    const seen = new Set();
    while (front.length) {
      const nx = [];
      for (const c of front) {
        if (seen.has(c)) continue;
        seen.add(c);
        nx.push(...(kids.get(c) ?? []));
      }
      if (!nx.length) break;
      front = nx;
      d++;
    }
    return d;
  };
  const maxDepth = roots.length ? Math.max(...roots.map(depthOf)) : 0;
  return { funcs, kids, parents, blocks, roots, leaves, chainSteps, allocated, hasBlockAncestor, maxDepth };
}

// ---------------------------------------------------------------------------
// (1) Ebenen-Konformanz-Score — vier Komponenten, exakt die des CR.
//
// Zaehlweise (verbindlich dokumentiert, damit die Zahl nachrechenbar ist):
//
//  K1 chainCoverage  = |FCHAIN-Schritte mit Block-Vorfahren| / |FCHAIN-Schritte|
//                      Lesart wie CR-GC-405 ("Deckung operativer FUNCs"): ein
//                      Schritt ist einem Top-FUNC zuordenbar, wenn ueber ihm
//                      ein Block steht. Ein Wurzel-Blatt zaehlt NICHT als sein
//                      eigener Top-FUNC — sonst ist die Invariante vakuum-wahr.
//                      Ohne FCHAIN: n/a (0 im Score, separat ausgewiesen).
//  K2 leafBlockParent= |Leaf-FUNC mit FUNC-Elter| / |Leaf-FUNC|
//  K3 level1Homogen  = |Wurzeln, die Bloecke sind| / |Wurzeln|
//                      Die Breite-Haelfte von "Breite vor Tiefe". Die Tiefen-
//                      Haelfte ist statisch NICHT entscheidbar (Tiefe je Ast
//                      ist legitim variabel) — maxDepth wird deshalb nur roh
//                      berichtet, nicht in den Score gerechnet.
//  K4 zigzag         = |Bloecke mit allocate| / |Bloecke|   (0 Bloecke -> n/a)
//
//  Score = arithmetisches Mittel der definierten Komponenten (n/a -> 0,
//          zusaetzlich wird das Mittel NUR ueber definierte ausgewiesen).
// ---------------------------------------------------------------------------
function conformance(graph) {
  const s = structureOf(graph);
  const steps = [...s.chainSteps];
  const K1 = steps.length ? steps.filter((f) => s.hasBlockAncestor(f)).length / steps.length : null;
  const K2 = s.leaves.length ? s.leaves.filter((f) => s.parents.has(f)).length / s.leaves.length : null;
  const K3 = s.roots.length ? s.roots.filter((f) => s.kids.has(f)).length / s.roots.length : null;
  const K4 = s.blocks.length ? s.blocks.filter((f) => s.allocated.has(f)).length / s.blocks.length : null;
  const comps = { K1, K2, K3, K4 };
  const vals = Object.values(comps);
  const score = vals.reduce((a, v) => a + (v ?? 0), 0) / vals.length;
  const defined = vals.filter((v) => v !== null);
  const scoreDefinedOnly = defined.length ? defined.reduce((a, v) => a + v, 0) / defined.length : null;
  return {
    ...comps,
    score,
    scoreDefinedOnly,
    raw: {
      func: s.funcs.length,
      blocks: s.blocks.length,
      roots: s.roots.length,
      leaves: s.leaves.length,
      isolated: s.funcs.filter((f) => !s.kids.has(f) && !s.parents.has(f)).length,
      chainSteps: steps.length,
      maxDepth: s.maxDepth,
      blockLevelOwed: s.leaves.length > 9, // CR-GC-405-Faustregel: 4-9 Bloecke fuer den CEO
    },
  };
}

// ---------------------------------------------------------------------------
// Korrelation (Pearson + Spearman). n ist klein (6) — die Zahl wird MIT n
// berichtet, nicht als Evidenz verkauft.
// ---------------------------------------------------------------------------
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}
function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

// ---------------------------------------------------------------------------
// (2b) Rework aus der git-History des graph.json.
//
// Zaehlweise: je Revisionspaar (n-1 -> n) des graph.json
//   retrofitCompose  compose FUNC->FUNC, deren KIND schon in n-1 existierte
//                    => ein Block wurde NACHTRAEGLICH ueber bestehende
//                       Funktionen gelegt (das CR-GC-405-Muster).
//   reparent         FUNC, deren Elternmenge sich aenderte (Umhaengen).
//   composeRemoved   compose-Kanten aus n-1, die in n fehlen.
//   elemRemoved      Element-IDs aus n-1, die in n fehlen.
// Umbau-Commit = irgendeine dieser vier Zahlen > 0.
// ---------------------------------------------------------------------------
function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { maxBuffer: 1 << 30 }).toString();
}
function revisionsOf(repo) {
  try {
    return git(repo.root, ['log', '--format=%h|%ad|%s', '--date=short', '--reverse', '--', repo.rel])
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [sha, date, ...rest] = l.split('|');
        return { sha, date, subject: rest.join('|') };
      });
  } catch {
    return [];
  }
}
function graphAt(repo, sha) {
  try {
    return JSON.parse(git(repo.root, ['show', `${sha}:${repo.rel}`]));
  } catch {
    return null;
  }
}
function snapshotFor(graph) {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const elems = new Set(byId.keys());
  const compose = new Set();
  const parentOf = new Map();
  for (const t of graph.traces) {
    const s = byId.get(t.source);
    const d = byId.get(t.target);
    if (!s || !d) continue;
    if (t.type === 'compose' && s.type === 'FUNC' && d.type === 'FUNC') {
      compose.add(`${t.source}>${t.target}`);
      if (!parentOf.has(t.target)) parentOf.set(t.target, new Set());
      parentOf.get(t.target).add(t.source);
    }
  }
  return { elems, compose, parentOf };
}
function reworkOf(repo) {
  const revs = revisionsOf(repo);
  if (revs.length < 2) return { revs: revs.length, measurable: false };
  let prev = null;
  let retrofit = 0;
  let reparent = 0;
  let composeRemoved = 0;
  let elemRemoved = 0;
  let umbauCommits = 0;
  const examples = [];
  for (const r of revs) {
    const g = graphAt(repo, r.sha);
    if (!g) continue;
    const snap = snapshotFor(g);
    if (prev) {
      let rf = 0;
      for (const key of snap.compose) {
        if (prev.compose.has(key)) continue;
        const child = key.split('>')[1];
        if (prev.elems.has(child)) rf++; // Block nachtraeglich uebergelegt
      }
      let rp = 0;
      for (const [child, ps] of snap.parentOf) {
        const before = prev.parentOf.get(child);
        if (!before) continue;
        const same = before.size === ps.size && [...ps].every((p) => before.has(p));
        if (!same) rp++;
      }
      let cr = 0;
      for (const key of prev.compose) if (!snap.compose.has(key)) cr++;
      let er = 0;
      for (const id of prev.elems) if (!snap.elems.has(id)) er++;
      retrofit += rf;
      reparent += rp;
      composeRemoved += cr;
      elemRemoved += er;
      if (rf || rp || cr || er) {
        umbauCommits++;
        if (rf >= 5) examples.push(`${r.sha} +${rf} retrofit-compose — ${r.subject.slice(0, 58)}`);
      }
    }
    prev = snap;
  }
  return {
    revs: revs.length,
    measurable: true,
    pairs: revs.length - 1,
    retrofit,
    reparent,
    composeRemoved,
    elemRemoved,
    umbauCommits,
    umbauRate: umbauCommits / (revs.length - 1),
    examples,
  };
}

// ---------------------------------------------------------------------------
// Ausgabe-Helfer
// ---------------------------------------------------------------------------
const f2 = (v) => (v === null || v === undefined ? ' n/a ' : v.toFixed(2).padStart(5));
const f3 = (v) => (v === null || v === undefined ? '  n/a ' : v.toFixed(3).padStart(6));
const line = (c = '-') => console.log(c.repeat(96));

// ===========================================================================
// MESSUNG 1 — Score je Graph
// ===========================================================================
console.log('\nCR-GC-408 — Spike Ebenen-Konformanz (read-only)');
console.log(`Gemessen: ${new Date().toISOString().slice(0, 10)}\n`);
line('=');
console.log('MESSUNG 1 — Ebenen-Konformanz-Score je Graph (Komponenten K1..K4)');
line('=');

const rows = [];
for (const repo of REPOS) {
  const path = `${repo.root}/${repo.rel}`;
  if (!existsSync(path)) {
    console.log(`${repo.name}: FEHLT (${path})`);
    continue;
  }
  const graph = JSON.parse(readFileSync(path, 'utf8'));
  const c = conformance(graph);
  const readiness = computeReadiness(
    { elements: graph.elements, traces: graph.traces },
    DEFAULT_METRIC_POLICY,
    FOCUS,
  );
  rows.push({ repo: repo.name, graph, c, readiness, version: graph.graphVersion });
}

console.log('repo             ver   elem  FUNC  Blk Wurz Blatt isol Ket Tiefe |   K1    K2    K3    K4 | Score');
line();
for (const r of rows) {
  const q = r.c.raw;
  console.log(
    `${r.repo.padEnd(16)}${String(r.version ?? '-').padStart(4)} ${String(r.graph.elements.length).padStart(6)}` +
      `${String(q.func).padStart(6)}${String(q.blocks).padStart(5)}${String(q.roots).padStart(5)}` +
      `${String(q.leaves).padStart(6)}${String(q.isolated).padStart(5)}${String(q.chainSteps).padStart(4)}` +
      `${String(q.maxDepth).padStart(6)} | ${f2(r.c.K1)} ${f2(r.c.K2)} ${f2(r.c.K3)} ${f2(r.c.K4)} | ${f3(r.c.score)}`,
  );
}
line();
console.log('Rangfolge nach Score:');
[...rows]
  .sort((a, b) => b.c.score - a.c.score)
  .forEach((r, i) =>
    console.log(
      `  ${i + 1}. ${r.repo.padEnd(16)} ${r.c.score.toFixed(3)}  ` +
        `(nur definierte Komponenten: ${f3(r.c.scoreDefinedOnly)}, Blockebene geschuldet: ${r.c.raw.blockLevelOwed})`,
    ),
  );

console.log('\nKill-Kriterium 1 (Trennschaerfe): moneyflow muss DEUTLICH unter graphcodedemo liegen.');
{
  const mf = rows.find((r) => r.repo === 'moneyflow');
  const demo = rows.find((r) => r.repo === 'graphcodedemo');
  const d = demo.c.score - mf.c.score;
  console.log(`  graphcodedemo ${demo.c.score.toFixed(3)} - moneyflow ${mf.c.score.toFixed(3)} = Delta ${d.toFixed(3)}`);
  console.log(`  Erwartung des CR (demo > graphcode > moneyflow): ${
    demo.c.score > rows.find((r) => r.repo === 'graphcode').c.score ? 'ERFUELLT' : 'FALSIFIZIERT'
  }`);
  console.log(`  => Kill 1 ${Math.abs(d) < 0.1 ? 'FEUERT' : 'feuert nicht'}`);
}

// ===========================================================================
// MESSUNG 2 — Korrelation mit Readiness + Redundanz-Check
// ===========================================================================
console.log('');
line('=');
console.log('MESSUNG 2a — Korrelation Score <-> die 8 readiness-Themenscores  (n=6 Graphen)');
line('=');
const dims = rows[0].readiness.scores.map((s) => s.dimension);
console.log('repo             ' + dims.map((d) => d.padStart(6)).join('') + '   Konf.');
line();
for (const r of rows) {
  console.log(
    r.repo.padEnd(16) +
      r.readiness.scores.map((s) => s.score.toFixed(2).padStart(6)).join('') +
      '  ' + r.c.score.toFixed(3),
  );
}
line();
const xs = rows.map((r) => r.c.score);
let maxAbs = 0;
let maxDim = '';
for (const d of dims) {
  const ys = rows.map((r) => r.readiness.scores.find((s) => s.dimension === d).score);
  const p = pearson(xs, ys);
  const sp = spearman(xs, ys);
  if (p !== null && Math.abs(p) > maxAbs) {
    maxAbs = Math.abs(p);
    maxDim = d;
  }
  console.log(`  ${d.padEnd(8)} Pearson r = ${f3(p)}   Spearman rho = ${f3(sp)}`);
}
console.log(`\n  Staerkste Korrelation: ${maxDim} |r| = ${maxAbs.toFixed(3)}`);
console.log(`  => Kill 2 (Redundanz, |r| ~ 1) ${maxAbs > 0.9 ? 'FEUERT' : 'feuert nicht'}`);

console.log('\n  Gegenprobe "weiss readiness es schon?" — Blindstellen:');
for (const r of rows) {
  const arch = r.readiness.scores.find((s) => s.dimension === 'arch');
  const uc = r.readiness.scores.find((s) => s.dimension === 'uc');
  console.log(
    `    ${r.repo.padEnd(16)} arch=${arch.score.toFixed(3)} (${arch.violations}/${arch.applicable})` +
      `  uc=${uc.score.toFixed(3)} (${uc.violations}/${uc.applicable})` +
      `  | UC im Graph: ${r.graph.elements.filter((e) => e.type === 'UC').length}` +
      `  | blocklose Blatt-FUNC: ${r.c.raw.leaves - Math.round((r.c.K2 ?? 0) * r.c.raw.leaves)}`,
  );
}

// ---------------------------------------------------------------------------
console.log('');
line('=');
console.log('MESSUNG 2b — Rework aus der git-History des jeweiligen graph.json');
line('=');
console.log('Zaehlweise: je Revisionspaar retrofit-compose (Block nachtraeglich ueber bestehende');
console.log('FUNC gelegt) | reparent (Elternwechsel) | composeRemoved | elemRemoved.');
console.log('Umbau-Commit = eine dieser vier Zahlen > 0.\n');
console.log('repo             Revs Paare  retro repar  cRem  eRem  Umbau-Commits  Rate');
line();
const rework = {};
for (const repo of REPOS) {
  const rw = reworkOf(repo);
  rework[repo.name] = rw;
  if (!rw.measurable) {
    console.log(`${repo.name.padEnd(16)}${String(rw.revs).padStart(5)}   -- NICHT MESSBAR (History zu duenn: < 2 Revisionen)`);
    continue;
  }
  console.log(
    `${repo.name.padEnd(16)}${String(rw.revs).padStart(5)}${String(rw.pairs).padStart(6)}` +
      `${String(rw.retrofit).padStart(7)}${String(rw.reparent).padStart(6)}${String(rw.composeRemoved).padStart(6)}` +
      `${String(rw.elemRemoved).padStart(6)}${String(rw.umbauCommits).padStart(15)}  ${rw.umbauRate.toFixed(2)}`,
  );
}
line();
for (const [name, rw] of Object.entries(rework)) {
  for (const ex of rw.examples ?? []) console.log(`  ${name}: ${ex}`);
}
{
  const usable = REPOS.filter((r) => rework[r.name].measurable);
  console.log(`\n  Repos mit messbarer History: ${usable.length}/6 (${usable.map((r) => r.name).join(', ')})`);
  if (usable.length >= 3) {
    const cx = usable.map((r) => rows.find((x) => x.repo === r.name).c.score);
    const cy = usable.map((r) => rework[r.name].retrofit);
    const cz = usable.map((r) => rework[r.name].umbauRate);
    console.log(`  Korrelation Score <-> retrofit-compose:  Pearson ${f3(pearson(cx, cy))}  Spearman ${f3(spearman(cx, cy))}  (n=${usable.length})`);
    console.log(`  Korrelation Score <-> Umbau-Rate:        Pearson ${f3(pearson(cx, cz))}  Spearman ${f3(spearman(cx, cz))}  (n=${usable.length})`);
  } else {
    console.log('  => Kill 5 (History zu duenn) FEUERT fuer die Rework-Haelfte.');
  }
}

// ===========================================================================
// MESSUNG 3 — Nudge-Replay auf historischen graphcode-Staenden
// ===========================================================================
console.log('');
line('=');
console.log('MESSUNG 3 — Nudge-Replay: haette Konformanz-Gewichtung den CR-GC-405-Retrofit');
console.log('             (vier Funktionsbloecke, graphVersion 189 -> 190) vorgezogen?');
line('=');
console.log('Advisory-Form (Gummiband, kein Gate): der Fokus-Score der Dimension `arch` wird mit');
console.log('der Ebenen-Konformanz MULTIPLIZIERT (fitAdvisory-Muster: schubst, blockt nie).');
console.log('nextStep waehlt danach unveraendert die niedrigste Dimension mit applicable>0 & violations>0.\n');

const gcRepo = REPOS[0];
const gcRevs = revisionsOf(gcRepo);
// fuenf Staende VOR dem Retrofit + der Retrofit-Commit + der heutige Stand
const preTargets = ['e25b59c', 'c4d3ce3', '49c787e', '203f54f', '004aca1', 'ce01378'];
const replayShas = [...preTargets, '0f015a0', gcRevs[gcRevs.length - 1].sha];

console.log('rev      ver  Konf.  blockl.Blatt | Baseline-Top          | mit Konformanz-Gewicht  | Flip');
line();
let flips = 0;
let considered = 0;
let falseFlipsAfter = 0;
for (const sha of replayShas) {
  const g = graphAt(gcRepo, sha);
  if (!g) {
    console.log(`${sha}  -- nicht lesbar`);
    continue;
  }
  const c = conformance(g);
  const rep = computeReadiness({ elements: g.elements, traces: g.traces }, DEFAULT_METRIC_POLICY, FOCUS);
  const actionable = rep.scores.filter((s) => s.applicable > 0 && s.violations > 0);
  const base = [...actionable].sort((a, b) => a.score - b.score || b.violations - a.violations)[0];
  const weighted = actionable
    .map((s) => ({ ...s, score: s.dimension === 'arch' ? s.score * c.score : s.score }))
    .sort((a, b) => a.score - b.score || b.violations - a.violations)[0];
  const blockless = c.raw.leaves - c.raw.leaves * (c.K2 ?? 0);
  const flip = base.dimension !== weighted.dimension;
  const post = sha === '0f015a0' || sha === replayShas[replayShas.length - 1];
  considered++;
  if (flip) flips++;
  if (flip && post) falseFlipsAfter++;
  console.log(
    `${sha}  ${String(g.graphVersion ?? '-').padStart(3)}  ${c.score.toFixed(3)}  ${String(Math.round(blockless)).padStart(11)} | ` +
      `${(base.dimension + ' ' + base.score.toFixed(3)).padEnd(21)} | ` +
      `${(weighted.dimension + ' ' + weighted.score.toFixed(3)).padEnd(23)} | ${flip ? 'JA' : '--'}` +
      `${post ? '   <- nach Retrofit' : ''}`,
  );
}
line();
console.log(`  Flips: ${flips}/${considered} Staende. Davon NACH dem Retrofit (= Fehlschubser): ${falseFlipsAfter}.`);
console.log(`  => Kill 4 (Replay wirkungslos) ${flips === 0 ? 'FEUERT' : 'feuert nicht'}`);
console.log(
  `  => Nudge klebt (schubst auch nach behobenem Zustand weiter): ${falseFlipsAfter > 0 ? 'JA' : 'NEIN'}`,
);
console.log('');
