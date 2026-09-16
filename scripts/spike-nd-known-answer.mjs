#!/usr/bin/env node
// CR-GC-542 — SPIKE: findet ND die bekannten Duplikate?
//
// Known-Answer-Set aus vier BELEGTEN Paaren (drei echte Duplikate des Zuges 2026-09-16 plus
// ein zeichengleiches als Gegenprobe). Gefragt ist nicht "ist die Schwelle richtig", sondern
// ob das Mass ueberhaupt eine Chance hat. Ergebnis sind ZAHLEN, keine Argumente.
//
// Aufruf aus dem graphcode-Repo: node scripts/spike-nd-known-answer.mjs
//
// Kein Produktionscode, keine Aenderung an contracts. ND-01/ND-02 bleiben in `notInGate`.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { funcSimilarity, schemaSimilarity, pairsAbove, tokens, jaccard } from '@sigloch/contracts/se';

const GC = '/Users/andreas/Developer/dev/graphcode';
const SM = '/Users/andreas/Developer/dev/sigloch-modules';

const show = (repo, ref, path) =>
  execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 << 20 });

/**
 * Der Rumpf eines Symbols, per Klammerzaehlung ab der Deklarationszeile.
 * Bewusst simpel: der Spike misst Aehnlichkeit, nicht Parser-Qualitaet. Findet er das
 * Symbol nicht, sagt er es (null) statt zu raten.
 */
function symbolBody(src, name) {
  const lines = src.split('\n');
  const decl = new RegExp(`(^|\\s)(export\\s+)?(async\\s+)?(function|const|static)?\\s*${name}\\s*[(<=]`);
  const start = lines.findIndex(l => decl.test(l));
  if (start < 0) return null;
  let depth = 0, seen = false;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; seen = true; }
      else if (ch === '}') depth--;
    }
    if (seen && depth <= 0) break;
  }
  return out.join('\n');
}

