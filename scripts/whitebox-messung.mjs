#!/usr/bin/env node
/**
 * whitebox-messung.mjs — T-E2 (Leitlinie §9.4): Enthält die Whitebox, was sich tatsächlich ändert?
 *
 * Je Job: W = die Spec-Closure der Seeds, wie `graph_context` sie liefert (das reale Werkzeug, kein Nachbau);
 * B = der Blast-Radius (`harness.impact`, die Traversierung hinter `graph_impact`) als Kontrolle; Ground Truth = die
 * Knoten, die der Schluss-Commit des Jobs tatsächlich geändert hat. Kriterium: 100 % der geänderten Knoten liegen in W,
 * und |W|/|G| ≤ 0,05.
 *
 * Die Jobs kommen aus der Historie, nicht aus einer Liste: jeder Commit an der SSOT, auf den ein abgeschlossener CR
 * mit `commitRef` zeigt, ist ein Job — Seeds sind die relation-Ziele des CR im Graphen VOR dem Commit, Ground Truth die
 * dort vorhandenen Knoten, die der Commit geändert oder entfernt hat (neue Knoten kann keine Scheibe vorhersehen).
 * Gemessen wird am Graphen vor dem Commit in einem Wegwerf-Store (`openMeasured`), mit der Policy des Repos; der
 * Live-Store wird nie angefasst. Dazu die eingefrorene Kalibrier-Fixture (`beispielgraphen/dummy-slicer.graph.json`,
 * 13 Knoten) — berichtet, nicht beurteilt: auf 13 Knoten ist |W|/|G| keine Aussage.
 *
 * Herkunft: rig/minimal-whitebox Phase 1 (SPIKE-GC-minimal-whitebox, Arme A0/A/B) mit handgepflegtem Job-Set, das
 * gegen das heutige Modell gedriftet war (MOD-host-bridge, FUNC-render-* gibt es nicht mehr); hierher als S1-Messung
 * mit CR-GC-741. Die Executor-Arme des Spikes sind gefallen (CR-GC-740).
 *
 * Aufruf: node scripts/whitebox-messung.mjs [--json] [--n=10]   ·   aus `npm run messung` (Zeile T-E2)
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SSOT = 'docs/graph/graphcode.graph.json';

/** Die Schwelle der Leitlinie: |W|/|G| ≤ 0,05. */
export const W_ZU_G_MAX = 0.05;

/** Die Kalibrier-Fixture des Spikes (§6, J1): ein Seed, ein geänderter Knoten — prüft die Mechanik, nicht die Schwelle. */
export const KALIBRIERUNG = {
  name: 'J1',
  titel: 'Kalibrierung: 1 Knoten, Implementieren (FN-slice)',
  kalibrierung: true,
  fixture: { graph: 'beispielgraphen/dummy-slicer.graph.json', systemId: 'dummy-slicer' },
  seeds: ['FN-slice'],
  groundTruth: ['FN-slice'],
};

/**
 * Rein: die geänderten Knoten zwischen zwei Exporten — hinzugefügt, geändert (Inhalt ungleich), entfernt, und
 * `beruehrt`: vorhandene Knoten, deren Kanten sich geändert haben (eine neue REQ hängt sich an einen UC, eine neue
 * FUNC an ein MOD — der Agent musste diese Knoten kennen). Kanten zu Knoten aus `ohne` zählen nicht (die relation-Kanten
 * des CR selbst machten sonst jeden Umfangsknoten trivial zum Treffer).
 */
export function aenderungen(vorher, nachher, { ohne = [] } = {}) {
  const a = new Map(vorher.elements.map((e) => [e.id, JSON.stringify(e)]));
  const b = new Map(nachher.elements.map((e) => [e.id, JSON.stringify(e)]));
  const aus = new Set(ohne);
  const kanten = (g) => {
    const m = new Map();
    for (const t of g.traces) {
      if (aus.has(t.source) || aus.has(t.target)) continue;
      const k = `${t.source} ${t.type} ${t.target}`;
      for (const id of [t.source, t.target]) m.set(id, (m.get(id) ?? new Set()).add(k));
    }
    return m;
  };
  const ka = kanten(vorher), kb = kanten(nachher);
  const gleich = (x, y) => x.size === y.size && [...x].every((k) => y.has(k));
  const geaendert = [...b.keys()].filter((id) => a.has(id) && a.get(id) !== b.get(id));
  return {
    hinzu: [...b.keys()].filter((id) => !a.has(id)),
    geaendert,
    entfernt: [...a.keys()].filter((id) => !b.has(id)),
    beruehrt: [...a.keys()].filter((id) => b.has(id) && !geaendert.includes(id) && !gleich(ka.get(id) ?? new Set(), kb.get(id) ?? new Set())),
  };
}

