// Phase 1, Job 3 — Autorier-Loop (H4). Der Schritt kommt aus dem ECHTEN
// graph_generate; gemessen wird der heutige Runden-Kontext (buildRoundInjection)
// gegen eine Autorier-Whitebox: Fund-Elemente in voller Tiefe + 1-Ring,
// plus VOLLSTÄNDIGE Identitätszeilen der Fokus-Typen (Duplikat-Schutz).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { openFixture, sliceOf, tok, OUT } from './measure.mjs';
import { buildRoundInjection } from '../../dist/executor-prompt.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FIXTURES = [
  { name: 'A3a — greenfield, lokal (devstral v9, bester Baseline-Lauf)', graph: 'rig/greenfield-systemtest/results/gc-run-devstral-v9.graph.json', sys: 'gf-v9' },
  { name: 'A3b — greenfield, frontier (opus5)', graph: 'rig/greenfield-systemtest/results/gc-run-opus5.graph.json', sys: 'gf-opus5' },
  { name: 'A3c — reifes Modell (graphcode-Selbstmodell)', graph: 'docs/graph/graphcode.graph.json', sys: 'graphcode' },
];
const INTENT = 'Ein System, das den Zustand einer Anlage erfasst und Wartung plant.';

const rows = [];
for (const f of FIXTURES) {
  const fx = await openFixture(join(REPO, f.graph), f.sys);
  const graph = fx.graph();
  const step = await fx.reg['graph_generate'].handler({ intent: INTENT });
  const focusTypes = step.focusTypes ?? [];

  // heute
  const today = await buildRoundInjection(fx.reg, { focusTypes });

  // Fund-Elemente des Schritts = die uids, die der Prompt namentlich nennt
  const seeds = graph.nodes.map((n) => n.uid).filter((u) => step.prompt.includes(u));

  // Autorier-Whitebox: Funde + 1-Ring (beide Richtungen) in voller Tiefe
  const white = new Set(seeds);
  for (const s of seeds) for (const n of (await fx.harness.subgraph(s, 1, 'both')).nodes) white.add(n.uid);
  const W = sliceOf(graph, white);

  // Variante W1 (eng): NUR die Fund-Elemente in voller Tiefe — kein 1-Ring.
  const tight = new Set(seeds);
  const W1 = sliceOf(graph, tight);

  // Duplikat-Ring: JEDER existierende Knoten der Fokus-Typen als Identitätszeile —
  // vollständig, nicht alphabetisch gekappt (das ist der Unterschied zu heute).
  const ringNodes = graph.nodes.filter((n) => focusTypes.includes(n.type) && !white.has(n.uid));
  const ring = ringNodes.map((n) => `${n.uid} · ${n.type} · ${n.name}`).join('\n');
  const RING_HEAD = '\n\n## Bereits vorhanden (Identität, nicht öffnen — keine Duplikate anlegen)\n';
  const armA = `${W.formatE}${RING_HEAD}${ring}`;
  const ring1 = graph.nodes
    .filter((n) => focusTypes.includes(n.type) && !tight.has(n.uid))
    .map((n) => `${n.uid} · ${n.type} · ${n.name}`).join('\n');
  const armA1 = `${W1.formatE}${RING_HEAD}${ring1}`;

  // Deckung: wie viele Knoten der Fokus-Typen nennt der heutige Kontext überhaupt?
  const focusAll = graph.nodes.filter((n) => focusTypes.includes(n.type));
  const seenToday = focusAll.filter((n) => today.includes(n.uid)).length;
  const seenArmA = focusAll.filter((n) => armA.includes(n.uid)).length;

  const row = {
    fixture: f.name, G: graph.nodes.length, phase: step.phase, dimension: step.focusKey,
    focusTypes, seeds,
    today_tokens: tok(today), armA_tokens: tok(armA),
    whitebox: { nodes: white.size, tokens: tok(W.formatE) },
    ring_nodes: ringNodes.length,
    focusTypeNodes: focusAll.length,
    coverage_today: +(seenToday / (focusAll.length || 1)).toFixed(3),
    coverage_armA: +(seenArmA / (focusAll.length || 1)).toFixed(3),
    tight: { nodes: tight.size, whitebox_tokens: tok(W1.formatE), armA1_tokens: tok(armA1),
             coverage: +(focusAll.filter((n) => armA1.includes(n.uid)).length / (focusAll.length || 1)).toFixed(3) },
    W_over_G: +(white.size / graph.nodes.length).toFixed(3),
  };
  rows.push(row);
  writeFileSync(join(OUT, `${f.name.split(' ')[0]}-today.txt`), today);
  writeFileSync(join(OUT, `${f.name.split(' ')[0]}-armA.txt`), armA);
  writeFileSync(join(OUT, `${f.name.split(' ')[0]}-armA1.txt`), armA1);
  console.log('\n===', f.name, '===');
  console.log(`G=${row.G} · Phase ${row.phase} · Fokus ${JSON.stringify(focusTypes)} · Funde ${seeds.join(', ') || '(keine uid im Prompt)'}`);
  console.log(`heute ${row.today_tokens} tok, deckt ${seenToday}/${focusAll.length} Fokus-Knoten (${row.coverage_today})`);
  console.log(`Arm A  (Funde+1-Ring tief) ${row.armA_tokens} tok, deckt ${seenArmA}/${focusAll.length} (${row.coverage_armA}); W=${white.size} Knoten`);
  console.log(`Arm A1 (nur Funde tief)    ${row.tight.armA1_tokens} tok, deckt ${row.tight.coverage}; W=${tight.size} Knoten (${row.tight.whitebox_tokens} tok)`);
  await fx.close();
}
writeFileSync(join(OUT, 'phase1-authoring.json'), JSON.stringify(rows, null, 2));
console.log('\n→', join(OUT, 'phase1-authoring.json'));
