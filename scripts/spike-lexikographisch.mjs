#!/usr/bin/env node
/**
 * CR-SM-287 §6 — der Go/No-Go VOR der Implementierung.
 *
 * Die Frage: ordnet ein lexikographischer Vergleich ueber den theoriegestuetzten ℝ⁵
 * (RD-04 Breite > BW-02 Randbreite > CR-01 Kopplung > MT-01 Instabilitaet > MT-02 Kohaesion)
 * den bekannten Pruefsatz richtig — dort wo der ℝ⁶ aus `metrics()` dreimal widerlegt wurde?
 *
 * Der Vergleich ist NICHT gewichtet und NICHT summiert. Zwei Zustaende werden auf der ersten
 * Stufe verglichen, auf der sie sich unterscheiden; erst bei Gleichstand entscheidet die
 * naechste. Das ist Simons `satisficing`: gutes Design liegt INNERHALB aller Budgets, es
 * maximiert keine Guetefunktion.
 *
 * Vier Ablesungen nebeneinander, weil CR-SM-287 §7.2 offen laesst, welche stimmt:
 *   masse      — SIGMA max(0, value - threshold) je Stufe (L1). Die Zahlen stehen seit CR-SM-288
 *                am Befund (`context.value`/`context.threshold`), NICHT im Meldungstext.
 *   masse/n    — dieselbe Masse durch die Grundgesamtheit der Regel (`domain`, CR-SM-235).
 *   masse-max  — MAX max(0, value - threshold) je Stufe (L-unendlich): der SCHLIMMSTE Verstoss,
 *                nicht ihre Summe. CR-SM-287 §5.1 sagt woertlich "den schlimmsten Verstoss
 *                zuerst", §5.2 dann "summiert ueber alle Blackboxes" — das sind zwei
 *                verschiedene Masse, und der Unterschied entscheidet ueber P5/P6. Satisficing
 *                heisst "jeder Container INNERHALB seines Budgets"; der Abstand dazu ist der
 *                schlimmste Ueberschuss, nicht ihre Summe.
 *   masse/fund — Sigma-Masse durch die ZAHL der Befunde: der durchschnittliche Ueberschuss je
 *                betroffener Blackbox. NACHTRAEGLICH hinzugefuegt, nachdem Sigma und max je eine
 *                andere Haelfte des Pruefsatzes verfehlt haben — das ist offengelegt und nicht
 *                weggelassen. Ihre Begruendung stammt aus CR-SM-287 §2.3 selbst: der Zug
 *                306 -> 9 "hat das Problem nicht geloest, sondern in zehn lokale, benennbare
 *                Fragen verwandelt". Genau das misst die Schuld JE Container. Sie ist damit
 *                post-hoc und braucht ein Paar, das nicht zu ihrer Konstruktion beigetragen hat,
 *                bevor irgendjemand sie glaubt.
 *   zahl       — Zahl der `warning`-Befunde je Stufe (die einfachere Ablesung, Klasse CR-SM-242).
 *   zahl/n     — dieselbe Zahl durch die Grundgesamtheit.
 * Die Normierung steht mit im Rennen, weil die absoluten Vergleiche Graphen SEHR
 * verschiedener Groesse gegeneinanderstellen (bok 9 Blackboxes, moneyflow 1229 Elemente) —
 * eine rohe Summe bestraft dort Groesse statt Unordnung.
 *
 * WOHER DIE ZUSTAENDE KOMMEN — das ist die Haelfte, die zaehlt:
 *   P1-P4  aus der git-History des graphcode-Selbstmodells (dieselben Refs wie
 *          `known-answer-set.mjs`), gehoben mit `toEvaluableGraph` wie am Gate (CR-SM-284).
 *   P5     aus dem RIG, nicht aus der Datei: `rig/moneyflow-struktur/driver.mjs --structure
 *          --apply --dump <dir>` schreibt den Graphen, wie das Gate ihn nach dem Zug fuehrt.
 *          Ohne `--rig <dir>` faellt dieses Paar aus und wird als FEHLT ausgewiesen, nicht
 *          stillschweigend uebersprungen.
 *   absolut vier Familiengraphen, Reihenfolge nach Urteil: bok > gve > graphcode > moneyflow.
 *   degenerate die vier Zerstoerungen aus bok (CR-SM-281 §2.2 / spike-blackbox-regeln.mjs),
 *          zeichengleich uebernommen. Jede MUSS unter bok landen.
 *
 * Aufruf aus dem graphcode-Repo:
 *   node scripts/spike-lexikographisch.mjs [--rig <dump-verzeichnis>]
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateAllRules, DEFAULT_METRIC_POLICY, toEvaluableGraph, ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';

/** Die Stufen, in der Reihenfolge aus CR-SM-287 §5.1. Sie steht VOR dem Lauf fest. */
const STUFEN = [
  ['RD-04', 'Breite      (Simon)'],
  ['BW-02', 'Randbreite  (Parnas)'],
  ['CR-01', 'Kopplung    (Baldwin/Clark)'],
  ['MT-01', 'Instabilitaet (Martin)'],
  ['MT-02', 'Kohaesion   (LCOM4)'],
];
const DOMAIN = Object.fromEntries(ALL_RULE_DEFS.map((d) => [d.id, d.domain]));

