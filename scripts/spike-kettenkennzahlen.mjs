#!/usr/bin/env node
// Spike (Konzept „Modell- vs. Realisierungsarchitektur", docs/graphcode_architektur_konzept.md) —
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
// CR-GC-767: die Kennzahlen und die Bewertbarkeit rechnet `chainMetrics` aus `@sigloch/contracts/se`
// (CR-SM-404) — dieselbe Funktion, die `graph_metrics` anzeigt. Hier bleibt nur, was sie bewusst
// nicht traegt: die Zerfallsursache je Nebenkomponente, der Blast-Radius, die Korrelation gegen R⁶.
//
// Nur lesend: JSON-SSOT, kein Store, kein Gate, kein Write.
// Usage: node scripts/spike-kettenkennzahlen.mjs [--json]
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';
import { metrics } from '@sigloch/se-engine';
import { chainMetrics } from '@sigloch/contracts/se';

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

// ── Diagnose: was `chainMetrics` nicht liefert ───────────────────────────────────────
/**
 * Warum eine Kette zerfaellt, je Nebenkomponente: „lose" = ein Glied ohne io-Eingang oder -Ausgang
 * (R-31-Klasse), „fehlendes Glied" = Hauptteil und Ast haengen nur ueber eine FUNC AUSSERHALB der
 * Kette zusammen, „Sack" = parallele Aeste an gemeinsamer Quelle. Dazu je FUNC die Zahl der Ketten.
 */
function diagnose(g) {
  const type = new Map(g.elements.map((e) => [e.id, e.type]));
  const prod = new Map(), cons = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const t of g.traces) {
    if (t.type !== 'io') continue;
    if (type.get(t.target) === 'FLOW') push(prod, t.target, t.source); // FUNC|ACTOR -io-> FLOW
    if (type.get(t.source) === 'FLOW') push(cons, t.source, t.target); // FLOW -io-> FUNC|ACTOR
  }
  const wiredIn = (f) => [...cons.values()].some((cs) => cs.includes(f));
  const wiredOut = (f) => [...prod.values()].some((ps) => ps.includes(f));
  const succ = (a) => { const r = new Set(); for (const [fl, ps] of prod) if (ps.includes(a)) for (const c of cons.get(fl) ?? []) r.add(c); return r; };
  const share = new Map();
  const byChain = new Map();
  for (const fc of g.elements.filter((e) => e.type === 'FCHAIN')) {
    const m = new Set(g.traces.filter((t) => t.source === fc.id && t.type === 'compose' && type.get(t.target) === 'FUNC').map((t) => t.target));
    for (const f of m) share.set(f, (share.get(f) ?? 0) + 1);
    // Zusammenhang ungerichtet ueber die Kettenkanten
    const und = new Map([...m].map((f) => [f, new Set()]));
    for (const a of m) for (const b of succ(a)) if (m.has(b) && a !== b) { und.get(a).add(b); und.get(b).add(a); }
    const seen = new Set(), comps = [];
    for (const f of m) if (!seen.has(f)) { const c = [f]; seen.add(f); for (let i = 0; i < c.length; i++) for (const n of und.get(c[i])) if (!seen.has(n)) { seen.add(n); c.push(n); } comps.push(c); }
    const side = comps.sort((a, b) => b.length - a.length).slice(1);
    const isLoose = (c) => c.some((f) => !wiredIn(f) || !wiredOut(f));
    const main = new Set(comps[0] ?? []);
    const reaches = (from, to) => [...from].some((a) => [...succ(a)].some((x) => !m.has(x) && [...succ(x)].some((b) => to.has(b))));
    const branches = side.filter((c) => !isLoose(c));
    const missingLink = branches.filter((c) => reaches(main, new Set(c)) || reaches(new Set(c), main)).length;
    byChain.set(fc.id, { funcs: m.size, components: comps.length, loose: side.filter(isLoose).length, missingLink, commonSource: branches.length - missingLink });
  }
  const reqsOf = new Map(); // Element → REQs, die es per satisfy erfuellt (Rueckwaerts-Blast-Radius)
  for (const t of g.traces) if (t.type === 'satisfy' && type.get(t.target) === 'REQ') push(reqsOf, t.source, t.target);
  return { byChain, share, reqsOf };
}

function measureGraph(g) {
  const km = chainMetrics(g);
  const d = diagnose(g);
  const rows = km.chains.map((c) => ({ ...c, ...d.byChain.get(c.chainId) }));
  // Blast-Radius je FUNC: vorwaerts = Ketten durch sie, rueckwaerts = REQs per satisfy
  const funcs = g.elements.filter((e) => e.type === 'FUNC');
  const fwd = funcs.map((f) => d.share.get(f.id) ?? 0), bwd = funcs.map((f) => (d.reqsOf.get(f.id) ?? []).length);
  const attrHits = new Set();
  for (const e of g.elements) for (const k of Object.keys(e)) if (/sync|scal|volat|^source$|budget|complexity/i.test(k)) attrHits.add(`${e.type}.${k}`);
  return { rows, measurability: km.measurability, blast: { maxFwd: Math.max(0, ...fwd), maxBwd: Math.max(0, ...bwd), funcs: funcs.length }, attrHits: [...attrHits], r6: metrics(g, { layer: 'arch' }) };
}

