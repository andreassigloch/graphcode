#!/usr/bin/env node
// CR-GC-637 — SPIKE: findet man parallele Pfade am gemeinsamen ENGPASS statt an Aehnlichkeit?
//
// ANLASS. CR-GC-632 entfernte einen zweiten Format-E-Leser, den CR-GC-631 zwei Stunden vorher
// angelegt hatte. Nachgemessen: Name-Jaccard 0,000, Rumpf-Jaccard 0,164 gegen ND-Schwelle 0,85.
// Kein Aehnlichkeitsmass haette ihn gefunden. Was beide teilten, war der EINGANG.
//
// HYPOTHESE. Zwei parallele Pfade sind einander nicht aehnlich — der zweite ist kuerzer, anders
// benannt und kann weniger. Aber sie fassen dieselbe SELTENE Ressource an: denselben Parser,
// dieselbe Persistenz, dieselbe Mustertabelle. Diese Ressource hat wenige Anfasser, also ist
// ihre Anfasserzahl ein Alarm — und zwar einer, der zaehlt statt vergleicht.
//
// METHODE. Known-Answer-Set aus BELEGTEN Paaren (CR + Commit). Je Paar, am Stand VOR dem Fix:
//   (1) Name-Jaccard und Rumpf-Jaccard — die Gegenkandidaten, dieselben Routinen wie ND-01/02.
//   (2) gemeinsame Bezeichner, die BEIDE Rumpfe rufen und die ihre Datei importiert.
//   (3) je gemeinsamem Bezeichner: in wie vielen DATEIEN er im Repo vorkommt (Engpass-Rang).
// Gesucht ist ein gemeinsamer Bezeichner mit KLEINEM Rang. Der waere die Tuer gewesen.
//
// Aufruf: node scripts/spike-engpass-known-answer.mjs
// Kein Produktionscode, keine Aenderung an contracts.
import { execFileSync } from 'node:child_process';
import { tokens, jaccard } from '@sigloch/contracts/se';

const GC = '/Users/andreas/Developer/dev/graphcode';
const SM = '/Users/andreas/Developer/dev/sigloch-modules';

const show = (repo, ref, path) => {
  try {
    return execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch { return null; }
};

/** Rumpf eines Symbols per Klammerzaehlung (uebernommen aus spike-nd-known-answer.mjs). */
function symbolBody(src, name) {
  if (!src) return null;
  const lines = src.split('\n');
  const decl = new RegExp(`(^|\\s)(export\\s+)?(async\\s+)?(function|const|static)?\\s*${name}\\s*[(<=:]`);
  const start = lines.findIndex((l) => decl.test(l));
  if (start < 0) return null;
  let depth = 0, seen = false;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; seen = true; } else if (ch === '}') depth--;
    }
    if (seen && depth <= 0) break;
  }
  return out.join('\n');
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** Die Bezeichner, die eine Datei IMPORTIERT — der Vorrat, aus dem ein Engpass kommen kann. */
function importierte(src, nurWerte = false) {
  const namen = new Set();
  for (const m of (src ?? '').matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from/g)) {
    const istTyp = Boolean(m[1]);
    for (const t of m[2].split(',')) {
      const roh = t.trim();
      if (nurWerte && (istTyp || roh.startsWith('type '))) continue;   // ein TYP ist kein Engpass
      const n = roh.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (n) namen.add(n);
    }
  }
  return namen;
}

/** Aufgerufene/benutzte Bezeichner im Rumpf — grob, aber gleich fuer beide Seiten. */
const benutzt = (body) => new Set((stripComments(body ?? '').match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []));

