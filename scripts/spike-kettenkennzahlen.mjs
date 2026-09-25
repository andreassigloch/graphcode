#!/usr/bin/env node
// Spike (Konzept „Modell- vs. Realisierungsarchitektur", docs/Aise_Architektur_Guide) —
// lassen sich die acht Kettenkennzahlen auf den realen Familie-Graphen HEUTE deterministisch
// berechnen, und sagen sie etwas, was R⁶ nicht schon sagt?
//
// Regelkandidaten (vor der Messung festgelegt):
//   K-MESSBAR   eine FCHAIN ist messbar ⇔ ihre Glieder bilden, gerichtet über
//               FUNC -io-> FLOW -io-> FUNC, EINE Komponente mit ≥1 Eingang und ≥1 Ausgang
//               (Eingang/Ausgang = FLOW von/zu ACTOR oder FUNC außerhalb der Kette).
//               Schwelle: Anteil messbarer Ketten je Graph ≥ 0,8, sonst ist ein Profilurteil
//               über den Graphen nicht belastbar.
//   K-INFO      die Kettenkennzahlen tragen Information jenseits von R⁶ ⇔ |r(mittlere
//               Kettenlänge, flowEfficiency)| < 0,7 über den Korpus (flowEfficiency ist der
//               globale Pfadlängen-Proxy in R⁶).
// Positivkontrolle: synthetische Kette „Zahlung auslösen" aus dem Konzept, bekannte Antwort.
// Gegenprobe: dieselbe Kette mit Rückkopplung + Verzweigung — die Kennzahlen müssen umschlagen.
//
// Nur lesend: JSON-SSOT, kein Store, kein Gate, kein Write.
// Usage: node scripts/spike-kettenkennzahlen.mjs [--json]
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';
import { metrics } from '@sigloch/se-engine';

const DEV = '/Users/andreas/Developer/dev';
const PROD = '/Users/andreas/Developer/prod';
const CORPUS = [
  ['graphcode', `${DEV}/graphcode/docs/graph/graphcode.graph.json`],
  ['sigloch-modules', `${DEV}/sigloch-modules/docs/graph/sigloch-modules.graph.json`],
  ['graphcodedemo', `${PROD}/graphcodedemo/docs/graph/graphcodedemo.graph.json`],
  ['sirail', `${DEV}/sirail/docs/graph/sirail.graph.json`],
  ['siconizer', `${DEV}/siconizer/docs/graph/siconizer.graph.json`],
  ['graph-view-edit', `${DEV}/graph-view-edit/docs/graph/graph-view-edit.graph.json`],
  ['gc_test-graphview', `${DEV}/gc_test-graphview/docs/graph/gc_test-graphview.graph.json`],
  ['bok', `${DEV}/bok/docs/graph/bok.graph.json`],
  ['graphify', `${DEV}/graphify/docs/graph/graphify.graph.json`],
  ['sigllm', `${PROD}/sigllm/docs/graph/sigllm.graph.json`],
  // ohne FCHAIN — benannt statt verschwiegen:
  ['moneyflow', `${DEV}/moneyflow/docs/graph/moneyflow.graph.json`],
  ['gc_test-sqlite', `${DEV}/gc_test-sqlite/docs/graph/gc_test-sqlite.graph.json`],
];

// ── Graph-Mechanik ───────────────────────────────────────────────────────────────────
export function indexGraph(g) {
  const type = new Map(g.elements.map((e) => [e.id, e.type]));
  const parent = new Map();
  const alloc = new Map();
  const prod = new Map(), cons = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const t of g.traces) {
    if (t.type === 'compose' && type.get(t.source) === 'FUNC' && type.get(t.target) === 'FUNC') parent.set(t.target, t.source);
    if (t.type === 'allocate' && type.get(t.source) === 'FUNC') alloc.set(t.source, t.target);
    if (t.type !== 'io') continue;
    if (type.get(t.target) === 'FLOW') push(prod, t.target, t.source); // FUNC|ACTOR -io-> FLOW
    if (type.get(t.source) === 'FLOW') push(cons, t.source, t.target); // FLOW -io-> FUNC|ACTOR
  }
  const modOf = (f) => { let x = f, n = 0; while (!alloc.has(x) && parent.has(x) && n++ < 50) x = parent.get(x); return alloc.get(x); };
  const chains = g.elements.filter((e) => e.type === 'FCHAIN').map((fc) => ({
    id: fc.id,
    members: new Set(g.traces.filter((t) => t.source === fc.id && t.type === 'compose' && type.get(t.target) === 'FUNC').map((t) => t.target)),
  }));
  const reqsOf = new Map(); // Element → REQs, die es per satisfy erfüllt (Rückwärts-Blast-Radius)
  for (const t of g.traces) if (t.type === 'satisfy' && type.get(t.target) === 'REQ') push(reqsOf, t.source, t.target);
  return { type, prod, cons, modOf, chains, reqsOf };
}