/** Kommentare raus — sonst misst man die Doku, nicht den Code. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

// ---------------------------------------------------------------------------
// Die vier Faelle. Jeder mit Beleg (CR + Commit), damit nichts behauptet ist.
// ---------------------------------------------------------------------------
const FAELLE = [
  {
    id: 'F1', label: 'contracts Format-E-Parser ↔ graph-api-core FormatECodec',
    cr: 'CR-SM-331', commit: '5b2e881', besonderheit: 'ueber Paketgrenze, gleiches Repo',
    a: { repo: SM, ref: '5b2e881^', file: 'packages/contracts/src/se/format-e-parser.ts', symbol: 'serializeToFormatE' },
    b: { repo: SM, ref: '5b2e881^', file: 'packages/graph-api-core/src/format-e-codec.ts', symbol: 'serialize' },
  },
  {
    id: 'F2', label: 'graphcode GraphCodeCodec.encode ↔ graph-api-core FormatECodec.serialize',
    cr: 'CR-GC-536', commit: 'c55f3f4', besonderheit: 'ueber REPO-Grenze, 51 Tage (CR-GC-103)',
    a: { repo: GC, ref: 'c55f3f4^', file: 'src/projections/codec.ts', symbol: 'encode' },
    b: { repo: SM, ref: 'HEAD', file: 'packages/graph-api-core/src/format-e-codec.ts', symbol: 'serialize' },
  },
  {
    id: 'F3', label: 'contracts chainsByFunc: Kennzahl ↔ R-21',
    cr: 'CR-SM-335', commit: 'c34aefa', besonderheit: 'innerhalb EINES Pakets, zwei Dateien',
    a: { repo: SM, ref: 'c34aefa^', file: 'packages/contracts/src/se/function-criticality.ts', symbol: 'functionCriticality' },
    b: { repo: SM, ref: 'c34aefa^', file: 'packages/contracts/src/se/rules.ts', symbol: 'fchainMustHaveIntegrationTest' },
  },
  {
    id: 'F4', label: 'tokens/jaccard graphcode ↔ contracts — GEGENPROBE, zeichengleich',
    cr: 'CR-GC-488', commit: '712ebbc', besonderheit: 'Kontrolle: wer DAS nicht findet, misst nichts',
    a: { repo: GC, ref: '712ebbc^', file: 'src/kernel/measure/nd-similarity.ts', symbol: 'jaccard' },
    b: { repo: SM, ref: 'HEAD', file: 'packages/contracts/src/se/similarity.ts', symbol: 'jaccard' },
  },
];

// ---------------------------------------------------------------------------
// Die Familiengraphen — fuer Reichweite (F2 der CR-Fragen) und Fehlalarme (F4)
// ---------------------------------------------------------------------------
const D = '/Users/andreas/Developer/dev';
const GRAPHEN = [
  ['graphcode', GC], ['sigloch-modules', SM], ['bok', `${D}/bok`],
  ['graph-view-edit', `${D}/graph-view-edit`], ['sirail', `${D}/sirail`],
  ['graphify', `${D}/graphify`], ['moneyflow', `${D}/moneyflow`],
];
const ladeGraph = (p) => { const raw = JSON.parse(readFileSync(p, 'utf8')); return { elements: raw.elements, traces: raw.traces }; };
const modelle = GRAPHEN.map(([name, repo]) => [name, ladeGraph(`${repo}/docs/graph/${name}.graph.json`), repo]);

const pct = (x) => (x * 100).toFixed(1).padStart(5) + '%';

console.log('# CR-GC-542 — Spike ND: Known-Answer-Set\n');
console.log(`Gemessen ${new Date().toISOString().slice(0, 10)} mit @sigloch/contracts ` +
  `${JSON.parse(readFileSync(`${GC}/node_modules/@sigloch/contracts/package.json`, 'utf8')).version}, ` +
  'Schwelle ND = 0,85.\n');

// ===========================================================================
// FRAGE 2 zuerst: Reichweite. Ohne Knoten auf BEIDEN Seiten kann kein Mass etwas finden.
// ===========================================================================
console.log('## F2 — Reichweite: hat das Mass ueberhaupt zwei Knoten?\n');
console.log('Ein Knoten gilt als vorhanden, wenn irgendein Familiengraph ein FUNC/SCHEMA mit');
console.log('`realRef.file` auf diese Datei fuehrt. Ohne Knoten ist jede Aehnlichkeit gegenstandslos.\n');

const gebunden = [];
for (const [name, g, repo] of modelle) {
  for (const e of g.elements) {
    const r = e.realRef;
    if (r && typeof r.file === 'string') gebunden.push({ graph: name, repo, id: e.id, type: e.type, file: r.file, symbol: r.symbol ?? '' });
  }
}
// Ein realRef-Pfad gilt nur INNERHALB seines Repos — sonst matcht `rules.ts` aus vier Repos.
const findeKnoten = (seite) => gebunden.filter(b => b.repo === seite.repo && b.file === seite.file);

console.log('| Fall | Seite A modelliert? | Seite B modelliert? | beide im SELBEN Graphen? |');
console.log('|---|---|---|---|');
const reichweite = new Map();
for (const f of FAELLE) {
  const ka = findeKnoten(f.a), kb = findeKnoten(f.b);
  const gemeinsam = ka.some(x => kb.some(y => y.graph === x.graph && y.id !== x.id));
  reichweite.set(f.id, { ka, kb, gemeinsam });
  const zeig = (k) => k.length === 0 ? '**nein**' : k.map(x => `${x.graph}:${x.id}`).join(', ');
  console.log(`| ${f.id} ${f.label.split(' ↔ ')[0]} | ${zeig(ka)} | ${zeig(kb)} | ${gemeinsam ? 'ja' : '**nein**'} |`);
}
const keinPaar = FAELLE.filter(f => !reichweite.get(f.id).gemeinsam).length;
console.log(`\n**${keinPaar} von ${FAELLE.length} Faellen haben nicht einmal zwei Knoten im selben Graphen.**`);
console.log('Fuer sie ist die Schwelle irrelevant: ND-01/ND-02 laufen je Graph und vergleichen, was da ist.\n');

// ===========================================================================
// FRAGE 1: was WUERDE das Mass sagen, wenn die Knoten existierten?
// Synthetisch: zwei FUNC mit den echten Namen/Beschreibungen aus dem Code, ohne Kanten.
// ===========================================================================
console.log('## F1 — Was das Mass sagen wuerde (synthetisch, ohne Kanten)\n');
console.log('ND-01 = 0,35·descr + 0,25·verb + 0,25·io-Topologie + 0,15·REQ-Ueberlappung.');
console.log('Die Knoten tragen den echten Symbolnamen und den ersten Satz des Dateikopfes als');
console.log('Beschreibung — mehr weiss ein Modellierer beim Anlegen auch nicht.\n');

/** Erster Satz des fuehrenden Blockkommentars einer Datei. */
function kopfSatz(src) {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return '';
  return m[1].replace(/^\s*\*\s?/gm, ' ').replace(/\s+/g, ' ').trim().split(/(?<=\.)\s/)[0].slice(0, 200);
}

