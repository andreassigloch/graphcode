#!/usr/bin/env node
/**
 * messen.mjs — misst, WIE ein Agent den Referenz-Change gefahren hat (CR-GC-633).
 *
 * Eingang: ein Claude-Code-Sitzungsprotokoll (`~/.claude/projects/<repo>/<id>.jsonl`).
 * Ausgang: die Kennzahlen, mit denen dieses Repo sich selbst beurteilt — vor allem
 * Graph-gegen-grep (se-retro KPI 1) und die Zahl der Volllaeufe.
 *
 * Optional `--ab "<text>"` schneidet die Messung ab der ersten Nutzernachricht, die
 * `<text>` enthaelt — eine Sitzung traegt meist mehr als einen Change.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

const args = process.argv.slice(2);
const datei = args.find((a) => !a.startsWith('--'));
const abIdx = args.indexOf('--ab');
const ab = abIdx >= 0 ? args[abIdx + 1] : null;
const bisIdx = args.indexOf('--bis');
const bis = bisIdx >= 0 ? args[bisIdx + 1] : null;

if (!datei) {
  console.error('Aufruf: node messen.mjs <sitzung.jsonl> [--ab "<Textstelle>"] [--bis "<Textstelle>"]');
  process.exit(2);
}

/** Die Werkzeuge, die den Graphen LESEN — Schreiben zaehlt hier nicht als Nutzung. */
const GRAPH_LESEN = new Set([
  'graph_context', 'graph_impact', 'graph_expand', 'graph_elements', 'graph_get_node',
  'graph_get_edges', 'graph_tests', 'graph_metrics', 'graph_readiness', 'graph_suggest',
  'graph_next_step', 'rules_evaluate', 'rules_get_violations', 'graph_help',
  'graph_authoring_guide', 'audit_trail', 'audit_stats',
]);

const zeilen = readFileSync(datei, 'utf8').split('\n');
const saetze = [];
for (const z of zeilen) {
  if (!z.trim()) continue;
  try { saetze.push(JSON.parse(z)); } catch { /* Teilzeile am Ende */ }
}

/** Index der ersten NUTZERnachricht, die `text` enthaelt. */
const nutzersatz = (text, von = 0) =>
  saetze.findIndex((d, i) => {
    if (i < von) return false;
    const m = d.message ?? {};
    if (m.role !== 'user') return false;
    const c = m.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => b?.text ?? '').join(' ') : '';
    return t.toLowerCase().includes(text.toLowerCase());
  });

let start = 0;
if (ab) {
  start = nutzersatz(ab);
  if (start < 0) { console.error(`--ab "${ab}" kommt in der Sitzung nicht vor.`); process.exit(2); }
}
let ende = saetze.length;
if (bis) {
  ende = nutzersatz(bis, start + 1);
  if (ende < 0) { console.error(`--bis "${bis}" kommt nach --ab nicht vor.`); process.exit(2); }
}

const werkzeuge = new Map();
const befehle = [];
for (const d of saetze.slice(start, ende)) {
  const c = d.message?.content;
  if (!Array.isArray(c)) continue;
  for (const b of c) {
    if (b?.type !== 'tool_use') continue;
    werkzeuge.set(b.name, (werkzeuge.get(b.name) ?? 0) + 1);
    if (b.name === 'Bash') befehle.push(b.input?.command ?? '');
  }
}

const zaehle = (re) => befehle.filter((c) => re.test(c)).length;
const kurz = (n) => n.replace(/^mcp__graphcode__/, '');

const graphLesen = [...werkzeuge].filter(([n]) => GRAPH_LESEN.has(kurz(n))).reduce((s, [, v]) => s + v, 0);
const graphSchreiben = [...werkzeuge].filter(([n]) => n.startsWith('mcp__graphcode__') && !GRAPH_LESEN.has(kurz(n))).reduce((s, [, v]) => s + v, 0);
const suchen = zaehle(/\bgrep\b|\bfind \b|\brg /) + (werkzeuge.get('Grep') ?? 0) + (werkzeuge.get('Glob') ?? 0);
const voll = zaehle(/npm test\b/);
const selektiv = zaehle(/npx vitest run/);
const spuren = zaehle(/verify:(model|code)/);

const gesamt = [...werkzeuge.values()].reduce((a, b) => a + b, 0);

console.log(`Sitzung: ${datei}`);
console.log(ab ? `Ausschnitt: Satz ${start}–${ende} von ${saetze.length}${bis ? ` (ab "${ab}", bis "${bis}")` : ` (ab "${ab}")`}\n` : `Ganze Sitzung (${saetze.length} Saetze)\n`);

console.log('WERKZEUGE');
for (const [n, v] of [...werkzeuge].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${kurz(n)}`);
console.log(`  ${String(gesamt).padStart(4)}  = gesamt\n`);

console.log('GRAPH GEGEN GREP (se-retro KPI 1)');
console.log(`  ${String(graphLesen).padStart(4)}  Graph-LESEaufrufe`);
console.log(`  ${String(graphSchreiben).padStart(4)}  Graph-SCHREIBaufrufe (zaehlen nicht als Nutzung)`);
console.log(`  ${String(suchen).padStart(4)}  Suchoperationen (grep/find/rg/Grep/Glob)`);
console.log(`  Verhaeltnis: ${graphLesen === 0 ? 'KEINE Graphfrage gestellt' : (suchen / graphLesen).toFixed(1) + ' Suchen je Graphfrage'}\n`);

console.log('TESTSPUR (CLAUDE.md: die Auswahl fahren, die VOLL-Spur nur als Riegel)');
console.log(`  ${String(voll).padStart(4)}  Volllaeufe (npm test, je ~5 min)`);
console.log(`  ${String(selektiv).padStart(4)}  selektive Laeufe (npx vitest run <Dateien>)`);
console.log(`  ${String(spuren).padStart(4)}  abgeleitete Spuren (verify:model / verify:code)`);
if (voll > 1) console.log(`  ⚠ ${voll} Volllaeufe = ~${voll * 5} Minuten Wanduhr, die graph_tests haette sparen koennen.`);