/** In wie vielen Dateien des Repos kommt der Bezeichner am Stand `ref` vor? */
function dateienMit(repo, ref, name) {
  // OHNE Pfadangabe: `git grep -- src packages tests` bricht GANZ ab, wenn eines der
  // Verzeichnisse am `ref` nicht existiert (graphcode hat kein `packages/`) — und lieferte
  // dann stillschweigend 0 fuer JEDEN Bezeichner. Gemessener Fehlgriff des ersten Laufs.
  try {
    const out = execFileSync('git', ['-C', repo, 'grep', '-l', '-w', name, ref], {
      encoding: 'utf8', maxBuffer: 64 << 20,
    });
    const zeilen = out.trim() ? out.trim().split('\n') : [];
    // Nur Quelltext zaehlen — Doku und Modell-JSON nennen dieselben Namen, ohne sie zu rufen.
    return zeilen.filter((z) => /\.(ts|mjs|js)$/.test(z) && !z.includes('/dist/')).length;
  } catch { return 0; }
}

// ---------------------------------------------------------------------------
// Die Faelle. Jeder mit CR + Commit, damit nichts behauptet ist.
// `ref` ist der Stand VOR dem Fix.
// ---------------------------------------------------------------------------
const FAELLE = [
  { id: 'P1', cr: 'CR-SM-331', art: 'Duplikat', label: 'Format-E-Serializer doppelt (contracts ↔ graph-api-core)',
    a: { repo: SM, ref: '5b2e881^', file: 'packages/contracts/src/se/format-e-parser.ts', symbol: 'serializeToFormatE' },
    b: { repo: SM, ref: '5b2e881^', file: 'packages/graph-api-core/src/format-e-codec.ts', symbol: 'serialize' } },

  { id: 'P2', cr: 'CR-GC-536', art: 'Duplikat', label: 'graphcode encode ↔ graph-api-core serialize (REPO-Grenze)',
    a: { repo: GC, ref: 'c55f3f4^', file: 'src/projections/codec.ts', symbol: 'encode' },
    b: { repo: SM, ref: 'HEAD', file: 'packages/graph-api-core/src/format-e-codec.ts', symbol: 'serialize' } },

  { id: 'P3', cr: 'CR-SM-335', art: 'Duplikat', label: 'Ketten-Index zweimal (Kennzahl ↔ R-21)',
    a: { repo: SM, ref: 'c34aefa^', file: 'packages/contracts/src/se/function-criticality.ts', symbol: 'functionCriticality' },
    b: { repo: SM, ref: 'c34aefa^', file: 'packages/contracts/src/se/rules.ts', symbol: 'fchainMustHaveIntegrationTest' } },

  { id: 'P4', cr: 'CR-GC-531', art: 'Zweite Pruefung', label: 'Kantenlegalitaet im Codec neben R-18',
    a: { repo: GC, ref: '4b8144d^', file: 'src/projections/codec.ts', symbol: 'validate' },
    b: { repo: SM, ref: 'HEAD', file: 'packages/contracts/src/se/rules.ts', symbol: 'traceRejection' } },

  { id: 'P5', cr: 'CR-SM-336', art: 'Zweite Tuer', label: 'Express POST /mutate am Gate vorbei',
    a: { repo: SM, ref: '50ab74a^', file: 'packages/graph-api-express/src/express-transport.ts', symbol: 'registerRoutes' },
    b: { repo: SM, ref: '50ab74a^', file: 'packages/graph-api-core/src/graph-service.ts', symbol: 'mutate' } },

  { id: 'P6', cr: 'CR-GC-630', art: 'Zweiter Weg', label: 'Kaltstart baut Kommandos selbst statt formatEToCommands',
    a: { repo: GC, ref: 'd1285ef^', file: 'src/surface/bootstrap.ts', symbol: 'bootstrap' },
    b: { repo: GC, ref: 'd1285ef^', file: 'src/surface/write.ts', symbol: 'formatEToCommands' } },

  { id: 'P7', cr: 'CR-GC-632', art: 'Zweiter Leser', label: 'Testhelfer parst selbst',
    a: { repo: GC, ref: 'dbb4fd4', file: 'tests/helpers/format-e.ts', symbol: 'knotenAus' },
    b: { repo: GC, ref: 'dbb4fd4', file: 'src/surface/format-e-commands.ts', symbol: 'formatEToCommands' } },

  // --- Kontrollen -----------------------------------------------------------
  { id: 'K1', cr: 'CR-GC-488', art: 'KONTROLLE zeichengleich', kontrolle: true,
    label: 'jaccard ↔ jaccard — wer DAS nicht findet, misst nichts',
    a: { repo: GC, ref: '712ebbc^', file: 'src/kernel/measure/nd-similarity.ts', symbol: 'jaccard' },
    b: { repo: SM, ref: 'HEAD', file: 'packages/contracts/src/se/similarity.ts', symbol: 'jaccard' } },

  { id: 'K2', cr: '—', art: 'KONTROLLE fremd', kontrolle: true,
    label: 'zwei Funktionen ohne jede Beziehung — Fehlalarm-Probe',
    // Auf den Stand vor CR-GC-649 gepinnt: HEAD wandert, eine Kontrolle darf das nicht.
    a: { repo: GC, ref: 'b037983', file: 'src/surface/format-e-commands.ts', symbol: 'formatEToCommands' },
    b: { repo: GC, ref: 'HEAD', file: 'src/kernel/measure/test-selection.ts', symbol: 'impactedTests' } },
];