const synth = (f) => {
  const srcA = show(f.a.repo, f.a.ref, f.a.file), srcB = show(f.b.repo, f.b.ref, f.b.file);
  return {
    elements: [
      { id: 'FUNC-a', type: 'FUNC', name: f.a.symbol, description: kopfSatz(srcA) },
      { id: 'FUNC-b', type: 'FUNC', name: f.b.symbol, description: kopfSatz(srcB) },
    ],
    traces: [],
  };
};

console.log('| Fall | Name A | Name B | ND-01 synthetisch | ueber 0,85? |');
console.log('|---|---|---|---:|---|');
const f1 = new Map();
for (const f of FAELLE) {
  const g = synth(f);
  const sim = funcSimilarity(g);
  const s = sim.matrix[0][1];
  f1.set(f.id, s);
  console.log(`| ${f.id} | \`${f.a.symbol}\` | \`${f.b.symbol}\` | ${pct(s)} | ${s >= 0.85 ? '✓ JA' : '✗ nein'} |`);
}

// Der Bodensatz: leere Mengen gelten als identisch (jaccard(∅,∅)=1).
const leer = funcSimilarity({
  elements: [
    { id: 'FUNC-x', type: 'FUNC', name: 'alpha', description: 'voellig verschiedene worte hier' },
    { id: 'FUNC-y', type: 'FUNC', name: 'beta', description: 'nichts gemeinsam ueberhaupt keine' },
  ], traces: [],
}).matrix[0][1];
console.log(`\n**Bodensatz: zwei FUNC OHNE Kanten und ohne ein gemeinsames Wort erreichen ${pct(leer)}.**`);
console.log('`jaccard(∅,∅) = 1` — io-Topologie und REQ-Ueberlappung schenken ungebundenen Knoten 0,40.');
console.log('Zwei kantenlose FUNC mit gleichem ersten Wort stehen damit schon bei 0,65.\n');

// ===========================================================================
// FRAGE 3 — andere Masse, an DENSELBEN vier Faellen
// ===========================================================================
console.log('## F3 — Andere Masse an denselben vier Faellen\n');

// (a) Nachbarschaft ist KEIN neuer Kandidat: sie steckt schon zu 40% in ND-01.
console.log('**(a) Nachbarschaft** — kein neuer Kandidat. `similarity.ts` rechnet io-Topologie (0,25)');
console.log('und REQ-Ueberlappung (0,15) bereits mit; zusammen 40 % von ND-01. Der CR-Text hat das');
console.log('falsch wiedergegeben (er nannte 0,5·Name + 0,5·Beschreibung — das ist der REQ/UC-HINWEIS');
console.log('in graphcodes `nd-similarity.ts`, Schwelle 0,55, nicht die Regel). Korrigiert.\n');

// (b) Bindung: gleicher exportierter Symbolname in verschiedenen Paketen
console.log('**(b) Bindung** — gleicher `realRef.symbol` an verschiedenen Dateien, ueber alle Graphen:\n');
const proSymbol = new Map();
for (const b of gebunden) {
  if (!b.symbol) continue;
  const k = b.symbol;
  if (!proSymbol.has(k)) proSymbol.set(k, []);
  proSymbol.get(k).push(b);
}
const kollisionen = [...proSymbol.entries()].filter(([, v]) => new Set(v.map(x => x.file)).size > 1);
console.log(`Gemessen: ${gebunden.length} gebundene Knoten in ${modelle.length} Graphen, ` +
  `${proSymbol.size} verschiedene Symbolnamen, **${kollisionen.length} Kollisionen**.`);
for (const [sym, v] of kollisionen.slice(0, 10)) {
  console.log(`- \`${sym}\` — ${v.map(x => `${x.graph}:${x.file}`).join(' vs ')}`);
}
console.log('');

