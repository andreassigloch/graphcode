#!/usr/bin/env node
// Spike — laesst sich „wartet der Aufrufer?" je Uebergang OHNE das Attribut FLOW.sync herleiten,
// und zeigt die daraus gerechnete Wartetiefe Engstellen, die die Strukturkennzahlen nicht zeigen?
//
// Regelkandidaten (vor der Messung festgelegt):
//   K-STRUKT  die Struktur allein traegt ⇔ ein Uebergang mit modelliertem Rueckfluss (p→c und c→p)
//             ist im Code ein wartender Aufruf, einer ohne Rueckfluss nicht. Schwelle:
//             Uebereinstimmung mit der Code-Klasse ≥ 0,8 ueber die gebundenen Uebergaenge.
//   K-CODE    der Code traegt ⇔ ≥ 0,8 der gebundenen Uebergaenge fallen in eine der Klassen
//             push (p ruft c) · pull (c ruft p) · gefuehrt (ein Dritter ruft beide).
//   K-NUTZEN  die Messung zeigt etwas ⇔ sie nennt mindestens eine Engstelle (Funktion, auf die
//             ≥ 2 Ketten warten, Wartetiefe ≥ 3), die Stufe 1 (geteilter Knoten mit Durchgang)
//             NICHT nennt. Ob der Treffer echt ist, entscheidet das Lesen des Codes, nicht die Zahl.
// Positivkontrolle / Gegenprobe: synthetisches Mini-Repo mit bekannter Antwort (unten).
//
// Nur lesend: JSON-SSOT + Quelltext, kein Store, kein Gate, kein Write.
// Usage: node scripts/spike-sync-herleitung.mjs [--json] [--detail <graph>]
// @author andreas@siglochconsulting
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';

const DEV = '/Users/andreas/Developer/dev';
const CORPUS = ['graphcode', 'sigloch-modules', 'graphify', 'graph-view-edit', 'siconizer']
  .map((n) => [n, `${DEV}/${n}`, `${DEV}/${n}/docs/graph/${n}.graph.json`]);
const DEPTH = 4; // ein Aufruf zaehlt auch ueber bis zu DEPTH-1 Helfer, die kein Modellknoten sind

// ── Quelltext: Deklarationen und ihre Aufrufe (Namensaufloesung ueber Datei + Import) ─────────
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(n) && !/\.d\.ts$|\.test\./.test(n)) out.push(p);
  }
  return out;
}

/** decl-Schluessel = `${file}::${name}`; calls = [{name, awaited}] im Rumpf. */
export function indexCode(root, dirs) {
  const decls = new Map(), byName = new Map(), imports = new Map();
  const files = dirs.flatMap((d) => (existsSync(join(root, d)) ? walk(join(root, d)) : []));
  const tryFile = (base) => ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.js'].map((x) => base.replace(/\.js$/, '') + x).concat(base).find((p) => existsSync(p) && statSync(p).isFile());
  for (const file of files) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const imp = new Map(); imports.set(file, imp);
    const add = (name, body, isAsync) => {
      const calls = [];
      const visit = (n, aw) => {
        if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
          const c = n.expression;
          const nm = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
          if (nm) calls.push({ name: nm, awaited: aw, member: !ts.isIdentifier(c) });
        }
        ts.forEachChild(n, (ch) => visit(ch, ts.isAwaitExpression(n) || (aw && !ts.isCallExpression(n) && !ts.isArrowFunction(n) && !ts.isFunctionExpression(n))));
      };
      if (body) visit(body, false);
      const key = `${file}::${name}`;
      decls.set(key, { file, name, calls, isAsync });
      (byName.get(name) ?? byName.set(name, []).get(name)).push(key);
    };
    const isAsync = (n) => !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    const top = (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith('.')) {
        const target = tryFile(resolve(dirname(file), n.moduleSpecifier.text));
        const nb = n.importClause?.namedBindings;
        if (target && nb && ts.isNamedImports(nb)) for (const e of nb.elements) imp.set(e.name.text, `${target}::${(e.propertyName ?? e.name).text}`);
      } else if (ts.isFunctionDeclaration(n) && n.name) add(n.name.text, n.body, isAsync(n));
      else if (ts.isVariableStatement(n)) { for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) add(d.name.text, d.initializer, ts.isArrowFunction(d.initializer) && isAsync(d.initializer)); }
      else if (ts.isClassDeclaration(n) && n.name) {
        add(n.name.text, n, false);
        for (const m of n.members) if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) add(m.name.text, m.body, isAsync(m));
      }
    };
    sf.statements.forEach(top);
  }
  const resolveCall = (file, c) => {
    if (!c.member) return decls.has(`${file}::${c.name}`) ? `${file}::${c.name}` : imports.get(file).get(c.name) ?? null;
    const cand = byName.get(c.name) ?? [];
    return cand.length === 1 ? cand[0] : null; // Methodenaufruf: nur bei eindeutigem Namen
  };
  // gerichtete Aufrufkanten decl → decl, mit „gewartet": synchroner Aufruf oder await
  const out = new Map();
  for (const [key, d] of decls) {
    const m = new Map();
    for (const c of d.calls) {
      const t = resolveCall(d.file, c);
      if (!t || t === key || !decls.has(t)) continue;
      const waits = c.awaited || !decls.get(t).isAsync;
      m.set(t, (m.get(t) ?? false) || waits);
    }
    out.set(key, m);
  }
  return { decls, out, files: files.length };
}