/** Allerweltsnamen, die nie ein Engpass sind. */
const STOP = new Set([
  'const', 'let', 'return', 'if', 'else', 'for', 'of', 'in', 'new', 'this', 'type', 'string', 'number',
  'boolean', 'void', 'null', 'undefined', 'true', 'false', 'function', 'async', 'await', 'export',
  'import', 'from', 'Map', 'Set', 'Array', 'Object', 'String', 'Number', 'Error', 'JSON', 'push',
  'length', 'map', 'filter', 'join', 'split', 'has', 'get', 'set', 'add', 'keys', 'values', 'entries',
  'throw', 'catch', 'try', 'switch', 'case', 'break', 'default', 'typeof', 'startsWith', 'sort',
]);

console.log('# CR-GC-637 — Spike Engpass: Known-Answer-Set\n');
console.log(`Gemessen ${new Date().toISOString().slice(0, 10)}. Schwelle ND = 0,85 (zum Vergleich).\n`);
console.log('## Die Messung je Fall\n');
console.log('| Fall | Art | Name-J | Rumpf-J | ND faendet? | Engpass je RUMPF | Engpass je DATEI |');
console.log('|---|---|---:|---:|---|---|---|');

const ergebnis = [];
for (const f of FAELLE) {
  const srcA = show(f.a.repo, f.a.ref, f.a.file);
  const srcB = show(f.b.repo, f.b.ref, f.b.file);
  const bodyA = symbolBody(srcA, f.a.symbol);
  const bodyB = symbolBody(srcB, f.b.symbol);
  if (!bodyA || !bodyB) {
    console.log(`| ${f.id} | ${f.art} | — | — | — | **Symbol nicht gefunden** (${!bodyA ? f.a.symbol : f.b.symbol}) | — |`);
    ergebnis.push({ ...f, fehlt: true });
    continue;
  }

  const nameJ = jaccard(tokens(f.a.symbol), tokens(f.b.symbol));
  const rumpfJ = jaccard(tokens(stripComments(bodyA)), tokens(stripComments(bodyB)));

  const impA = importierte(srcA), impB = importierte(srcB);

  /** Gemeinsame Bezeichner, die mindestens eine Seite IMPORTIERT, mit ihrem Engpass-Rang. */
  const engpaesse = (mengeA, mengeB) =>
    [...mengeA]
      .filter((n) => mengeB.has(n) && !STOP.has(n) && n.length > 2 && (impA.has(n) || impB.has(n)))
      .map((n) => ({ name: n, rang: Math.max(dateienMit(f.a.repo, f.a.ref, n), dateienMit(f.b.repo, f.b.ref, n)) }))
      .filter((x) => x.rang > 0)
      .sort((x, y) => x.rang - y.rang);

  // EBENE 1 — nur die beiden Rumpfe.
  const mitRang = engpaesse(benutzt(bodyA), benutzt(bodyB));
  // EBENE 2 — die ganzen Dateien. Grund: gemessen an P7 fasst der duplizierende Rumpf den
  // Engpass oft NICHT selbst an; `knotenAus` rief ein lokales `operationen()`, und erst das
  // rief `FORMAT_E_CODEC.parse`. Eine Indirektion genuegt, und die Symbolebene ist blind.
  const mitRangDatei = engpaesse(benutzt(srcA), benutzt(srcB));

  const best = mitRang[0];
  const bestDatei = mitRangDatei[0];
  const pct = (x) => (x * 100).toFixed(1).padStart(5) + '%';
  console.log(
    `| ${f.id} | ${f.art} | ${pct(nameJ)} | ${pct(rumpfJ)} | ${rumpfJ >= 0.85 ? '✓ ja' : '✗ **nein**'} | ` +
    `${best ? '`' + best.name + '`(' + best.rang + ')' : '—'} | ` +
    `${bestDatei ? '`' + bestDatei.name + '`(' + bestDatei.rang + ')' : '**keiner**'} |`,
  );
  ergebnis.push({ ...f, nameJ, rumpfJ, mitRang, mitRangDatei });
}