const RIG = (() => { const i = process.argv.indexOf('--rig'); return i >= 0 ? process.argv[i + 1] : null; })();

const lift = (raw) => toEvaluableGraph({ elements: raw.elements, traces: raw.traces });
const atRef = (ref) => lift(JSON.parse(execFileSync('git', ['show', `${ref}:docs/graph/graphcode.graph.json`], { encoding: 'utf8', maxBuffer: 64 << 20 })));
const atFile = (p) => lift(JSON.parse(readFileSync(p, 'utf8')));

/**
 * Das Profil eines Graphen: je Stufe die vier Ablesungen. Die Zahlen kommen AUS DEM REGELSTROM —
 * derselbe `evaluateAllRules`, den das Gate ruft. Kein zweiter Weg zur Zahl.
 */
function profil(g) {
  const v = evaluateAllRules(g, DEFAULT_METRIC_POLICY);
  const count = Object.fromEntries(g.elements.reduce((m, e) => m.set(e.type, (m.get(e.type) ?? 0) + 1), new Map()));
  const out = { masse: [], 'masse/n': [], 'masse-max': [], 'masse/fund': [], zahl: [], 'zahl/n': [] };
  for (const [rule] of STUFEN) {
    const vs = v.filter((x) => x.rule_id === rule);
    const einzeln = vs.map((x) => Math.max(0, (x.context?.value ?? 0) - (x.context?.threshold ?? 0)));
    const masse = einzeln.reduce((s, x) => s + x, 0);
    const maxMasse = einzeln.length ? Math.max(...einzeln) : 0;
    const zahl = vs.filter((x) => x.severity === 'warning').length;
    // Grundgesamtheit = Sigma Elemente der `domain` (CR-SM-235) — dieselbe Definition wie der
    // readiness-Nenner. `|| 1` nur, damit ein Graph ohne diesen Typ nicht durch 0 teilt; er hat
    // dann ohnehin die Masse 0.
    const n = (DOMAIN[rule] ?? []).reduce((s, t) => s + (count[t] ?? 0), 0) || 1;
    out.masse.push(masse); out['masse/n'].push(masse / n); out['masse-max'].push(maxMasse);
    out['masse/fund'].push(einzeln.length ? masse / einzeln.length : 0);
    out.zahl.push(zahl); out['zahl/n'].push(zahl / n);
  }
  return out;
}