/**
 * Rein: der Job eines CR-Commits. Seeds = der erklärte Umfang des CR (seine relation-Ziele im Graphen NACH dem Commit),
 * soweit er vor dem Commit schon da war — vorher trägt der CR-Knoten meist noch keine Kanten, sie kommen mit der Arbeit.
 * Ground Truth = die vorher vorhandenen Knoten, die der Commit geändert, entfernt oder an neue Kanten gehängt hat —
 * ohne den CR-Knoten selbst (sein Status kippt immer). Neue Knoten zählen nicht: die kann keine Scheibe vorhersehen.
 */
export function jobAusCommit(crId, vorher, nachher, commit) {
  const d = aenderungen(vorher, nachher, { ohne: [crId] });
  const vorhanden = new Set(vorher.elements.map((e) => e.id));
  const seeds = [...new Set(nachher.traces.filter((t) => t.source === crId && t.type === 'relation' && vorhanden.has(t.target)).map((t) => t.target))];
  const groundTruth = [...new Set([...d.geaendert, ...d.entfernt, ...d.beruehrt])].filter((id) => id !== crId && vorhanden.has(id));
  return { name: crId, titel: `${crId} @ ${commit.slice(0, 7)}`, commit, seeds, groundTruth, hinzu: d.hinzu.length, fixture: { graph: vorher, systemId: 'graphcode' } };
}

/**
 * Die Jobs aus der Historie: die jüngsten `n` Commits an der SSOT, auf die ein CR des heutigen Modells mit
 * `commitRef` zeigt und die mindestens einen Seed und einen geänderten vorhandenen Knoten haben.
 */
export function jobsAusHistorie(repo = REPO, { n = 10, tiefe = 120 } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const heute = JSON.parse(readFileSync(join(repo, SSOT), 'utf8'));
  const refOf = (e) => e.commitRef ?? e.attributes?.commitRef;
  const crs = heute.elements.filter((e) => e.type === 'CR' && typeof refOf(e) === 'string' && refOf(e).length >= 7).map((e) => ({ id: e.id, ref: refOf(e) }));
  const commits = git('log', `-n${tiefe}`, '--format=%H', '--', SSOT).trim().split('\n').filter(Boolean);
  const jobs = [];
  for (const c of commits) {
    if (jobs.length >= n) break;
    const cr = crs.find((x) => c.startsWith(x.ref));
    if (!cr) continue;
    let vorher, nachher;
    try { vorher = JSON.parse(git('show', `${c}^:${SSOT}`)); nachher = JSON.parse(git('show', `${c}:${SSOT}`)); } catch { continue; }
    const job = jobAusCommit(cr.id, vorher, nachher, c);
    if (job.seeds.length && job.groundTruth.length) jobs.push(job);
  }
  return jobs;
}

/** uids eines Format-E-Slices — über denselben Codec, der ihn geschrieben hat. */
export function uidsAus(codec, formatE) {
  const uids = new Set();
  for (const op of codec.parse(formatE).operations) {
    if (op.id) uids.add(op.id);
    if (op.sourceId) uids.add(op.sourceId);
    if (op.targetId) uids.add(op.targetId);
  }
  return uids;
}

/** Rein: das Ergebnis eines Jobs aus seinen Mengen. `fehlt` = Seeds oder Ground Truth, die der Graph nicht kennt. */
export function jobErgebnis(job, { G, whitebox, blast, vorhanden }) {
  const fehlt = [...new Set([...job.seeds, ...job.groundTruth].filter((u) => !vorhanden.has(u)))];
  const inW = job.groundTruth.filter((u) => whitebox.has(u));
  const wZuG = G ? +(whitebox.size / G).toFixed(3) : null;
  return {
    job: job.name, titel: job.titel, kalibrierung: job.kalibrierung === true, commit: job.commit ?? null, G,
    seeds: job.seeds.length, W: whitebox.size, B: blast.size, wZuG,
    groundTruth: { total: job.groundTruth.length, inW: inW.length, fehltInW: job.groundTruth.filter((u) => !whitebox.has(u)) },
    fehlt,
    bestanden: fehlt.length === 0 && inW.length === job.groundTruth.length && wZuG !== null && wZuG <= W_ZU_G_MAX,
  };
}