// ---------------------------------------------------------------------------
console.log('\n## Auswertung\n');
const echte = ergebnis.filter((e) => !e.kontrolle && !e.fehlt);
const ndTrifft = echte.filter((e) => e.rumpfJ >= 0.85).length;
const rumpfTrifft = echte.filter((e) => e.mitRang?.length > 0).length;
const dateiTrifft = echte.filter((e) => e.mitRangDatei?.length > 0).length;
const dateiScharf = echte.filter((e) => e.mitRangDatei?.[0]?.rang <= 20).length;

console.log(`Echte Paare: **${echte.length}**`);
console.log(`- Rumpf-Jaccard ueber 0,85 — das Aehnlichkeitsmass: **${ndTrifft}**`);
console.log(`- gemeinsamer Engpass auf SYMBOL-Ebene: **${rumpfTrifft}**`);
console.log(`- gemeinsamer Engpass auf DATEI-Ebene: **${dateiTrifft}**`);
console.log(`- davon mit Rang ≤ 20 Dateien: **${dateiScharf}**`);

const k2 = ergebnis.find((e) => e.id === 'K2');
if (k2 && !k2.fehlt) {
  console.log(`\nFehlalarm-Probe K2 (zwei fremde Dateien): Symbol-Ebene ${k2.mitRang.length}, ` +
    `Datei-Ebene ${k2.mitRangDatei.length}` +
    `${k2.mitRangDatei[0] ? ` (schaerfster \`${k2.mitRangDatei[0].name}\`, Rang ${k2.mitRangDatei[0].rang})` : ''}.`);
}

console.log('\n### Die Engpaesse je Fall (vollstaendig)\n');
for (const e of echte) {
  if (!e.mitRangDatei?.length) { console.log(`- **${e.id}** ${e.label}: keiner`); continue; }
  console.log(`- **${e.id}** ${e.label}: ` + e.mitRangDatei.slice(0, 6).map((x) => `\`${x.name}\`(${x.rang})`).join(', '));
}

// ===========================================================================
// FRAGE 2 — Wie LAUT ist das Signal? Ein Alarm, der bei jedem zweiten Dateipaar
// angeht, ist keiner. Gemessen ueber ALLE Dateipaare in graphcodes src/.
// ===========================================================================
console.log('\n## Rauschen: alle Dateipaare in graphcode/src\n');

const { readdirSync, statSync, readFileSync: lies } = await import('node:fs');
const { join: pfad, relative: rel } = await import('node:path');

const alleDateien = [];
(function lauf(d) {
  for (const e of readdirSync(d)) {
    const p = pfad(d, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== 'dist') lauf(p); }
    else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) alleDateien.push(rel(GC, p));
  }
})(pfad(GC, 'src'));

const proDatei = alleDateien.map((f) => {
  const src = lies(pfad(GC, f), 'utf8');
  return { f, imp: importierte(src), impWert: importierte(src, true), nutz: benutzt(src) };
});