const EPS = 1e-9;
/** Lexikographisch: <0 wenn a besser (kleiner auf der ersten Stufe, die sich unterscheidet). */
function lex(a, b) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > EPS) return a[i] < b[i] ? -1 : 1;
  return 0;
}
/** Auf welcher Stufe die Entscheidung fiel — die Begruendung, nicht nur das Urteil. */
function entscheider(a, b) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > EPS) return STUFEN[i][0];
  return '—';
}
const ABLESUNGEN = ['masse', 'masse/n', 'masse-max', 'masse/fund', 'zahl', 'zahl/n'];
const fmt = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(3));

// --- Der ℝ⁶ zum Vergleich (die widerlegte Steuerung), damit die Tabelle selbsttragend ist ---
const W = JSON.parse(readFileSync('.graphcode/target-profile.json', 'utf8')).weights;
const r6 = (g) => { const m = metrics(g, { layer: 'arch' }); return METRIC_DIMENSIONS.map((d) => m[d]); };
const r6dot = (v) => v.reduce((a, x, i) => a + x * (W[METRIC_DIMENSIONS[i]] ?? 0), 0);

console.log('# CR-SM-287 Go/No-Go — lexikographisch ueber den ℝ⁵ aus dem Regelstrom\n');
console.log(`Stufenreihenfolge (steht VOR dem Lauf fest): ${STUFEN.map(([r]) => r).join(' > ')}\n`);

// ---------------------------------------------------------------------------
// 1. Paare — der rechte Zustand ist der bekannt bessere
// ---------------------------------------------------------------------------
const PAARE = [
  ['P1 Ebene einziehen (CR-GC-459: 10 Wurzeln -> 4)', () => atRef('4cb5a3b^'), () => atRef('4cb5a3b')],
  ['P2 Messung in den Kern (CR-GC-468-472)', () => atRef('c826ff2'), () => atRef('ae4b57d')],
  ['P3 measure als Sub-MOD (CR-GC-473)', () => atRef('ae4b57d'), () => atRef('f2f3b62')],
  ['P4 Graph-State hat einen Schreiber (CR-GC-481)', () => atRef('e197995'), () => atRef('b8e17f3')],
];
if (RIG && existsSync(join(RIG, '00-baseline.json')) && existsSync(join(RIG, '01-struktur.json'))) {
  PAARE.push(['P5/P6 moneyflow strukturiert (306 -> 9, `zeigen` geteilt) — AUS DEM RIG',
    () => atFile(join(RIG, '00-baseline.json')), () => atFile(join(RIG, '01-struktur.json'))]);
}

console.log('## 1. Paare — rankt der lexikographische Vergleich den bekannt besseren Zustand hoeher?\n');
console.log('| Paar | ' + ABLESUNGEN.map((a) => a).join(' | ') + ' | entscheidende Stufe (masse) | ℝ⁶ Δ·w |');
console.log('|---|' + ABLESUNGEN.map(() => '---').join('|') + '|---|---:|');
const paarErgebnis = Object.fromEntries(ABLESUNGEN.map((a) => [a, []]));
for (const [label, ga, gb] of PAARE) {
  const A = ga(), B = gb();
  const pa = profil(A), pb = profil(B);
  const zellen = ABLESUNGEN.map((k) => {
    const c = lex(pb[k], pa[k]);            // b besser => c < 0
    paarErgebnis[k].push(c < 0);
    return c < 0 ? '✓ ja' : c > 0 ? '✗ nein' : '– blind';
  });
  const dw = r6dot(r6(B)) - r6dot(r6(A));
  console.log(`| ${label} | ${zellen.join(' | ')} | ${entscheider(pb.masse, pa.masse)} | ${(dw >= 0 ? '+' : '') + dw.toFixed(3)} ${dw > 1e-6 ? '✓' : dw < -1e-6 ? '✗' : '–'} |`);
  console.log(`|   ↳ Sigma \`[${pa.masse.map(fmt).join(', ')}]\` -> \`[${pb.masse.map(fmt).join(', ')}]\` · max \`[${pa['masse-max'].map(fmt).join(', ')}]\` -> \`[${pb['masse-max'].map(fmt).join(', ')}]\` | | | | | | | |`);
}
if (!RIG) console.log('\n> **P5/P6 FEHLT** — ohne `--rig <dir>` nicht gemessen. Lauf:\n> `node rig/moneyflow-struktur/driver.mjs --structure --apply --dump <dir>`\n');

