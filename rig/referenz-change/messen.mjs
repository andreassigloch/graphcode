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
// CR-GC-639: gezaehlt wird NICHT hier. Die eine Zaehlung nach docs/KPI.md steht in retro-kpi.mjs;
// dieses Skript waehlt nur das Fenster und stellt dar.
import { werkzeugNutzung, computeKpis } from '../../scripts/retro-kpi.mjs';

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

const fenster = saetze.slice(start, ende);
const n = werkzeugNutzung(fenster);
const kpi1 = computeKpis({
  toolUsage: n, audit: {}, readiness: {}, git: { netLoc: 0 }, plan: {}, binding: {},
}).graphVsGrepRatio;

const werkzeuge = new Map();
for (const d of fenster) {
  const c = d.message?.content;
  if (!Array.isArray(c)) continue;
  for (const b of c) if (b?.type === 'tool_use') werkzeuge.set(b.name, (werkzeuge.get(b.name) ?? 0) + 1);
}
const kurz = (x) => x.replace(/^mcp__graphcode__/, '');
const gesamt = [...werkzeuge.values()].reduce((a, b) => a + b, 0);

console.log(`Sitzung: ${datei}`);
console.log(ab ? `Ausschnitt: Satz ${start}–${ende} von ${saetze.length}${bis ? ` (ab "${ab}", bis "${bis}")` : ` (ab "${ab}")`}\n` : `Ganze Sitzung (${saetze.length} Saetze)\n`);

console.log('WERKZEUGE');
for (const [n, v] of [...werkzeuge].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${kurz(n)}`);
console.log(`  ${String(gesamt).padStart(4)}  = gesamt\n`);

console.log('GRAPH GEGEN GREP — KPI 1 nach docs/KPI.md, gezaehlt in scripts/retro-kpi.mjs');
console.log(`  ${String(n.graphCalls).padStart(4)}  graph_*-Aufrufe (davon ${n.graphReads} lesend)`);
console.log(`  ${String(n.grepGlobDocReads).padStart(4)}  Grep + Glob + Doc-Read (grep nach einer Pipe zaehlt nicht)`);
console.log(`  KPI 1 = ${kpi1}   (Ziel > 1)${n.graphReads === 0 ? '   — KEINE Graphfrage gestellt' : ''}\n`);

console.log('TESTSPUR (CLAUDE.md: die Auswahl fahren, die VOLL-Spur nur als Riegel)');
console.log(`  ${String(n.volllaeufe).padStart(4)}  Volllaeufe (npm test, je ~5 min)`);
console.log(`  ${String(n.selektiv).padStart(4)}  selektive Laeufe (npx vitest run <Dateien>)`);
if (n.volllaeufe > 1) console.log(`  ⚠ ${n.volllaeufe} Volllaeufe = ~${n.volllaeufe * 5} Minuten Wanduhr.`);