// Invertierter Index: in wie vielen src-Dateien kommt ein Bezeichner vor?
const rang = new Map();
for (const d of proDatei) for (const n of d.nutz) rang.set(n, (rang.get(n) ?? 0) + 1);

const schwellen = [3, 5, 10, 20];
const treffer = new Map(schwellen.map((s) => [s, 0]));
let paare = 0;
for (let i = 0; i < proDatei.length; i++) {
  for (let j = i + 1; j < proDatei.length; j++) {
    paare++;
    const A = proDatei[i], B = proDatei[j];
    let schaerfster = Infinity;
    for (const n of A.nutz) {
      if (!B.nutz.has(n) || STOP.has(n) || n.length <= 2) continue;
      if (!A.imp.has(n) && !B.imp.has(n)) continue;
      const r = rang.get(n) ?? 0;
      if (r > 0 && r < schaerfster) schaerfster = r;
    }
    for (const s of schwellen) if (schaerfster <= s) treffer.set(s, treffer.get(s) + 1);
  }
}

console.log(`${proDatei.length} Dateien, ${paare} Paare.\n`);
console.log('| Alarmschwelle (Rang ≤) | Paare | Anteil |');
console.log('|---:|---:|---:|');
for (const s of schwellen) {
  const t = treffer.get(s);
  console.log(`| ${s} | ${t} | ${((100 * t) / paare).toFixed(1)} % |`);
}
console.log('\nZum Vergleich: die echten Paare oben liegen bei Rang 4–20.');

// ===========================================================================
// FRAGE 3 — Die Umkehrung. Als Detektor ueber Paare taugt es nicht (s. o.).
// Aber die Ratsche aus CR-GC-634 braucht keinen Detektor, sondern eine LISTE:
// welche Bezeichner sind selten genug, dass ein zweiter Anfasser eine Aussage ist?
// Hier wird nicht ueber Paare gerankt, sondern ueber Engpaesse — und davon gibt es wenige.
// ===========================================================================
console.log('\n## Die Umkehrung: welche Engpaesse gehoeren in die Ratsche?\n');

/**
 * Ein Engpass ist ein WERT (kein Typ), den MEHR ALS EINE Datei importiert — und zwar wenige.
 * Erster Versuch war „2–4 Anfasser, mindestens ein Import": 316 Kandidaten, unlesbar. Grund:
 * Rang 2 heisst meistens „hier definiert, dort einmal benutzt" — das ist kein Engpass, sondern
 * eine gewoehnliche Abhaengigkeit. Erst ZWEI Importeure machen eine Tuer.
 */
const kandidaten = [];
for (const [n, r] of rang) {
  if (r > 6 || STOP.has(n) || n.length <= 2) continue;
  const nutzer = proDatei.filter((d) => d.nutz.has(n));
  const importeure = nutzer.filter((d) => d.impWert.has(n));
  if (importeure.length < 2) continue;
  kandidaten.push({ name: n, rang: importeure.length, dateien: importeure.map((d) => d.f) });
}
kandidaten.sort((a, b) => a.rang - b.rang || a.name.localeCompare(b.name));

console.log(`Werte (keine Typen) mit 2–6 Anfassern, davon mindestens ZWEI per Import: **${kandidaten.length}**`);
console.log(`(gegen ${rang.size} Bezeichner insgesamt und ${paare} Dateipaare)\n`);
console.log('Das ist eine LESBARE Liste — und genau die Form, die `tests/engpass-ein-leser.test.ts`');
console.log('braucht: nicht „finde Duplikate", sondern „welche Tueren gibt es, und wer darf durch".\n');
console.log('| Engpass | Importeure | Dateien |');
console.log('|---|---:|---|');
for (const k of kandidaten.slice(0, 25)) {
  console.log(`| \`${k.name}\` | ${k.rang} | ${k.dateien.map((d) => d.replace('src/', '')).join(', ')} |`);
}
if (kandidaten.length > 25) console.log(`| … | | ${kandidaten.length - 25} weitere |`);
