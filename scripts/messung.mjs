#!/usr/bin/env node
/**
 * messung.mjs — `npm run messung`: der Messstand je Release (CR-GC-679, CR-GC-948).
 *
 * Je Zeile (S1-Test oder Groesse aus `docs/messung/kennzahlen.md`) Wert, Vorwert, seit wann unveraendert,
 * Urteil, Datum, Stempel; dazu die Tabelle „ein Stand je Woche" aus dem Verlauf. Geschrieben werden
 * `docs/messung/stand.md` und daneben `stand.json`, aus der der naechste Lauf den Vorwert liest.
 * Den Takt gibt `npm version` vor: das Skript `version` in `package.json` ruft diesen Lauf (`aise release prepare`).
 *
 * Urteile: bestanden · nicht bestanden · ohne Schwelle (die Groesse nennt bewusst keine).
 * Jede Zeile ist erhoben, sonst bricht der Lauf ab: ein Adapter, der wirft, oder eine Quelle ohne Wert
 * lassen keine Zeile mit verschlucktem Fehler zurueck.
 *
 * Aufruf: npm run messung   (braucht ein gebautes dist; lokal, kein Modell, ~1 min)
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leseSchlupfZeilen, schlupfFreieFolge, SCHLUPF_SCHWELLE } from '../dist/projections/test-schlupf.js';
import {
  parseStand, mitVorwert, alsStand, wochenTabelle, renderStand as renderStandDatei,
  wertSteuer, wertTests, wertKetten, wertSchlupf, wertZusage, wertDauer, wertLoeschung,
} from './messung-stand.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STAND = join(REPO, 'docs', 'messung', 'stand.md');
export const STAND_JSON = join(REPO, 'docs', 'messung', 'stand.json');

/** Die S1-Test-IDs aus Leitlinie §9.4 — `tests/messung.test.ts` haelt die Liste gleich (ohne `ENTFALLEN`). */
export const S1 = ['T-V2', 'T-V4', 'T-M3', 'T-M4', 'T-E1', 'T-E2', 'T-E8', 'T-H2'];

/**
 * S1-Tests der Leitlinie, die dieser Lauf nicht fuehrt (CR-GC-948): T-V1 (die Quelle liegt in graphanalyze und
 * gibt nur Prosa aus), T-O4 und T-O6 (einmalige Versuche, ihr Ergebnis steht in ihren CRs).
 */
export const ENTFALLEN = ['T-V1', 'T-O4', 'T-O6'];

/**
 * Zeilen im Messstand, die die Leitlinie §9.4 (noch) nicht in der S1-Zeile fuehrt: T-O1 (CR-GC-767) und
 * die Groessen aus `kennzahlen.md`, die kein S1-Test sind (CR-GC-948).
 */
export const WEITERE = ['T-O1', 'G3', 'G4', 'G5', 'G6', 'G7', 'G9'];

/** Reihenfolge im Messstand = Reihenfolge der Groessen in `kennzahlen.md`. */
export const ZEILEN = ['T-M3', 'G3', 'G4', 'G5', 'G6', 'G7', 'T-V4', 'G9', 'T-E8', 'T-E1', 'T-V2', 'T-M4', 'T-E2', 'T-H2', 'T-O1'];

/** Nummer der Groesse in `kennzahlen.md` je Zeile; „—" = ein Test ohne Groesse. */
const NR = { 'T-M3': '1, 2', G3: '3', G4: '4', G5: '5', G6: '6', G7: '7', 'T-V4': '8', G9: '9', 'T-E8': '10', 'T-E1': '12' };

// ---------------------------------------------------------------------------
// Reine Teile (getestet)
// ---------------------------------------------------------------------------

