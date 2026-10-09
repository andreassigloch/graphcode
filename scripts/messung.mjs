#!/usr/bin/env node
/**
 * messung.mjs — `npm run messung`: die Stufe S1 (Leitlinie §9.4) in EINE Datei (CR-GC-679).
 *
 * Je S1-Test-ID (und je ID in `WEITERE`) eine Zeile in `docs/messung/stand.md`: Wert, Kriterium, Urteil, Datum, Stempel.
 * Die Leitlinie traegt in der Spalte „Stand" dann keine Zahlen mehr, sondern verweist hierher.
 *
 * Urteile: bestanden · nicht bestanden · ohne Schwelle (die Leitlinie nennt bewusst keine, T-E1) ·
 * nicht erhoben (die Quelle liefert noch keinen lesbaren Wert — Grund in der Zeile, Folge-CR 679B).
 * Ein Adapter, der wirft, bricht den Lauf ab: eine Zeile mit verschlucktem Fehler waere eine Zahl
 * ohne Messung.
 *
 * Aufruf: npm run messung   (braucht ein gebautes dist; lokal, kein Modell, ~1 min)
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STAND = join(REPO, 'docs', 'messung', 'stand.md');

/** Die S1-Test-IDs aus Leitlinie §9.4 — `tests/messung.test.ts` haelt die Liste gleich. */
export const S1 = ['T-V1', 'T-V2', 'T-V4', 'T-M3', 'T-M4', 'T-E1', 'T-E2', 'T-E8', 'T-O4', 'T-O6', 'T-H2'];

/**
 * Zeilen im Messstand, die die Leitlinie §9.4 (noch) nicht in der S1-Zeile fuehrt (CR-GC-767).
 * T-O1 ist deterministisch und wird hier erhoben; `S1` bleibt wortgleich die Liste der Leitlinie.
 */
export const WEITERE = ['T-O1'];
const ZEILEN = [...S1, ...WEITERE];

/** Noch ohne lesbaren Wert: die Quelle gibt nur Prosa aus (Folge-CR CR-GC-679B). */
const NICHT_ERHOBEN = {
  'T-V1': ['0 Befunde auf allen Ebenen', '`rig/moneyflow-struktur/driver.mjs` (graphanalyze) gibt nur Prosa aus'],
  'T-M3': ['Verstöße je Element fallen monoton im Trend', '`spike-nachweis-history.mjs` hat kein Urteilsfeld, nur Kill-Zeilen'],
  'T-O4': ['Known-Answer-Set richtig gerankt, keine Regression einer Dimension mit Gewicht ≥ 1', '`known-answer-set.mjs` gibt nur Markdown aus'],
  'T-O6': ['≥ 6/7 bekannte Paare gefunden', 'ND- und Engpass-Spike geben nur Prosa aus'],
};

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

/** Die Datei. Wirft, wenn eine Test-ID fehlt oder eine Zeile keinen Stempel traegt. */
export function renderStand(zeilen, stempel) {
  const fehlt = ZEILEN.filter((id) => !zeilen.some((z) => z.id === id));
  if (fehlt.length) throw new Error(`messung: keine Zeile fuer ${fehlt.join(', ')}`);
  const ohne = zeilen.filter((z) => !z.stempel).map((z) => z.id);
  if (ohne.length) throw new Error(`messung: ohne Stempel keine Zahl — ${ohne.join(', ')}`);
  const zelle = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    '# Messstand Stufe S1',
    '',
    '> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten.',
    `> Stempel des Laufs: ${stempel}`,
    '',
    '| Test | Kriterium | Wert | Urteil | Datum | Stempel |',
    '|---|---|---|---|---|---|',
    ...ZEILEN.map((id) => zeilen.find((z) => z.id === id)).map((z) =>
      `| ${z.id} | ${zelle(z.kriterium)} | ${zelle(z.wert)} | ${z.urteil} | ${z.datum} | ${zelle(z.stempel)} |`),
    '',
  ].join('\n');
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
  const zeile = (id, kriterium, wert, urteil, extra = {}) => zeilen.push({ id, kriterium, wert, urteil, datum, stempel, ...extra });
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

  // T-E1: der letzte Stand aus der Dauermessung (post-commit), Stempel = sein Commit.
  const jsonl = join(REPO, '.graphcode', 'cr-messung.jsonl');
  const kriteriumE1 = 'Suchen, die der Graph beantwortet hätte, als Potenzial ausgewiesen (keine Schwelle)';
  if (existsSync(jsonl)) {
    const mitKpi = readFileSync(jsonl, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.kpi1 !== undefined);
    const letzte = mitKpi.slice(-20);
    const med = [...letzte.map((e) => e.kpi1)].sort((a, b) => a - b)[Math.floor(letzte.length / 2)];
    const e = letzte.at(-1);
    zeile('T-E1', kriteriumE1, `KPI 1 Median ${med} über die letzten ${letzte.length} CRs (zuletzt ${e.cr}: ${e.graphReads} Graph-Lesungen, ${e.grepGlobDocReads} Suchen)`,
      'ohne Schwelle', { datum: e.datum.slice(0, 10), stempel: `commit ${e.commit}` });
  } else {
    zeile('T-E1', kriteriumE1, '— keine `.graphcode/cr-messung.jsonl` (die Dauermessung laeuft nur lokal)', 'nicht erhoben');
  }

  // T-E2: die Whitebox gegen die tatsächlich geänderten Knoten der jüngsten CR-Commits (scripts/whitebox-messung.mjs).
  const { whiteboxMessung } = await import(join(REPO, 'scripts', 'whitebox-messung.mjs'));
  const wb = await whiteboxMessung(REPO);
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

  for (const [id, [kriterium, grund]] of Object.entries(NICHT_ERHOBEN)) zeile(id, kriterium, `— ${grund} (CR-GC-679B)`, 'nicht erhoben');
  return { zeilen, stempel };
}

if (process.argv[1] && process.argv[1].endsWith('messung.mjs')) {
  const { zeilen, stempel } = await erhebe();
  mkdirSync(dirname(STAND), { recursive: true });
  writeFileSync(STAND, renderStand(zeilen, stempel));
  for (const id of ZEILEN) {
    const z = zeilen.find((x) => x.id === id);
    console.log(`${id.padEnd(5)} ${z.urteil.padEnd(16)} ${z.wert}`);
  }
  console.log(`→ ${STAND.slice(REPO.length + 1)}`);
}