/** Die acht Kennzahlen einer Kette. `shareCount`: FUNC → Anzahl Ketten, in denen sie liegt. */
export function chainMetrics(ix, chain, shareCount) {
  const m = chain.members;
  const adj = new Map([...m].map((f) => [f, new Set()]));
  const entries = new Set(), exits = new Set();
  for (const [fl, ps] of ix.prod) {
    const cs = ix.cons.get(fl) ?? [];
    for (const p of ps) for (const c of cs) {
      if (m.has(p) && m.has(c) && p !== c) adj.get(p).add(c);
      else if (!m.has(p) && m.has(c)) entries.add(c);
      else if (m.has(p) && !m.has(c)) exits.add(p);
    }
  }
  // Zusammenhang ungerichtet über die Kettenkanten
  const und = new Map([...m].map((f) => [f, new Set()]));
  for (const [a, s] of adj) for (const b of s) { und.get(a).add(b); und.get(b).add(a); }
  const seen = new Set(); let components = 0;
  const comps = [];
  for (const f of m) if (!seen.has(f)) { components++; const c = [f]; seen.add(f); for (let i = 0; i < c.length; i++) for (const n of und.get(c[i])) if (!seen.has(n)) { seen.add(n); c.push(n); } comps.push(c); }
  // Zerfallsursache je Nebenkomponente: „lose" = ein Glied ohne io-Eingang oder -Ausgang (R-31-Klasse),
  // „Ast" = voll verdrahtet, aber nur über einen Knoten AUSSERHALB der Kette angebunden (keine Regel).
  const wiredIn = (f) => [...ix.cons.values()].some((cs) => cs.includes(f));
  const wiredOut = (f) => [...ix.prod.values()].some((ps) => ps.includes(f));
  const side = comps.sort((a, b) => b.length - a.length).slice(1);
  const loose = side.filter((c) => c.some((f) => !wiredIn(f) || !wiredOut(f))).length;
  // Ast weiter aufgeschlüsselt: „fehlendes Glied" = Hauptteil → X → Ast (oder umgekehrt) über eine
  // Außen-FUNC X — die Kette ist unvollständig; sonst „gemeinsame Quelle" — parallele Dienste in einem Sack.
  const succ = (a) => { const r = new Set(); for (const [fl, ps] of ix.prod) if (ps.includes(a)) for (const c of ix.cons.get(fl) ?? []) r.add(c); return r; };
  const main = new Set(comps[0] ?? []);
  const reaches = (from, to) => [...from].some((a) => [...succ(a)].some((x) => !m.has(x) && [...succ(x)].some((b) => to.has(b))));
  const branchComps = side.filter((c) => !c.some((f) => !wiredIn(f) || !wiredOut(f)));
  const missingLink = branchComps.filter((c) => reaches(main, new Set(c)) || reaches(new Set(c), main)).length;
  const branches = branchComps.length, commonSource = branches - missingLink;
  // Rückkopplungen: Tarjan-SCC, jede nicht-triviale SCC ist eine Schleife
  let idx = 0; const ind = new Map(), low = new Map(), on = new Set(), stack = [], sccOf = new Map(); let loops = 0;
  const strong = (v) => {
    ind.set(v, idx); low.set(v, idx++); stack.push(v); on.add(v);
    for (const w of adj.get(v)) {
      if (!ind.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), ind.get(w)));
    }
    if (low.get(v) === ind.get(v)) { const comp = []; let w; do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) loops++; for (const c of comp) sccOf.set(c, v); }
  };
  for (const f of m) if (!ind.has(f)) strong(f);
  // Längster Pfad auf dem Kondensat (Schritte = FUNCs auf dem Pfad), plus Grenzübertritte darauf
  const cAdj = new Map();
  for (const [a, s] of adj) for (const b of s) { const ca = sccOf.get(a), cb = sccOf.get(b); if (ca !== cb) (cAdj.get(ca) ?? cAdj.set(ca, new Set()).get(ca)).add(cb); }
  const memo = new Map();
  const longest = (c) => { if (memo.has(c)) return memo.get(c); let best = 1; for (const n of cAdj.get(c) ?? []) best = Math.max(best, 1 + longest(n)); memo.set(c, best); return best; };
  let length = 0; for (const f of m) length = Math.max(length, longest(sccOf.get(f)));
  let edges = 0, crossings = 0, fanout = 0;
  for (const [a, s] of adj) { fanout = Math.max(fanout, s.size); for (const b of s) { edges++; if (ix.modOf(a) !== ix.modOf(b)) crossings++; } }
  const shared = [...m].filter((f) => (shareCount.get(f) ?? 0) > 1);
  // Engstelle: geteilter Knoten mit Durchgang (Ein- UND Ausgang in der Kette) — ohne sync-Markierung
  // ist das die obere Schranke des Konzeptbegriffs „synchron durchlaufener geteilter Knoten".
  const hasIn = new Set([...adj.values()].flatMap((s) => [...s]));
  const bottlenecks = shared.filter((f) => hasIn.has(f) && adj.get(f).size > 0);
  const measurable = m.size > 0 && components === 1 && entries.size > 0 && exits.size > 0;
  return {
    funcs: m.size, edges, measurable, components, loose, branches, missingLink, commonSource, entries: entries.size, exits: exits.size,
    length, syncDepth: null, fanout, crossings, loops,
    shared: shared.length, bottlenecks: bottlenecks.length, errorPathDepth: null,
  };
}