/** T-H2: Regel-IDs der Matrix gegen den Katalog — beide Richtungen. */
export function regelMatrixAktuell(matrixMd, katalogIds) {
  const inMatrix = new Set([...matrixMd.matchAll(/^\| ([A-Z]+-[A-Z]?\d+[A-Z]?) \|/gm)].map((m) => m[1]));
  const katalog = new Set(katalogIds);
  return {
    fehlt: [...katalog].filter((id) => !inMatrix.has(id)).sort(),
    unbekannt: [...inMatrix].filter((id) => !katalog.has(id)).sort(),
  };
}

export function urteilT_H2({ fehlt, unbekannt }) {
  const ok = fehlt.length === 0 && unbekannt.length === 0;
  return {
    wert: ok ? 'Matrix = Katalog' : [fehlt.length && `fehlt ${fehlt.join(', ')}`, unbekannt.length && `unbekannt ${unbekannt.join(', ')}`].filter(Boolean).join('; '),
    urteil: ok ? 'bestanden' : 'nicht bestanden',
  };
}

/** T-E8: Median und Groesse aus der Konsolenzeile EINES Messpunkts des Perf-Spikes (Label, z. B.
 *  `live-size`); ohne Zeile kein Wert. Der Spike druckt drei Punkte — die erste Fundstelle zu nehmen
 *  hiesse, die Reihenfolge der Tests zu messen. */
export function medianAusLog(text, label) {
  const m = text.match(new RegExp(`\\[SPIKE ${label}, (\\d+) nodes\\] median total=([\\d.]+)ms`));
  return m ? { knoten: Number(m[1]), ms: Number(m[2]) } : null;
}

/**
 * T-O1 (CR-GC-767): Referenzkette reproduziert UND >= 90 % der Ketten bewertbar. Die Zahlen kommen
 * aus `chainMetrics` (contracts); hier steht nur das Urteil ueber sie. `nullKennzahlen` nennt, was
 * die Funktion in dieser Stufe nicht rechnet — sonst laese sich „reproduziert" wie „alle acht".
 */
export function urteilT_O1({ posOk, negOk, chains, measurable, graphen, nullKennzahlen }) {
  const referenz = posOk && negOk;
  const quote = chains > 0 ? measurable / chains : null;
  return {
    wert: [
      `Referenzkette ${referenz ? 'reproduziert' : 'NICHT reproduziert'}`,
      quote === null ? 'keine Kette im Korpus' : `${measurable} von ${chains} Ketten bewertbar (${Math.round(quote * 100)} %, ${graphen} Graphen)`,
      nullKennzahlen.length ? `nicht gerechnet: ${nullKennzahlen.join(', ')}` : null,
    ].filter(Boolean).join('; '),
    urteil: referenz && quote !== null && quote >= 0.9 ? 'bestanden' : 'nicht bestanden',
  };
}

/** Die Stufen, in denen die Befunde des Plans stehen — sie wachsen mit der Arbeit am Modell und zaehlen nicht ins Urteil. */
const PLAN = 'Plan';

/**
 * T-M3 (CR-GC-946): Fehler bleiben 0; eine erreichte Marke faellt nicht zurueck. Die Befunde je Stufe
 * ohne Plan stehen als Wert da — „abgenommen" laesst sich nicht messen, deshalb urteilt die Zeile nur
 * ueber Fehler und Marken. `staende` ist der Verlauf von `graph_readiness({verlauf})`, alt nach neu.
 */