// ---------------------------------------------------------------------------
// 2. Absolut
// ---------------------------------------------------------------------------
const ABS = [
  ['bok', '/Users/andreas/Developer/dev/bok/docs/graph/bok.graph.json'],
  ['graph-view-edit', '/Users/andreas/Developer/dev/graph-view-edit/docs/graph/graph-view-edit.graph.json'],
  ['graphcode', 'docs/graph/graphcode.graph.json'],
  ['moneyflow', '/Users/andreas/Developer/dev/moneyflow/docs/graph/moneyflow.graph.json'],
];
const URTEIL = ABS.map(([n]) => n);   // die Reihenfolge nach Urteil, bester zuerst

console.log('\n## 2. Absolut — Urteil: bok > graph-view-edit > graphcode > moneyflow\n');
const absProfile = ABS.map(([n, p]) => [n, profil(atFile(p)), r6dot(r6(atFile(p)))]);
console.log('| Graph | ' + STUFEN.map(([r]) => r).join(' | ') + ' (Sigma / max) | ℝ⁶ w·m |');
console.log('|---|' + STUFEN.map(() => '---:').join('|') + '|---:|');
for (const [n, p, w] of absProfile) console.log(`| ${n} | ${p.masse.map((x, i) => `${fmt(x)} / ${fmt(p['masse-max'][i])}`).join(' | ')} | ${w.toFixed(3)} |`);

console.log('\n### Rangfolge je Ablesung (lexikographisch, bester zuerst)\n');
console.log('| Ablesung | Rangfolge | trifft das Urteil? |');
console.log('|---|---|---|');
const absErgebnis = {};
for (const k of ABLESUNGEN) {
  const sorted = absProfile.slice().sort((a, b) => lex(a[1][k], b[1][k])).map(([n]) => n);
  absErgebnis[k] = JSON.stringify(sorted) === JSON.stringify(URTEIL);
  console.log(`| ${k} | ${sorted.join(' > ')} | ${absErgebnis[k] ? '✓ ja' : '✗ nein'} |`);
}
const r6sorted = absProfile.slice().sort((a, b) => b[2] - a[2]).map(([n]) => n);
console.log(`| _ℝ⁶ w·m (zum Vergleich)_ | ${r6sorted.join(' > ')} | ${JSON.stringify(r6sorted) === JSON.stringify(URTEIL) ? '✓ ja' : '✗ nein'} |`);