/** Erreicht `from` `to` ueber Aufrufe, ohne durch einen anderen Modellknoten zu laufen? → {hops, waits} | null */
function reach(code, from, to, modelKeys) {
  let front = [[from, true]]; const seen = new Set([from]);
  for (let h = 1; h <= DEPTH; h++) {
    const next = [];
    for (const [k, w] of front) for (const [t, tw] of code.out.get(k) ?? []) {
      if (t === to) return { hops: h, waits: w && tw };
      if (seen.has(t) || modelKeys.has(t)) continue;
      seen.add(t); next.push([t, w && tw]);
    }
    front = next;
  }
  return null;
}

// ── Modell: Uebergaenge FUNC → FLOW → FUNC, Ketten, Stufe-1-Engstellen ─────────────────────────
export function measure(g, root, dirs) {
  const el = new Map(g.elements.map((e) => [e.id, e]));
  const prod = new Map(), cons = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const t of g.traces) {
    if (t.type !== 'io') continue;
    if (el.get(t.target)?.type === 'FLOW') push(prod, t.target, t.source);
    if (el.get(t.source)?.type === 'FLOW') push(cons, t.source, t.target);
  }
  const trans = new Map(); // `${p}>${c}` → [flowIds]
  for (const [fl, ps] of prod) for (const p of ps) for (const c of cons.get(fl) ?? []) {
    if (p !== c && el.get(p)?.type === 'FUNC' && el.get(c)?.type === 'FUNC') push(trans, `${p}>${c}`, fl);
  }
  const chains = g.elements.filter((e) => e.type === 'FCHAIN').map((fc) => ({ id: fc.id, members: new Set(g.traces.filter((t) => t.source === fc.id && t.type === 'compose' && el.get(t.target)?.type === 'FUNC').map((t) => t.target)) }));
  const chainsOf = new Map(); for (const c of chains) for (const f of c.members) push(chainsOf, f, c.id);

  const code = indexCode(root, dirs);
  const keyOf = (id) => { const r = el.get(id)?.realRef; const k = r?.symbol ? `${join(root, r.file)}::${r.symbol}` : null; return k && code.decls.has(k) ? k : null; };
  const funcs = g.elements.filter((e) => e.type === 'FUNC');
  const modelKeys = new Set(funcs.map((f) => keyOf(f.id)).filter(Boolean));
  const callers = new Map(); // decl → Set(decl), fuer „gefuehrt"
  for (const [k, m] of code.out) for (const t of m.keys()) (callers.get(t) ?? callers.set(t, new Set()).get(t)).add(k);

  const rows = [];
  const waitEdges = new Map(); // wartender → [auf wen]
  for (const [key, flows] of trans) {
    const [p, c] = key.split('>');
    const kp = keyOf(p), kc = keyOf(c);
    const back = trans.has(`${c}>${p}`);
    if (!kp || !kc) { rows.push({ p, c, flows, back, cls: 'ungebunden' }); continue; }
    const fwd = reach(code, kp, kc, modelKeys), rev = reach(code, kc, kp, modelKeys);
    let cls = 'kein Aufruf', waits = false, hops = null;
    if (fwd) { cls = 'push'; waits = fwd.waits; hops = fwd.hops; push(waitEdges, p, c); }
    else if (rev) { cls = 'pull'; waits = rev.waits; hops = rev.hops; push(waitEdges, c, p); }
    else if ([...(callers.get(kp) ?? [])].some((x) => callers.get(kc)?.has(x))) cls = 'gefuehrt';
    if ((fwd || rev) && !waits) waitEdges.get(fwd ? p : c).pop();
    rows.push({ p, c, flows, back, cls, waits, hops });
  }
  // Wartetiefe: laengster Pfad im Wartegraphen (Zyklen brechen am besuchten Knoten)
  const depth = (f, seen = new Set()) => { if (seen.has(f)) return 0; seen.add(f); let d = 0; for (const n of waitEdges.get(f) ?? []) d = Math.max(d, 1 + depth(n, seen)); seen.delete(f); return d; };
  const waitedBy = new Map(); for (const [a, bs] of waitEdges) for (const b of bs) push(waitedBy, b, a);
  // alle, die (transitiv) auf f warten → die Ketten, die an f haengen
  const upstream = (f) => { const s = new Set([f]); const q = [f]; while (q.length) for (const a of waitedBy.get(q.pop()) ?? []) if (!s.has(a)) { s.add(a); q.push(a); } return s; };
  const hot = funcs.map((f) => {
    const up = upstream(f.id);
    const ch = new Set([...up].flatMap((x) => chainsOf.get(x) ?? []));
    const below = depth(f.id);
    const above = Math.max(0, ...[...up].map((x) => depth(x))) - below;
    return { id: f.id, waiters: up.size - 1, chains: ch.size, depth: above + below, own: (chainsOf.get(f.id) ?? []).length };
  });
  // Stufe 1: geteilter Knoten mit Ein- und Ausgang in einer Kette
  const stage1 = new Set();
  for (const c of chains) for (const f of c.members) {
    if ((chainsOf.get(f) ?? []).length < 2) continue;
    const hasIn = [...c.members].some((x) => trans.has(`${x}>${f}`)), hasOut = [...c.members].some((x) => trans.has(`${f}>${x}`));
    if (hasIn && hasOut) stage1.add(f);
  }
  const chainDepth = chains.map((c) => ({ id: c.id, funcs: c.members.size, depth: Math.max(0, ...[...c.members].map((f) => depth(f))) }));
  return { rows, hot, stage1, chainDepth, files: code.files, bound: funcs.filter((f) => keyOf(f.id)).length, funcs: funcs.length };
}