function measureGraph(g) {
  const ix = indexGraph(g);
  const share = new Map();
  for (const c of ix.chains) for (const f of c.members) share.set(f, (share.get(f) ?? 0) + 1);
  const rows = ix.chains.map((c) => ({ id: c.id, ...chainMetrics(ix, c, share) }));
  // Blast-Radius je FUNC: vorwärts = Ketten durch sie, rückwärts = REQs per satisfy
  const funcs = g.elements.filter((e) => e.type === 'FUNC');
  const fwd = funcs.map((f) => share.get(f.id) ?? 0), bwd = funcs.map((f) => (ix.reqsOf.get(f.id) ?? []).length);
  const attrHits = new Set();
  for (const e of g.elements) for (const k of Object.keys(e)) if (/sync|scal|volat|^source$|budget|complexity/i.test(k)) attrHits.add(`${e.type}.${k}`);
  return { rows, blast: { maxFwd: Math.max(0, ...fwd), maxBwd: Math.max(0, ...bwd), funcs: funcs.length }, attrHits: [...attrHits], r6: metrics(g, { layer: 'arch' }) };
}

// ── Positivkontrolle + Gegenprobe: „Zahlung auslösen" (Konzept, bekannte Antwort) ─────────
function zahlung(withLoop) {
  const steps = ['validieren', 'deckung', 'betrug', 'buchung', 'audit', 'bestaetigung'];
  const mod = { validieren: 'M-ui', deckung: 'M-core', betrug: 'M-core', buchung: 'M-core', audit: 'M-core', bestaetigung: 'M-ui' };
  const el = [{ id: 'ACTOR-kunde', type: 'ACTOR' }, { id: 'FCHAIN-zahlung', type: 'FCHAIN' }, { id: 'FCHAIN-storno', type: 'FCHAIN' },
    { id: 'M-ui', type: 'MOD' }, { id: 'M-core', type: 'MOD' }, ...steps.map((s) => ({ id: `F-${s}`, type: 'FUNC' }))];
  const tr = [];
  const flow = (id, from, to) => { el.push({ id, type: 'FLOW' }); tr.push({ source: from, target: id, type: 'io' }, { source: id, target: to, type: 'io' }); };
  flow('FL-in', 'ACTOR-kunde', 'F-validieren');
  for (let i = 0; i < steps.length - 1; i++) flow(`FL-${i}`, `F-${steps[i]}`, `F-${steps[i + 1]}`);
  flow('FL-out', 'F-bestaetigung', 'ACTOR-kunde');
  if (withLoop) { flow('FL-retry', 'F-betrug', 'F-deckung'); flow('FL-branch', 'F-buchung', 'F-bestaetigung'); }
  for (const s of steps) { tr.push({ source: 'FCHAIN-zahlung', target: `F-${s}`, type: 'compose' }, { source: `F-${s}`, target: mod[s], type: 'allocate' }); }
  tr.push({ source: 'FCHAIN-storno', target: 'F-buchung', type: 'compose' });
  return measureGraph({ elements: el, traces: tr }).rows.find((r) => r.id === 'FCHAIN-zahlung');
}
const pos = zahlung(false), neg = zahlung(true);
const posOk = pos.measurable && pos.length === 6 && pos.fanout === 1 && pos.crossings === 2 && pos.loops === 0 && pos.shared === 1 && pos.bottlenecks === 1;
const negOk = neg.loops === 1 && neg.fanout === 2 && neg.length === 5; // deckung↔betrug kollabiert zu einem Schritt

