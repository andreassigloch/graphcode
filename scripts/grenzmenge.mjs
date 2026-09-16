#!/usr/bin/env node
// CR-GC-545 — Grenzmenge: welche Symbole kreuzen eine MOD-Grenze?
//
// Die Definition, die den Auswahl-Streit beendet: eine FUNC MUSS ins Modell, wenn ihr Symbol
// aus seinem Modul heraustelefoniert. Eine Blackbox ist ihre Grenze (Leitlinie Satz 1); was sie
// kreuzt, ist ihre Schnittstelle, und was drinnen bleibt, geht niemanden an.
//
// UNTERGRENZE, keine Gleichheit: mehr darf modelliert sein, wenn es Warum oder Wie traegt
// (Leitlinie Satz 2). Sparsamkeit hat einen eigenen Besitzer — Satz 3 und die Kennzahlen.
//
// Voraussetzung ist CR-GC-544: ohne `MOD.path` kannte die Datei->MOD-Aufloesung 59 % der
// Dateien, und „kreuzt eine Grenze" waere eine Aussage ueber die andere Haelfte gewesen.
//
// Aufruf aus dem graphcode-Repo: node scripts/grenzmenge.mjs
// Read-only: liest den committeten Snapshot und die Quellen, schreibt nichts.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const REPO = process.argv[2] ?? '/Users/andreas/Developer/dev/graphcode';
const MEMBER = REPO.split('/').pop();
const graph = JSON.parse(readFileSync(join(REPO, `docs/graph/${MEMBER}.graph.json`), 'utf8'));

// ---------------------------------------------------------------------------
// Datei -> MOD, beide Wege wie `buildModResolver` in contracts (CR-SM-268)
// ---------------------------------------------------------------------------
const typeOf = new Map(graph.elements.map((e) => [e.id, e.type]));
const direkt = new Map();
for (const e of graph.elements) {
  if (e.type !== 'FUNC' || !e.realRef?.file) continue;
  const t = graph.traces.find((t) => t.source === e.id && t.type === 'allocate' && typeOf.get(t.target) === 'MOD');
  if (t) direkt.set(e.realRef.file, t.target);
}
const pfade = graph.elements
  .filter((e) => e.type === 'MOD' && typeof e.path === 'string' && e.path.length > 0)
  .map((e) => [e.id, e.path]);
const modOf = (f) => {
  if (direkt.has(f)) return direkt.get(f);
  let best = null;
  for (const [id, p] of pfade) if ((f === p || f.startsWith(p + '/')) && (!best || p.length > best[1].length)) best = [id, p];
  return best?.[0];
};

// ---------------------------------------------------------------------------
// Importe: wer holt welches Symbol aus welcher Datei?
// ---------------------------------------------------------------------------
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p.slice(REPO.length + 1));
  }
  return out;
};
const dateien = walk(join(REPO, 'src'));

const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;
/** Grenzsymbol -> { typ, holer: Set<MOD> } */
const grenze = new Map();
let innen = 0;
const blind = new Set(); // Importziele ohne MOD — die Aussage reicht nicht bis dorthin

for (const f of dateien) {
  const von = modOf(f);
  const text = readFileSync(join(REPO, f), 'utf8');
  for (const m of text.matchAll(IMPORT)) {
    const quelle = m[3];
    if (!quelle.startsWith('.')) continue; // Paket-Importe: RC-06s Gebiet, nicht MOD-Grenze
    let ziel = normalize(join(dirname(f), quelle)).replace(/\.js$/, '.ts');
    if (!existsSync(join(REPO, ziel))) {
      const idx = ziel.replace(/\.ts$/, '') + '/index.ts';
      if (existsSync(join(REPO, idx))) ziel = idx;
      else continue;
    }
    const nach = modOf(ziel);
    if (!von || !nach) { blind.add(!nach ? ziel : f); continue; }
    for (let s of m[2].split(',')) {
      s = s.trim();
      if (!s) continue;
      const istTyp = Boolean(m[1]) || /^type\s/.test(s);
      s = s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (!s) continue;
      if (von === nach) { innen++; continue; }
      const key = `${ziel}#${s}`;
      if (!grenze.has(key)) grenze.set(key, { typ: istTyp || /^[A-Z]/.test(s) ? 'SCHEMA' : 'FUNC', holer: new Set() });
      grenze.get(key).holer.add(von);
    }
  }
}

// ---------------------------------------------------------------------------
// Gegen das Modell halten
// ---------------------------------------------------------------------------
const gebunden = (typ) =>
  new Set(graph.elements.filter((e) => e.type === typ && e.realRef?.file && e.realRef?.symbol)
    .map((e) => `${e.realRef.file}#${e.realRef.symbol}`));
const funcGebunden = gebunden('FUNC');
const schemaGebunden = gebunden('SCHEMA');

const pflicht = { FUNC: [], SCHEMA: [] };
for (const [k, v] of grenze) pflicht[v.typ].push(k);

const fmt = (n, d) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)} %`);
const zeile = (typ, menge, modell) => {
  const da = menge.filter((k) => modell.has(k));
  const fehlt = menge.filter((k) => !modell.has(k));
  return { typ, pflicht: menge.length, da: da.length, fehlt, extra: [...modell].filter((k) => !grenze.has(k)) };
};
const r = [zeile('FUNC', pflicht.FUNC, funcGebunden), zeile('SCHEMA', pflicht.SCHEMA, schemaGebunden)];

console.log(`# Grenzmenge — ${MEMBER} (graphVersion ${graph.graphVersion})\n`);
console.log(`Datei→MOD: ${direkt.size} Dateien direkt gebunden, ${pfade.length} MOD mit \`path\`.`);
console.log(`${dateien.length} Quelldateien unter \`src/\`, ${innen} modul-INTERNE Import-Bindungen ` +
  `(die gehen niemanden an) und ${grenze.size} grenzüberschreitende Symbole.\n`);

console.log('| | Pflichtmenge | im Modell | Deckung | fehlt | modelliert, kreuzt nicht |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const x of r) {
  console.log(`| ${x.typ} | ${x.pflicht} | ${x.da} | **${fmt(x.da, x.pflicht)}** | ${x.fehlt.length} | ${x.extra.length} |`);
}

for (const x of r) {
  if (x.fehlt.length === 0) continue;
  console.log(`\n## ${x.typ} — was die Grenze kreuzt und NICHT im Modell steht (${x.fehlt.length})\n`);
  const nachHolern = x.fehlt
    .map((k) => ({ k, n: grenze.get(k).holer.size, holer: [...grenze.get(k).holer].sort().join(', ') }))
    .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  for (const e of nachHolern.slice(0, 20)) console.log(`- \`${e.k}\` — geholt von ${e.n} MOD: ${e.holer}`);
  if (nachHolern.length > 20) console.log(`- … und ${nachHolern.length - 20} weitere`);
}

if (blind.size > 0) {
  console.log(`\n## Blinder Fleck (${blind.size})\n`);
  console.log('Dateien ohne MOD an einem Ende des Imports — bis dorthin reicht die Aussage nicht:\n');
  for (const b of [...blind].sort()) console.log(`- \`${b}\``);
}