// ── Positivkontrolle + Gegenprobe: bekannte Antwort ────────────────────────────────────────────
function control() {
  const root = mkdtempSync(join(tmpdir(), 'spike-sync-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), `import { pruefen } from './b.js';\nimport { melden } from './c.js';\nexport async function annehmen(x: number) { const ok = await pruefen(x); void melden(ok); return ok; }\n`);
  writeFileSync(join(root, 'src/b.ts'), `import { rechnen } from './d.js';\nexport async function pruefen(x: number) { return rechnen(x) > 0; }\n`);
  writeFileSync(join(root, 'src/c.ts'), `export async function melden(ok: boolean) { return ok; }\n`);
  writeFileSync(join(root, 'src/d.ts'), `export function rechnen(x: number) { return x * 2; }\nexport function lesen() { return 1; }\nexport function schreiben(v: number) { return v; }\n`);
  writeFileSync(join(root, 'src/e.ts'), `import { lesen, schreiben } from './d.js';\nexport function ablauf() { schreiben(lesen()); }\n`);
  const F = (id, file, symbol) => ({ id, type: 'FUNC', realRef: { file, symbol, lang: 'ts' } });
  const el = [F('F-annehmen', 'src/a.ts', 'annehmen'), F('F-pruefen', 'src/b.ts', 'pruefen'), F('F-melden', 'src/c.ts', 'melden'), F('F-rechnen', 'src/d.ts', 'rechnen'), F('F-lesen', 'src/d.ts', 'lesen'), F('F-schreiben', 'src/d.ts', 'schreiben'),
    { id: 'FCHAIN-1', type: 'FCHAIN' }, { id: 'FCHAIN-2', type: 'FCHAIN' }];
  const tr = [];
  const flow = (id, a, b) => { el.push({ id, type: 'FLOW' }); tr.push({ source: a, target: id, type: 'io' }, { source: id, target: b, type: 'io' }); };
  flow('FL-1', 'F-annehmen', 'F-pruefen'); flow('FL-2', 'F-pruefen', 'F-rechnen'); flow('FL-3', 'F-annehmen', 'F-melden'); flow('FL-4', 'F-lesen', 'F-schreiben');
  for (const f of ['F-annehmen', 'F-pruefen', 'F-rechnen', 'F-melden']) tr.push({ source: 'FCHAIN-1', target: f, type: 'compose' });
  for (const f of ['F-rechnen', 'F-lesen', 'F-schreiben']) tr.push({ source: 'FCHAIN-2', target: f, type: 'compose' });
  const r = measure({ elements: el, traces: tr }, root, ['src']);
  rmSync(root, { recursive: true });
  const row = (p, c) => r.rows.find((x) => x.p === p && x.c === c);
  const pos = row('F-annehmen', 'F-pruefen').cls === 'push' && row('F-annehmen', 'F-pruefen').waits && r.chainDepth.find((c) => c.id === 'FCHAIN-1').depth === 2;
  const neg = row('F-annehmen', 'F-melden').cls === 'push' && !row('F-annehmen', 'F-melden').waits && row('F-lesen', 'F-schreiben').cls === 'gefuehrt' && r.chainDepth.find((c) => c.id === 'FCHAIN-2').depth === 0;
  return { pos, neg, rows: r.rows, chainDepth: r.chainDepth };
}

// ── Korpus ─────────────────────────────────────────────────────────────────────────────────────
const ctl = control();
const report = [];
for (const [id, root, path] of CORPUS) {
  if (!existsSync(path)) { report.push({ id, skipped: 'Datei fehlt' }); continue; }
  const dirs = ['src', 'packages', 'scripts', 'lib', 'server', 'app'];
  report.push({ id, ...measure(JSON.parse(readFileSync(path, 'utf8')), root, dirs) });
}
if (process.argv.includes('--json')) { console.log(JSON.stringify({ ctl, report }, (_k, v) => (v instanceof Set ? [...v] : v), 2)); process.exit(0); }

console.log(`Positivkontrolle (await-Kette, Tiefe 2): ${ctl.pos ? 'OK' : 'FAIL'}`);
console.log(`Gegenprobe (nicht gewartet · gefuehrt, Tiefe 0): ${ctl.neg ? 'OK' : 'FAIL'}\n`);
const cnt = (a, p) => a.filter(p).length;
console.log('graph\tFUNC geb.\tUeberg.\tgebunden\tpush\tpull\tgefuehrt\tkein\tmit Rueckfluss\tStrukt=Code');
const tot = { bound: 0, classed: 0, agree: 0 };
for (const x of report) {
  if (x.skipped) { console.log(`${x.id}\t— ${x.skipped}`); continue; }
  const b = x.rows.filter((r) => r.cls !== 'ungebunden');
  const waiting = (r) => (r.cls === 'push' || r.cls === 'pull') && r.waits;
  const agree = cnt(b, (r) => r.back === waiting(r));
  tot.bound += b.length; tot.classed += cnt(b, (r) => r.cls !== 'kein Aufruf'); tot.agree += agree;
  console.log([x.id, `${x.bound}/${x.funcs}`, x.rows.length, b.length, cnt(b, (r) => r.cls === 'push'), cnt(b, (r) => r.cls === 'pull'), cnt(b, (r) => r.cls === 'gefuehrt'), cnt(b, (r) => r.cls === 'kein Aufruf'), cnt(x.rows, (r) => r.back), b.length ? (agree / b.length).toFixed(2) : '—'].join('\t'));
}
console.log(`\nK-CODE:   ${tot.classed}/${tot.bound} gebundene Uebergaenge klassifiziert = ${(tot.classed / tot.bound).toFixed(2)} (Schwelle 0,8)`);
console.log(`K-STRUKT: Rueckfluss = wartender Aufruf bei ${tot.agree}/${tot.bound} = ${(tot.agree / tot.bound).toFixed(2)} (Schwelle 0,8)`);
console.log('\nK-NUTZEN — Funktionen, auf die ≥ 2 Ketten warten, Wartetiefe ≥ 3:');
for (const x of report.filter((y) => !y.skipped)) {
  const h = x.hot.filter((f) => f.chains >= 2 && f.depth >= 3).sort((a, b) => b.chains - a.chains || b.waiters - a.waiters);
  console.log(`  ${x.id}: ${h.length} Treffer, davon ${cnt(h, (f) => !x.stage1.has(f.id))} nicht in Stufe 1 (Stufe 1 nennt ${x.stage1.size})`);
  for (const f of h.slice(0, 8)) console.log(`    ${f.id}\tKetten ${f.chains} (eigene ${f.own})\tWartende ${f.waiters}\tTiefe ${f.depth}\t${x.stage1.has(f.id) ? 'Stufe 1' : 'NEU'}`);
}
const d = process.argv.indexOf('--detail');
if (d > 0) {
  const x = report.find((y) => y.id === process.argv[d + 1]);
  console.log(`\nDetail ${x.id} — Uebergaenge:`);
  for (const r of x.rows.filter((y) => y.cls !== 'ungebunden')) console.log(`  ${r.cls}${r.waits ? '+wartet' : ''}${r.hops > 1 ? ` (${r.hops} Spruenge)` : ''}\t${r.p} → ${r.c}\t${r.back ? 'Rueckfluss' : ''}\t${r.flows.join(',')}`);
  console.log('Kettentiefe:'); for (const c of x.chainDepth) console.log(`  ${c.id}\tGlieder ${c.funcs}\tWartetiefe ${c.depth}`);
}
