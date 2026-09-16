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

/**
 * Die Messung als Funktion — CR-GC-546 braucht dieselben Zahlen fuer den Kennzahlen-Verlauf,
 * und eine zweite Rechnung waere ein zweites Ergebnis. Ein Rechenweg, zwei Aufrufer.
 */
export function messeGrenzmenge(REPO = process.cwd()) {
const MEMBER = REPO.replace(/\/+$/, '').split('/').pop();
// Greenfield: noch kein Snapshot, noch kein src/. Das ist ein ZUSTAND, kein Fehler — die
// Null-Zeile eines neuen Projekts muss gezogen werden koennen, sonst hat „start -> ende"
// keinen Start (CR-GC-548). `leer` sagt es der Zeile, statt eine Null zu erfinden.
const snapshotPfad = join(REPO, `docs/graph/${MEMBER}.graph.json`);
const graph = existsSync(snapshotPfad)
  ? JSON.parse(readFileSync(snapshotPfad, 'utf8'))
  : { graphVersion: 0, elements: [], traces: [] };
const quellDir = join(REPO, 'src');

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
    // CR-GC-548: nicht nur .ts — graph-view-edit ist JSX, und ein Projekt, das der Laeufer
    // nicht liest, meldet 0 Grenzsymbole statt „nicht gemessen". Das ist derselbe Fehler,
    // den `skipped`/`importCoverage` in der Familie ueberall sonst vermeiden.
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p.slice(REPO.length + 1));
  }
  return out;
};
const dateien = existsSync(quellDir) ? walk(quellDir) : [];

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
    // Importspezifizierer tragen die LAUFZEIT-Endung (.js) oder gar keine; die Quelle kann
    // .ts/.tsx/.js/.jsx/.mjs heissen oder ein Verzeichnis mit index.* sein.
    const roh = normalize(join(dirname(f), quelle));
    const kandidaten = [roh, ...['.ts', '.tsx', '.js', '.jsx', '.mjs'].flatMap((ext) => [
      roh.replace(/\.js$/, ext), roh + ext, join(roh, 'index' + ext),
    ])];
    const treffer = kandidaten.find((k) => existsSync(join(REPO, k)) && !k.endsWith('/'));
    if (!treffer) continue;
    const ziel = treffer;
    const nach = modOf(ziel);
    if (!von || !nach) { blind.add(!nach ? ziel : f); continue; }
    for (let s of m[2].split(',')) {
      s = s.trim();
      if (!s) continue;
      const istTyp = Boolean(m[1]) || /^type\s/.test(s);
      s = s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (!s) continue;
      if (von === nach) { innen++; continue; }
      // CR-GC-547: `X` und `XSchema` aus DERSELBEN Datei sind EIN Vertrag mit zwei Gesichtern —
      // die Zod-Laufzeitform und ihre TS-Sicht. Ungefaltet zaehlt die Grenzmenge beide und
      // bestraft damit genau den Zod-first-Schritt, den R-32/RC-04 verlangen. Kanonisch ist
      // die Schema-Form, sofern es sie in derselben Datei gibt.
      const kanon = s.endsWith('Schema') ? s.slice(0, -'Schema'.length) : s;
      const key = `${ziel}#${kanon}`;
      if (!grenze.has(key)) grenze.set(key, { typ: istTyp || /^[A-Z]/.test(s) ? 'SCHEMA' : 'FUNC', holer: new Set() });
      grenze.get(key).holer.add(von);
    }
  }
}

// ---------------------------------------------------------------------------
// Gegen das Modell halten
// ---------------------------------------------------------------------------
const falte = (sym) => (sym.endsWith('Schema') ? sym.slice(0, -'Schema'.length) : sym);
const gebunden = (typ) =>
  new Set(graph.elements.filter((e) => e.type === typ && e.realRef?.file && e.realRef?.symbol)
    .map((e) => `${e.realRef.file}#${falte(e.realRef.symbol)}`));
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
  // REICHWEITE der Aussage, nicht nur ihr Ergebnis (CR-GC-548). Ohne `MOD.path` loesen kaum
  // Dateien zu einem MOD auf, fast nichts gilt als grenzueberschreitend — und die Deckung
  // meldet ein schmeichelhaftes 100 % auf einem winzigen Nenner. graph-view-edit: 2 von 2.
  // Dieselbe Lehre wie `importCoverage` (CR-SM-268): eine Zahl ohne ihre Reichweite luegt.
  const mitMod = dateien.filter((f) => modOf(f) !== undefined).length;
  return { MEMBER, graph, direkt, pfade, dateien, innen, grenze, blind, r, fmt,
    aufloesung: dateien.length === 0 ? 0 : mitMod / dateien.length,
    mitMod,
    leer: !existsSync(snapshotPfad) || dateien.length === 0 };
}

/** Der Bericht — nur beim direkten Aufruf. */
function bericht({ MEMBER, graph, direkt, pfade, dateien, innen, grenze, blind, r, fmt, aufloesung, mitMod }) {
console.log(`# Grenzmenge — ${MEMBER} (graphVersion ${graph.graphVersion})\n`);
console.log(`Datei→MOD: ${direkt.size} Dateien direkt gebunden, ${pfade.length} MOD mit \`path\`.`);
console.log(`${dateien.length} Quelldateien unter \`src/\`, ${innen} modul-INTERNE Import-Bindungen ` +
  `(die gehen niemanden an) und ${grenze.size} grenzüberschreitende Symbole.\n`);
console.log(`**Reichweite: ${mitMod} von ${dateien.length} Dateien (${(100 * aufloesung).toFixed(1)} %) lösen zu einem MOD auf.**` +
  (aufloesung < 0.8 ? ' ⚠ Darunter ist die Deckung unten eine Aussage über einen kleinen Nenner, kein Gütesiegel.' : '') + '\n');

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
}

if (import.meta.url === `file://${process.argv[1]}`) bericht(messeGrenzmenge(process.argv[2] ?? undefined));