// ── Positivkontrolle + Gegenprobe: „Zahlung auslösen" (Konzept, bekannte Antwort) ─────────
/** Der Graph der Referenzkette; `withLoop` haengt Rueckkopplung und Ast an (Gegenprobe). */
export function referenzkette(withLoop) {
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
  return { elements: el.map((e) => ({ name: e.id, description: '', ...e })), traces: tr };
}

/** Beide Kontrollen gegen `chainMetrics`: die bekannte Antwort, und dass sie umschlaegt. */
export function kontrolle() {
  const zeile = (withLoop) => chainMetrics(referenzkette(withLoop)).chains.find((c) => c.chainId === 'FCHAIN-zahlung');
  const pos = zeile(false), neg = zeile(true);
  return {
    pos, neg,
    posOk: pos.measurable && pos.length === 6 && pos.branching === 1 && pos.moduleBoundaries === 2 && pos.feedbackLoops === 0 && pos.sharedFuncs === 1 && pos.bottlenecks === 1,
    negOk: neg.measurable && neg.feedbackLoops === 1 && neg.branching === 2 && neg.length === 5, // deckung↔betrug kollabiert zu einem Schritt
  };
}

// ── Korpus ───────────────────────────────────────────────────────────────────────────
/** Je Graph des Korpus die Quote aus `chainMetrics` und die Auswertung ueber die bewertbaren Ketten. */
export function messeKorpus() {
  const report = [];
  for (const [id, path] of CORPUS) {
    if (!existsSync(path)) { report.push({ id, skipped: 'Datei fehlt' }); continue; }
    const r = measureGraph(JSON.parse(readFileSync(path, 'utf8')));
    if (!r.rows.length) { report.push({ id, skipped: 'keine FCHAIN', flowEfficiency: r.r6.flowEfficiency }); continue; }
    const meas = r.rows.filter((x) => x.measurable);
    const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
    report.push({
      id, chains: r.measurability.chains, measurable: r.measurability.measurable, share: r.measurability.ratio,
      meanLength: mean(meas.map((x) => x.length)), maxLength: Math.max(0, ...meas.map((x) => x.length)),
      maxBranching: Math.max(0, ...meas.map((x) => x.branching)), meanBoundaries: mean(meas.map((x) => x.moduleBoundaries)),
      withLoops: meas.filter((x) => x.feedbackLoops > 0).length, bottlenecks: meas.reduce((s, x) => s + x.bottlenecks, 0),
      blast: r.blast, attrHits: r.attrHits, flowEfficiency: r.r6.flowEfficiency, rows: r.rows,
    });
  }
  return report;
}

if (process.argv[1]?.endsWith('spike-kettenkennzahlen.mjs')) {
  const { pos, neg, posOk, negOk } = kontrolle();
  const report = messeKorpus();
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
    console.log([x.id, x.chains, x.measurable, f(x.share, 2), f(x.meanLength), x.maxLength, x.maxBranching, f(x.meanBoundaries), x.withLoops, x.bottlenecks, x.blast.maxFwd, x.blast.maxBwd, f(x.flowEfficiency, 2)].join('\t'));
  }
  console.log(`\nK-MESSBAR: ${report.filter((x) => !x.skipped && x.share >= 0.8).length}/${report.filter((x) => !x.skipped).length} Graphen ≥ 0,8`);
  console.log(`K-INFO: r(Ølänge, flowEfficiency) = ${f(r, 2)} über n=${ok.length}`);
  console.log(`Realisierungsattribute (sync/scal/volat/source/budget) im Korpus: ${[...new Set(report.flatMap((x) => x.attrHits ?? []))].join(', ') || 'keine'}`);
  // Der Grund kommt von `chainMetrics`; die Zerfallsursache dahinter ist die Diagnose dieses Spikes.
  const why = (x) => [...x.reasons, x.loose && `${x.loose} lose Nebenkomponente`, x.missingLink && `${x.missingLink} fehlendes Glied`, x.commonSource && `${x.commonSource} Sack`].filter(Boolean).join(', ');
  console.log('\nNicht messbare Ketten:');
  for (const x of report.filter((y) => !y.skipped)) for (const row of x.rows.filter((y) => !y.measurable)) console.log(`  ${x.id}\t${row.chainId}\t${why(row)}`);
  const all = report.filter((y) => !y.skipped).flatMap((y) => y.rows);
  const cnt = (p) => all.filter(p).length;
  const grund = (r) => cnt((x) => !x.measurable && x.reasons.includes(r));
  console.log(`\nGründe über ${all.length} Ketten (Mehrfachnennung): FC-05 ${grund('FC-05')} · loose-member ${grund('loose-member')} · no-entry ${grund('no-entry')} · no-exit ${grund('no-exit')} · empty ${grund('empty')}`);
  console.log(`Zerfallsursachen (Diagnose): lose Nebenkomponente ${cnt((x) => x.loose)} · fehlendes Glied ${cnt((x) => x.missingLink)} · Sack (parallele Äste an gemeinsamer Quelle) ${cnt((x) => x.commonSource)}`);
}