/** Rein: die Zeile für den Messstand — ein Urteil über die Jobs der Historie, die Kalibrierung wird nur genannt. */
export function urteil(ergebnisse) {
  const jobs = ergebnisse.filter((e) => !e.kalibrierung);
  const kurz = (e) => `${e.job}: ${e.groundTruth.inW}/${e.groundTruth.total} in W, |W|/|G| ${e.wZuG ?? '—'}${e.fehlt.length ? ` (fehlt ${e.fehlt.join(', ')})` : ''}`;
  const kal = ergebnisse.filter((e) => e.kalibrierung).map((e) => `Kalibrierung ${kurz(e)}`);
  if (jobs.length === 0) return { wert: ['kein CR-Commit mit Seeds und geänderten Knoten in der Historie', ...kal].join('; '), urteil: 'nicht erhoben' };
  const bestanden = jobs.filter((e) => e.bestanden).length;
  return {
    wert: [`${bestanden}/${jobs.length} Jobs: ${jobs.map(kurz).join('; ')}`, ...kal].join('; '),
    urteil: jobs.some((e) => e.fehlt.length) ? 'nicht erhoben' : bestanden === jobs.length ? 'bestanden' : 'nicht bestanden',
  };
}

/** Einen Job messen — Wegwerf-Store aus der Fixture (Pfad oder Graph), reale Werkzeuge, nichts nachgebaut. */
export async function messeJob(job, repo = REPO) {
  const { openMeasured } = await import(join(repo, 'dist', 'index.js'));
  const { SE_DESCRIPTOR, FormatECodec } = await import('@sigloch/graph-api-core');
  const codec = new FormatECodec(SE_DESCRIPTOR);
  const tmp = typeof job.fixture.graph === 'string' ? null : mkdtempSync(join(tmpdir(), 'whitebox-'));
  const pfad = tmp ? join(tmp, `${job.fixture.systemId}.graph.json`) : join(repo, job.fixture.graph);
  if (tmp) writeFileSync(pfad, JSON.stringify(job.fixture.graph));
  const m = await openMeasured({ graph: pfad, systemId: job.fixture.systemId, workspaceId: 'whitebox-messung', ...(tmp ? { configFrom: repo } : {}) });
  try {
    const graph = m.graph();
    const vorhanden = new Set(graph.nodes.map((n) => n.uid));
    const seeds = job.seeds.filter((s) => vorhanden.has(s));
    const blast = new Set();
    for (const s of seeds) for (const n of (await m.harness.impact(s, 1)).nodes) blast.add(n.uid);
    const whitebox = new Set(seeds);
    for (const s of seeds) for (const u of uidsAus(codec, (await m.tools.graph_context.handler({ id: s, depth: 1 })).formatE)) whitebox.add(u);
    return jobErgebnis(job, { G: graph.nodes.length, whitebox, blast, vorhanden });
  } finally {
    await m.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

export async function whiteboxMessung(repo = REPO, { n = 10 } = {}) {
  const ergebnisse = [];
  for (const job of [KALIBRIERUNG, ...jobsAusHistorie(repo, { n })]) ergebnisse.push(await messeJob(job, repo));
  return { ergebnisse, ...urteil(ergebnisse) };
}

if (process.argv[1] && process.argv[1].endsWith('whitebox-messung.mjs')) {
  const n = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 10);
  const r = await whiteboxMessung(REPO, { n });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    for (const e of r.ergebnisse) console.log(`${e.job.padEnd(10)} ${e.commit ? e.commit.slice(0, 7) : 'fixture'} G=${e.G} Seeds=${e.seeds} |B|=${e.B} |W|=${e.W} |W|/|G|=${e.wZuG} GT in W ${e.groundTruth.inW}/${e.groundTruth.total}${e.groundTruth.fehltInW.length ? ` (nicht in W: ${e.groundTruth.fehltInW.join(', ')})` : ''} → ${e.kalibrierung ? 'Kalibrierung' : e.bestanden ? 'bestanden' : 'nicht bestanden'}`);
    console.log(`T-E2 ${r.urteil}`);
  }
}