// ---------------------------------------------------------------------------
// 3. Die vier Degenerate aus bok — jedes MUSS unter bok landen
// ---------------------------------------------------------------------------
const bokRaw = JSON.parse(readFileSync('/Users/andreas/Developer/dev/bok/docs/graph/bok.graph.json', 'utf8'));
const bok = lift(bokRaw);
const clone = (g) => ({ elements: g.elements.map((e) => ({ ...e })), traces: g.traces.map((x) => ({ ...x })) });
const tm = (g) => new Map(g.elements.map((e) => [e.id, e.type]));
const nest = (bt) => (x) => (x.type === 'compose' && ((bt.get(x.source) === 'FUNC' && bt.get(x.target) === 'FUNC') || (bt.get(x.source) === 'MOD' && bt.get(x.target) === 'MOD'))) || x.type === 'allocate';
function allInOne(b) { const g = clone(b), bt = tm(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); g.elements = g.elements.filter((e) => e.type !== 'MOD'); g.elements.push({ id: 'MOD-mono', type: 'MOD', name: 'Monolith' }); g.traces = g.traces.filter((x) => !nest(bt)(x) && bt.get(x.source) !== 'MOD' && bt.get(x.target) !== 'MOD'); for (const i of f) g.traces.push({ source: i, target: 'MOD-mono', type: 'allocate' }); return g; }
function onePer(b) { const g = clone(b), bt = tm(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); g.elements = g.elements.filter((e) => e.type !== 'MOD'); g.traces = g.traces.filter((x) => !nest(bt)(x) && bt.get(x.source) !== 'MOD' && bt.get(x.target) !== 'MOD'); for (const i of f) { g.elements.push({ id: 'MOD-' + i, type: 'MOD', name: i }); g.traces.push({ source: i, target: 'MOD-' + i, type: 'allocate' }); } return g; }
function flat(b) { const g = clone(b), bt = tm(b); g.traces = g.traces.filter((x) => !(x.type === 'compose' && ((bt.get(x.source) === 'FUNC' && bt.get(x.target) === 'FUNC') || (bt.get(x.source) === 'MOD' && bt.get(x.target) === 'MOD')))); return g; }
function wired(b) { const g = clone(b); const f = g.elements.filter((e) => e.type === 'FUNC').map((e) => e.id); let k = 0; for (const x of f) for (const y of f) { if (x >= y) continue; const fl = 'FLOW-x' + k++; g.elements.push({ id: fl, type: 'FLOW', name: fl }); g.traces.push({ source: x, target: fl, type: 'io' }, { source: fl, target: y, type: 'io' }); } return g; }

const DEG = [['alles-in-ein-MOD', allInOne(bok)], ['jede-FUNC-ein-MOD', onePer(bok)], ['flach-ohne-Ebene', flat(bok)], ['maximal-verkantet', wired(bok)]];
const pBok = profil(bok);
console.log('\n## 3. Die vier Degenerate aus bok — jedes MUSS unter bok landen\n');
console.log('| Zustand | ' + STUFEN.map(([r]) => r).join(' | ') + ' (Sigma / max) | ' + ABLESUNGEN.join(' | ') + ' |');
console.log('|---|' + STUFEN.map(() => '---:').join('|') + '|' + ABLESUNGEN.map(() => '---').join('|') + '|');
console.log(`| **bok (Original)** | ${pBok.masse.map((x, i) => `${fmt(x)} / ${fmt(pBok['masse-max'][i])}`).join(' | ')} | ${ABLESUNGEN.map(() => '–').join(' | ')} |`);
const degErgebnis = Object.fromEntries(ABLESUNGEN.map((a) => [a, []]));
for (const [nm, g] of DEG) {
  const p = profil(g);
  const zellen = ABLESUNGEN.map((k) => { const ok = lex(p[k], pBok[k]) > 0; degErgebnis[k].push(ok); return ok ? '✓ unter bok' : lex(p[k], pBok[k]) === 0 ? '– gleich' : '✗ UEBER bok'; });
  console.log(`| ${nm} | ${p.masse.map((x, i) => `${fmt(x)} / ${fmt(p['masse-max'][i])}`).join(' | ')} | ${zellen.join(' | ')} |`);
}

// ---------------------------------------------------------------------------
// 4. Das Urteil
// ---------------------------------------------------------------------------
console.log('\n## 4. Go/No-Go je Ablesung\n');
console.log('| Ablesung | Paare | absolut | Degenerate | Urteil |');
console.log('|---|---|---|---|---|');
for (const k of ABLESUNGEN) {
  const pa = paarErgebnis[k], de = degErgebnis[k];
  const paOk = pa.every(Boolean), deOk = de.every(Boolean), abOk = absErgebnis[k];
  console.log(`| ${k} | ${pa.filter(Boolean).length}/${pa.length} | ${abOk ? '✓' : '✗'} | ${de.filter(Boolean).length}/${de.length} | ${paOk && abOk && deOk ? '**GO**' : 'NO-GO'} |`);
}
console.log('\n_Die Stufenreihenfolge wurde nach dem Lauf NICHT umsortiert (CR-SM-287 §6). Faellt ein Kriterium, ist das das Ergebnis._');