// (c) Code am realRef — Token-Aehnlichkeit der echten Symbole, kommentarfrei
console.log('**(c) Code am realRef** — Jaccard ueber die Token der echten Symbolrumpfe');
console.log('(Kommentare entfernt). Verlaesst den Graphen; genau deshalb mitgemessen.\n');
console.log('| Fall | Symbol A | Symbol B | Code-Jaccard | Datei-Jaccard |');
console.log('|---|---|---|---:|---:|');
const f3c = new Map();
for (const f of FAELLE) {
  const srcA = show(f.a.repo, f.a.ref, f.a.file), srcB = show(f.b.repo, f.b.ref, f.b.file);
  const bodyA = symbolBody(srcA, f.a.symbol), bodyB = symbolBody(srcB, f.b.symbol);
  const sym = bodyA && bodyB ? jaccard(tokens(stripComments(bodyA)), tokens(stripComments(bodyB))) : null;
  const datei = jaccard(tokens(stripComments(srcA)), tokens(stripComments(srcB)));
  f3c.set(f.id, sym);
  console.log(`| ${f.id} | ${bodyA ? `\`${f.a.symbol}\` (${bodyA.split('\n').length} Z.)` : '**nicht gefunden**'} ` +
    `| ${bodyB ? `\`${f.b.symbol}\` (${bodyB.split('\n').length} Z.)` : '**nicht gefunden**'} ` +
    `| ${sym === null ? '–' : pct(sym)} | ${pct(datei)} |`);
}
console.log('');

// ===========================================================================
// FRAGE 4 — Fehlalarme auf den echten Modellen
// ===========================================================================
console.log('## F4 — Fehlalarme: was ND heute auf den echten Graphen melden wuerde\n');
console.log('| Graph | FUNC | ND-01 ≥ 0,85 | ND-01 ≥ 0,70 | SCHEMA | ND-02 ≥ 0,85 | FUNC ohne io-Kante |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
let gesamt85 = 0;
const treffer = [];
for (const [name, g] of modelle) {
  const fs_ = funcSimilarity(g), ss = schemaSimilarity(g);
  const p85 = pairsAbove(fs_, 0.85), p70 = pairsAbove(fs_, 0.70), s85 = pairsAbove(ss, 0.85);
  const funcs = g.elements.filter(e => e.type === 'FUNC');
  const mitIo = new Set(g.traces.filter(t => t.type === 'io').flatMap(t => [t.source, t.target]));
  const ohneIo = funcs.filter(f => !mitIo.has(f.id)).length;
  gesamt85 += p85.length + s85.length;
  treffer.push([name, p85, s85, g]);
  console.log(`| ${name} | ${funcs.length} | ${p85.length} | ${p70.length} | ` +
    `${g.elements.filter(e => e.type === 'SCHEMA').length} | ${s85.length} | ${ohneIo}/${funcs.length} |`);
}
console.log(`\n**Gesamt ${gesamt85} Befunde bei severity \`error\`.** Jeder einzelne ist per Hand zu beurteilen.\n`);
console.log('ALLE Befunde im Klartext — ohne sie ist die Fehlalarm-Rate nicht beurteilbar.');
console.log('`T` markiert ein Ende in einer Testdatei: die von SourcererCC belegte Fehlalarm-Klasse');
console.log('(aehnliche Assertionsfolgen, verschiedenes Verhalten).\n');
const istTest = (el) => /test|spec/i.test(el?.realRef?.file ?? el?.id ?? '');
let echt = 0, unecht = 0;
for (const [name, p85, s85, g] of treffer) {
  const byId = new Map(g.elements.map(e => [e.id, e]));
  for (const p of [...p85, ...s85]) {
    const ea = byId.get(p.a), eb = byId.get(p.b);
    // Test gegen Nicht-Test = gleicher Name, anderes Verhalten -> Fehlalarm.
    const gemischt = istTest(ea) !== istTest(eb);
    if (gemischt) unecht++; else echt++;
    const wo = (el, id) => el?.realRef?.file ?? id;
    console.log(`- ${gemischt ? '**FEHLALARM**' : 'Duplikat'} ${name}: \`${ea?.name ?? p.a}\` ` +
      `(${wo(ea, p.a)}) ≈ \`${eb?.name ?? p.b}\` (${wo(eb, p.b)}) — ${pct(p.similarity)}`);
  }
}
console.log(`\n**${echt} echte Mehrfach-Implementierungen, ${unecht} Fehlalarme** ` +
  `(Test gegen Produktionscode mit gleichem Namen).\n`);

