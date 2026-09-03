#!/usr/bin/env node
// Known-Answer-Set für die Zieldimensionen (CR-SM-281): Paare von Graph-Zuständen aus der
// Git-History, bei denen der bessere Zustand durch Urteil/Doktrin/Lock feststeht. Je Paar der
// ℝ⁶-Vektor (layer 'arch') vorher/nachher, Δ je Dimension, Δ·w gegen das Zielprofil — und ob der
// Vektor den bekannt-besseren Zustand höher rankt. Dazu drei Graphen absolut (bok, gve, graphcode).
// Negativkontrolle (CR-SM-281 P5): moneyflow hat keine Wozu-Ebene (CR-SM-271) und darf einen
// governten Graphen nicht überholen. Tut es aber: w·m 5,33 > graphcode 5,24 (2026-09-03).
// Aufruf aus dem graphcode-Repo: node scripts/known-answer-set.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';

const at = (ref) => { const raw = JSON.parse(execFileSync('git', ['show', `${ref}:docs/graph/graphcode.graph.json`], { encoding: 'utf8', maxBuffer: 64 << 20 })); return { elements: raw.elements, traces: raw.traces }; };
const file = (p) => { const raw = JSON.parse(readFileSync(p, 'utf8')); return { elements: raw.elements, traces: raw.traces }; };
const vec = (g) => { const m = metrics(g, { layer: 'arch' }); return METRIC_DIMENSIONS.map((d) => m[d]); };
const w = JSON.parse(readFileSync('.graphcode/target-profile.json', 'utf8')).weights;
const dot = (d) => d.reduce((a, x, i) => a + x * (w[METRIC_DIMENSIONS[i]] ?? 0), 0);
const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);

const PAIRS = [
  ['P1 Ebene einziehen (CR-GC-459: 10 Wurzeln → 4, Strukturblöcke)', '4cb5a3b^', '4cb5a3b', 'se:top-level: „the answer to too big is a level"'],
  ['P2 Messung in den Kern (CR-GC-468–472: allocate → MOD-kernel)', 'c826ff2', 'ae4b57d', 'Lock CR-GC-467: das Gate urteilt mit der Messung'],
  ['P3 measure als Sub-MOD (CR-GC-473)', 'ae4b57d', 'f2f3b62', 'Doktrin: Ebene statt sechstem Modul'],
  ['P4 Graph-State hat einen Schreiber (CR-GC-481)', 'e197995', 'b8e17f3', 'L1: ein Gate; das Modell sagt, was der Code tut'],
];
console.log('## Paare — der rechte Zustand ist der bessere (Begründung je Zeile)\n');
console.log('| Paar | ' + METRIC_DIMENSIONS.map((d) => 'Δ' + d.slice(0, 6)).join(' | ') + ' | Δ·w | Vektor rankt besser höher? |');
console.log('|---|' + METRIC_DIMENSIONS.map(() => '---:').join('|') + '|---:|---|');
for (const [label, a, b, why] of PAIRS) {
  const d = vec(at(b)).map((x, i) => x - vec(at(a))[i]);
  const s = dot(d);
  console.log(`| ${label} | ${d.map(f).join(' | ')} | **${f(s)}** | ${s > 1e-6 ? '✓ ja' : s < -1e-6 ? '✗ nein — bestraft' : '– blind'} |`);
  console.log(`|   ↳ _${why}_ |${METRIC_DIMENSIONS.map(() => ' |').join('')} | |`);
}
console.log('\n## Absolut — drei Graphen, sortiert nach gewichtetem Wert\n');
const ABS = [['bok (7 Blöcke, 9 Linien)', '/Users/andreas/Developer/dev/bok/docs/graph/bok.graph.json'], ['graph-view-edit (7 Blöcke, 10 Linien)', '/Users/andreas/Developer/dev/graph-view-edit/docs/graph/graph-view-edit.graph.json'], ['graphcode (9 Blöcke, 25 Linien)', 'docs/graph/graphcode.graph.json'], ['sirail (24 FUNC in 18 MOD, 6 UC)', '/Users/andreas/Developer/dev/sirail/docs/graph/sirail.graph.json'], ['moneyflow — NEGATIVKONTROLLE (306 Wurzel-FUNC, 0 UC, 155 MOD: Code-Import ohne Wozu-Ebene)', '/Users/andreas/Developer/dev/moneyflow/docs/graph/moneyflow.graph.json']];
console.log('| Graph | ' + METRIC_DIMENSIONS.join(' | ') + ' | w·m |');
console.log('|---|' + METRIC_DIMENSIONS.map(() => '---:').join('|') + '|---:|');
for (const [label, p] of ABS) { const v = vec(file(p)); console.log(`| ${label} | ${v.map((x) => x.toFixed(3)).join(' | ')} | ${dot(v).toFixed(3)} |`); }
console.log('\n## Streuung je Dimension über alle 13 Zustände (eine Dimension, die nicht streut, kann nicht steuern)\n');
const states = [...PAIRS.flatMap(([, a, b]) => [at(a), at(b)]), ...ABS.map(([, p]) => file(p))].map(vec);
console.log('| Dimension | min | max | Spanne |'); console.log('|---|---:|---:|---:|');
METRIC_DIMENSIONS.forEach((d, i) => { const xs = states.map((v) => v[i]); const mn = Math.min(...xs), mx = Math.max(...xs); console.log(`| ${d} | ${mn.toFixed(3)} | ${mx.toFixed(3)} | ${(mx - mn).toFixed(3)}${mx - mn < 0.05 ? ' ⚠ tot' : ''} |`); });