export function urteilT_M3(staende) {
  if (staende.length === 0) return { wert: 'keine committeten Staende', urteil: 'nicht bestanden' };
  const maxFehler = Math.max(...staende.map((s) => s.errors));
  const zurueck = [];
  staende.forEach((s, i) => {
    const vor = i > 0 ? staende[i - 1] : null;
    for (const m of s.marks) if (vor && vor.marks.find((x) => x.id === m.id)?.reached && !m.reached) zurueck.push(`${m.id} bei ${s.short}`);
  });
  const erste = staende[0];
  const letzte = staende.at(-1);
  const marken = (s) => s.marks.filter((m) => m.reached).map((m) => m.id).join(' ') || 'keine';
  const jeStufe = (s) => s.stages.filter((x) => x.name !== PLAN);
  const ohnePlan = (s) => jeStufe(s).reduce((n, x) => n + x.findings, 0);
  const verlauf = letzte.stages
    .filter((x) => x.name !== PLAN)
    .map((x) => `${x.name} ${erste.stages.find((y) => y.name === x.name)?.findings ?? 0}→${x.findings}`)
    .filter((t) => !/ 0→0$/.test(t))
    .join(', ');
  const plan = (s) => s.stages.find((x) => x.name === PLAN)?.findings ?? 0;
  return {
    wert: [
      `${staende.length} Stände ${erste.short}..${letzte.short}`,
      `Fehler höchstens ${maxFehler}`,
      `Marken ${marken(erste)} → ${marken(letzte)}${zurueck.length ? `; zurückgefallen: ${zurueck.join(', ')}` : ''}`,
      `Befunde ohne Plan ${ohnePlan(erste)} → ${ohnePlan(letzte)} (${verlauf}); Plan ${plan(erste)} → ${plan(letzte)}`,
    ].join('; '),
    urteil: maxFehler === 0 && zurueck.length === 0 ? 'bestanden' : 'nicht bestanden',
  };
}

/** Die Datei aus den Zeilen mit Vorwert; wirft bei fehlender Zeile oder fehlendem Stempel. */
export function renderStand(zeilen, stempel, wochen = []) {
  return renderStandDatei(zeilen, stempel, wochen, ZEILEN);
}

// ---------------------------------------------------------------------------
// Erhebung (laeuft im Aufruf)
// ---------------------------------------------------------------------------