// ===========================================================================
// F6 — DECKUNG. Die Frage hinter allen anderen: wie viel Code kennt das Modell?
// Die Bindungsquote misst FUNC-mit-realRef / FUNC. Das ist die falsche Richtung:
// sie sagt, wie gut das Modellierte gebunden ist, nie wie viel Code fehlt.
// ===========================================================================
console.log('## F6 — Deckung: wie viel vom Code kennt das Modell ueberhaupt?\n');

const EXPORT_RE = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)|^export\s+const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/gm;
const QUELLEN = [
  ['graphcode', GC, ['src']],
  ['sigloch-modules', SM, ['packages/contracts/src', 'packages/graph-api-core/src', 'packages/se-engine/src']],
  ['bok', `${D}/bok`, ['scripts/aise/lib']],
  ['graph-view-edit', `${D}/graph-view-edit`, ['src']],
];
const dateien = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(e.name)) walk(p); }
      else if (/\.(ts|mjs|jsx?)$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !/test|spec/.test(e.name)) out.push(p);
    }
  };
  try { walk(dir); } catch { /* Verzeichnis fehlt -> zaehlt als 0 */ }
  return out;
};

console.log('| Repo | exportierte Funktionen | exakt gebunden | Deckung (untere Schranke) | alle gebundenen Symbole | obere Schranke | Bindungsquote |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [name, repo, dirs] of QUELLEN) {
  const g = modelle.find(m => m[0] === name)[1];
  const exporte = new Set();
  for (const d of dirs) for (const f of dateien(`${repo}/${d}`)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(EXPORT_RE)) exporte.add(`${f.slice(repo.length + 1)}#${m[1] ?? m[2]}`);
  }
  const gebundeneSymbole = new Set(g.elements.filter(e => e.realRef?.symbol).map(e => `${e.realRef.file}#${e.realRef.symbol}`));
  const treffer = [...exporte].filter(x => gebundeneSymbole.has(x)).length;
  const funcs = g.elements.filter(e => e.type === 'FUNC');
  // Obere Schranke: auch Klassenmethoden zaehlen, die kein `export function` sind
  // (FUNC-encode bindet `codec.ts#encode`, eine Methode). Sonst redet man die Deckung klein.
  const inDirs = [...gebundeneSymbole].filter(x => dirs.some(d => x.startsWith(d + '/'))).length;
  console.log(`| ${name} | ${exporte.size} | ${treffer} | **${pct(exporte.size ? treffer / exporte.size : 0)}** | ` +
    `${inDirs} | ${pct(exporte.size ? Math.min(1, inDirs / exporte.size) : 0)} | ` +
    `${pct(funcs.length ? funcs.filter(e => e.realRef).length / funcs.length : 0)} |`);
}
console.log('\nDie beiden letzten Spalten messen VERSCHIEDENE Dinge. Die Bindungsquote sagt, wie gut');
console.log('das Modellierte am Code haengt. Die Deckung sagt, wie viel Code das Modell gar nicht kennt —');
console.log('und genau dort lagen alle vier Faelle. Eine Aehnlichkeitsregel kann nur finden, was da ist.\n');

// ===========================================================================
// Zusammenfassung — die EINE Tabelle, die der CR verlangt
// ===========================================================================
console.log('## Die eine Tabelle\n');
console.log('| Fall | zwei Knoten da? | ND-01 (synth.) | Code am realRef | gefunden von … |');
console.log('|---|---|---:|---:|---|');
for (const f of FAELLE) {
  const r = reichweite.get(f.id);
  const nd = f1.get(f.id), code = f3c.get(f.id);
  const wer = [nd >= 0.85 && r.gemeinsam ? 'ND' : null, code !== null && code >= 0.85 ? 'Code' : null]
    .filter(Boolean).join(' + ') || '**niemandem**';
  console.log(`| ${f.id} ${f.besonderheit} | ${r.gemeinsam ? 'ja' : '**nein**'} | ${pct(nd)} | ${code === null ? '–' : pct(code)} | ${wer} |`);
}
console.log('\n(ND-01 synthetisch heisst: die Knoten gibt es nicht, die Zahl ist ein Wenn-dann.');
console.log('Wo "zwei Knoten da?" nein sagt, kann ND den Fall auch bei Schwelle 0,0 nicht melden.)');