// ── Korpus ───────────────────────────────────────────────────────────────────────────
const report = [];
for (const [id, path] of CORPUS) {
  if (!existsSync(path)) { report.push({ id, skipped: 'Datei fehlt' }); continue; }
  const r = measureGraph(JSON.parse(readFileSync(path, 'utf8')));
  if (!r.rows.length) { report.push({ id, skipped: 'keine FCHAIN', flowEfficiency: r.r6.flowEfficiency }); continue; }
  const meas = r.rows.filter((x) => x.measurable);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  report.push({
    id, chains: r.rows.length, measurable: meas.length, share: meas.length / r.rows.length,
    meanLength: mean(meas.map((x) => x.length)), maxLength: Math.max(0, ...meas.map((x) => x.length)),
    maxFanout: Math.max(0, ...meas.map((x) => x.fanout)), meanCross: mean(meas.map((x) => x.crossings)),
    withLoops: meas.filter((x) => x.loops > 0).length, bottlenecks: meas.reduce((s, x) => s + x.bottlenecks, 0),
    blast: r.blast, attrHits: r.attrHits, flowEfficiency: r.r6.flowEfficiency, rows: r.rows,
  });
}
const ok = report.filter((r) => !r.skipped && r.measurable >= 2);
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const r = ok.length >= 3 ? corr(ok.map((x) => x.meanLength), ok.map((x) => x.flowEfficiency)) : NaN;

if (process.argv.includes('--json')) { console.log(JSON.stringify({ pos, neg, posOk, negOk, report, r }, null, 2)); process.exit(0); }
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
console.log(`Positivkontrolle Zahlung: ${posOk ? 'OK' : 'FAIL'} ${JSON.stringify(pos)}`);
console.log(`Gegenprobe (Schleife+Ast): ${negOk ? 'OK' : 'FAIL'} ${JSON.stringify(neg)}\n`);
console.log('graph\tketten\tmessbar\tanteil\tØlänge\tmaxLänge\tmaxFan\tØgrenz\tschleif\tengst\tBR-vor\tBR-rück\tflowEff');
for (const x of report) {
  if (x.skipped) { console.log(`${x.id}\t— ${x.skipped}`); continue; }
  console.log([x.id, x.chains, x.measurable, f(x.share, 2), f(x.meanLength), x.maxLength, x.maxFanout, f(x.meanCross), x.withLoops, x.bottlenecks, x.blast.maxFwd, x.blast.maxBwd, f(x.flowEfficiency, 2)].join('\t'));
}
console.log(`\nK-MESSBAR: ${report.filter((x) => !x.skipped && x.share >= 0.8).length}/${report.filter((x) => !x.skipped).length} Graphen ≥ 0,8`);
console.log(`K-INFO: r(Ølänge, flowEfficiency) = ${f(r, 2)} über n=${ok.length}`);
console.log(`Realisierungsattribute (sync/scal/volat/source/budget) im Korpus: ${[...new Set(report.flatMap((x) => x.attrHits ?? []))].join(', ') || 'keine'}`);
const why = (x) => [!x.funcs && 'leer', x.loose && `${x.loose} lose`, x.missingLink && `${x.missingLink} fehlendes Glied`, x.commonSource && `${x.commonSource} Sack`, !x.entries && 'kein Eingang', !x.exits && 'kein Ausgang'].filter(Boolean).join(', ');
console.log('\nNicht messbare Ketten:');
for (const x of report.filter((y) => !y.skipped)) for (const row of x.rows.filter((y) => !y.measurable)) console.log(`  ${x.id}\t${row.id}\t${why(row)}`);
const all = report.filter((y) => !y.skipped).flatMap((y) => y.rows);
const cnt = (p) => all.filter(p).length;
console.log(`\nUrsachen über ${all.length} Ketten: lose Glieder ${cnt((x) => x.loose)} · fehlendes Glied ${cnt((x) => x.missingLink)} · Sack (parallele Äste an gemeinsamer Quelle) ${cnt((x) => x.commonSource)} · ohne Eingang ${cnt((x) => !x.entries)} · ohne Ausgang ${cnt((x) => !x.exits)}`);