function vitest(datei, json) {
  const args = ['vitest', 'run', datei];
  if (json) args.push('--reporter=json', `--outputFile=${json}`);
  const r = spawnSync('npx', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` };
}

async function erhebe() {
  const dist = await import(join(REPO, 'dist', 'index.js'));
  const { codeVerdict } = await import(join(REPO, 'scripts', 'kongruenz.mjs'));
  const { randbreiten } = await import(join(REPO, 'scripts', 'randbreiten.mjs'));
  const { messeGrenzmenge } = await import(join(REPO, 'scripts', 'grenzmenge.mjs'));
  const se = await import('@sigloch/contracts/se');
  const datum = new Date().toISOString().slice(0, 10);

  const m = await dist.openMeasured({ graph: join(REPO, 'docs', 'graph', 'graphcode.graph.json'), repoRoot: REPO, systemId: 'graphcode' });
  // Ohne den lokalen Pfad: die Datei ist committet, der Stempel soll auf jeder Maschine gleich lesen.
  const stempel = dist.stampLine(m.provenance).replace(`${REPO}/`, '');
  const zeilen = [];
  const zeile = (id, kriterium, wert, urteil, extra = {}) => zeilen.push({ id, nr: NR[id] ?? '—', kriterium, wert, urteil, datum, stempel, ...extra });
  try {
    // T-V4: Kongruenz + Bindung aus der Readiness, Grenzmenge aus dem Skript — alle drei Teile.
    const r = await dist.bindToolsToHarness(m.harness).graph_readiness.handler({});
    const g = m.graph();
    const v = codeVerdict(r, {
      elements: g.nodes.map((n) => ({ id: n.uid, type: n.type, attributes: n.attributes ?? {} })),
      traces: g.edges.map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })),
    });
    const gm = messeGrenzmenge(REPO);
    const deckung = gm.r.map((x) => `${x.typ} ${x.da}/${x.pflicht}`).join(', ');
    const voll = gm.r.every((x) => x.da === x.pflicht);
    zeile('T-V4', 'Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert',
      `${v.verdict}, Bindung ${v.binding.bound}/${v.binding.leafFuncs} (${v.binding.pct} %), Grenzmenge ${deckung}`,
      v.verdict === 'kongruent' && v.binding.pct === 100 && voll ? 'bestanden' : 'nicht bestanden');
  } finally {
    await m.close();
  }

  // T-V2: der Live-Graph von graphcode.
  const rb = randbreiten().find((z) => z.name === 'graphcode (live)');
  zeile('T-V2', '0 Befunde über Schwelle (BW-02: > 5 SCHEMA)', `BW-02 ${rb.bwUeber[5]} bei ${rb.wb} Whiteboxes`,
    rb.bwUeber[5] === 0 ? 'bestanden' : 'nicht bestanden');

  // T-H2: Matrix gegen den Katalog, aus dem sie generiert wird.
  const h2 = urteilT_H2(regelMatrixAktuell(readFileSync(join(REPO, 'docs', 'views', 'regel-matrix.md'), 'utf8'), se.ALL_RULE_DEFS.map((d) => d.id)));
  zeile('T-H2', 'jede Regel steht in der Matrix, jede genannte ID existiert', h2.wert, h2.urteil);

  // T-M4: der Dauertest, strukturiert ueber den JSON-Reporter.
  const tmp = mkdtempSync(join(tmpdir(), 'messung-'));
  try {
    const out = join(tmp, 'm4.json');
    vitest('tests/steering.steer-causality.test.ts', out);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    zeile('T-M4', '12/12 Prüfungen grün, 3 Rotkontrollen schlagen an', `${j.numPassedTests}/${j.numTotalTests} grün`,
      j.numTotalTests >= 12 && j.numPassedTests === j.numTotalTests ? 'bestanden' : 'nicht bestanden');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // T-E8: Median der Runde aus dem Perf-Spike.
  const e8 = vitest('tests/perf.advisory-roundtrip.spike.test.ts');
  // Die FESTE Eingabe (Leitlinie §9.3, CR-GC-665): das lebende Modell waechst, eine Schwelle darauf
  // waere eine Schwelle auf das Modellwachstum.
  const median = medianAusLog(e8.text, 'fixed');
  if (median === null) throw new Error(`messung T-E8: keine Zeile "[SPIKE fixed, …] median total=" (exit ${e8.status})`);
  zeile('T-E8', 'Runde lesen → Status → Vorschlag → Anwenden < 200 ms (feste Eingabe)', `Median ${median.ms} ms bei ${median.knoten} Knoten`,
    median.ms < 200 ? 'bestanden' : 'nicht bestanden');

  // T-E1 (Nr 12): graph_impact bei CRs mit Loeschung, aus der Dauermessung (post-commit, lokal).
  const jsonl = join(REPO, '.graphcode', 'cr-messung.jsonl');
  if (!existsSync(jsonl)) throw new Error('messung T-E1: keine `.graphcode/cr-messung.jsonl` — die Dauermessung (post-commit) schreibt sie lokal');
  const crZeilen = readFileSync(jsonl, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  zeile('T-E1', '`graph_impact` bei CRs mit Löschung aufgerufen (keine Schwelle)', wertLoeschung(crZeilen), 'ohne Schwelle',
    { datum: crZeilen.at(-1).datum.slice(0, 10), stempel: `commit ${crZeilen.at(-1).commit}` });

  // T-E2: die Whitebox gegen die tatsächlich geänderten Knoten der jüngsten CR-Commits (scripts/whitebox-messung.mjs).
  const { whiteboxMessung } = await import(join(REPO, 'scripts', 'whitebox-messung.mjs'));
  const wb = await whiteboxMessung(REPO);
  if (wb.urteil === 'nicht erhoben') throw new Error(`messung T-E2: nicht erhoben — ${wb.wert}`);
  zeile('T-E2', '100 % der geänderten Knoten in W bei |W|/|G| ≤ 0,05 (jüngste 10 CR-Commits)', wb.wert, wb.urteil);

  // T-O1: Kontrolle und Familie-Korpus aus dem Spike, gerechnet von `chainMetrics` (contracts).
  const { kontrolle, messeKorpus } = await import(join(REPO, 'scripts', 'spike-kettenkennzahlen.mjs'));
  const k = kontrolle();
  const korpus = messeKorpus().filter((x) => !x.skipped);
  const o1 = urteilT_O1({
    posOk: k.posOk, negOk: k.negOk,
    chains: korpus.reduce((n, x) => n + x.chains, 0), measurable: korpus.reduce((n, x) => n + x.measurable, 0),
    graphen: korpus.length,
    nullKennzahlen: Object.entries(k.pos).filter(([, v]) => v === null).map(([name]) => name),
  });
  zeile('T-O1', 'Referenzkette reproduziert; ≥ 90 % der Ketten auswertbar', o1.wert, o1.urteil);

  // T-M3 und die Groessen 3 bis 5: der Verlauf der committeten Staende, gerechnet vom Host-Paket
  // (`verlaufFuerRepo`, wie graph_readiness). Die Wochentabelle liest alle Staende, T-M3 die juengsten 24.
  const verlauf = dist.verlaufFuerRepo(REPO, null).states;
  const m3 = urteilT_M3(verlauf.slice(-24));
  zeile('T-M3', 'Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je Stufe ohne Plan fallen oder sind abgenommen (hier geurteilt: Fehler und Marken)', m3.wert, m3.urteil);
  const jung = verlauf.at(-1);
  zeile('G3', 'Steuerwert und Überschreitungen je Steuerregel (keine Schwelle)', wertSteuer(jung), 'ohne Schwelle');
  zeile('G4', 'Testergebnis je Anforderung (keine Schwelle)', wertTests(jung), 'ohne Schwelle');
  zeile('G5', 'Ketten bewertbar im eigenen Modell (keine Schwelle)', wertKetten(jung), 'ohne Schwelle');

  // Groessen 6, 7, 9: die jeweils juengste Zeile je CR aus `docs/messung/testauswahl.jsonl` (verify:full).
  const auswahl = leseSchlupfZeilen(readFileSync(join(REPO, 'docs', 'messung', 'testauswahl.jsonl'), 'utf8'));
  const dauer = wertDauer(auswahl);
  if (dauer === null) throw new Error('messung G9: keine Zeile in testauswahl.jsonl traegt `dauer`');
  zeile('G6', 'Folge ohne Schlupf, bereinigt (keine Schwelle)', wertSchlupf(auswahl, schlupfFreieFolge(auswahl), SCHLUPF_SCHWELLE), 'ohne Schwelle');
  zeile('G7', 'Bindung der Blackbox- und Schnittstellen-Tests (keine Schwelle)', wertZusage(auswahl.at(-1)), 'ohne Schwelle');
  zeile('G9', 'Dauer Auswahl gegen Volllauf (keine Schwelle)', dauer, 'ohne Schwelle');

  return { zeilen, stempel, verlauf };
}

if (process.argv[1] && process.argv[1].endsWith('messung.mjs')) {
  const vorher = existsSync(STAND_JSON) ? parseStand(readFileSync(STAND_JSON, 'utf8')) : null;
  const { zeilen, stempel, verlauf } = await erhebe();
  const mitVor = mitVorwert(zeilen, vorher);
  mkdirSync(dirname(STAND), { recursive: true });
  writeFileSync(STAND, renderStand(mitVor, stempel, wochenTabelle(verlauf)));
  writeFileSync(STAND_JSON, JSON.stringify(alsStand(mitVor, stempel), null, 2) + '\n');
  for (const id of ZEILEN) {
    const z = mitVor.find((x) => x.id === id);
    console.log(`${id.padEnd(5)} ${z.urteil.padEnd(16)} ${z.wert}`);
  }
  console.log(`→ ${STAND.slice(REPO.length + 1)}, ${STAND_JSON.slice(REPO.length + 1)}`);
}
