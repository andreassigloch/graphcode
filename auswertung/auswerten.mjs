#!/usr/bin/env node
/**
 * auswerten.mjs — der Runner der Auswertung (CR-GC-739; Konzept docs/graphcode_messaufbau_konzept.md §3).
 *
 *   node auswertung/auswerten.mjs [lauf-dir …] [--analysen=kennzahlen,verhalten,schatten,blindurteil] [--nur-md]
 *
 * Ohne Lauf-Verzeichnisse: alle abgeschlossenen Läufe unter rig/runs, die einen Stand tragen (ab CR-GC-738).
 * Ohne `--analysen`: alle (Entscheid Autor 2026-10-05 — im Zweifel alles); `schatten` spielt jeden Lauf durchs
 * Gate nach und dauert. Je Lauf entsteht EIN Datensatz: Identität (Aufgabe, Arm, Modell, Stand, Stempel, Ende,
 * Gates) plus je Analyse ihr Teil. Er geht nach docs/messung/benchmark.jsonl (eine Zeile je Lauf, Schlüssel
 * `aufgabe/arm-nr`; erneutes Auswerten ersetzt die Zeile — Rohdaten dürfen danach weg, Löschkonzept Regel 1),
 * und aus allen Datensätzen entsteht docs/messung/benchmark.md neu: oben je Aufgabe × Arm die jüngste Serie
 * (Stand, N, Spannen), darunter der Verlauf. `--nur-md` rendert nur neu.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kennzahlen } from './kennzahlen.mjs';
import { verhalten } from './verhalten.mjs';
import { schatten } from './schatten-suggest.mjs';
import { blindurteilFuer } from './blindurteil.mjs';
import { aufgabeLaden } from '../rig/simulator.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS = join(HERE, '..', 'rig', 'runs');
export const JSONL = join(HERE, '..', 'docs', 'messung', 'benchmark.jsonl');
export const MD = join(HERE, '..', 'docs', 'messung', 'benchmark.md');
export const ANALYSEN = ['kennzahlen', 'verhalten', 'schatten', 'blindurteil'];

/** Alle Läufe mit Stand und Ende — Läufe vor CR-GC-738 (ohne Stand) gehören in den archivierten Vorlauf. */
export function laeufeMitStand(runs = RUNS) {
  const out = [];
  if (!existsSync(runs)) return out;
  for (const a of readdirSync(runs, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const d of readdirSync(join(runs, a.name)).sort()) {
      const p = join(runs, a.name, d, 'lauf.json');
      if (!existsSync(p)) continue;
      const l = JSON.parse(readFileSync(p, 'utf8'));
      if (l.stand && l.ende) out.push(join(runs, a.name, d));
    }
  }
  return out;
}

/** Rein: der Datensatz eines Laufs aus lauf.json und den Teilen der Analysen. */
export function datensatz(lauf, teile, datum) {
  const letzte = lauf.zuege?.at(-1);
  return {
    id: `${lauf.aufgabe}/${lauf.arm}-${lauf.nr}`,
    datum, aufgabe: lauf.aufgabe, arm: lauf.arm, nr: lauf.nr, modell: lauf.modell, stand: lauf.stand, stempel: lauf.stempel,
    ende: lauf.ende, sequenz: lauf.sequenz, gates: letzte?.gates ?? {},
    ...teile,
  };
}

/** Rein: ersetzt den Datensatz gleicher id oder hängt an; Reihenfolge nach Datum, dann id. */
export function upsert(datensaetze, neu) {
  const rest = datensaetze.filter((d) => d.id !== neu.id);
  return [...rest, neu].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.id.localeCompare(b.id, 'de', { numeric: true })));
}

export function lesen(pfad = JSONL) {
  return existsSync(pfad) ? readFileSync(pfad, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

const min = (ms) => (ms / 60_000).toFixed(1);
const spanne = (xs, f = (x) => x) => {
  const v = xs.filter((x) => x !== null && x !== undefined);
  if (!v.length) return '—';
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? `${f(lo)}` : `${f(lo)}–${f(hi)}`;
};
const standText = (st) => (st ? `${st.code} · ${st.vorlage}` : '—');
const blind = (b) => (b ? `${b.voll} · ${b.teil} · ${b.fehlt} / ${b.offenGefuehrt} / ${b.erfunden} / ${b.dubletten} / ${b.notensumme}` : '—');

/** Rein: je Aufgabe × Arm die Datensätze des jüngsten Stands. */
export function juengsteSerie(datensaetze) {
  const gruppen = new Map();
  for (const d of datensaetze) {
    const k = `${d.aufgabe}|${d.arm}`;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(d);
  }
  return [...gruppen.entries()].map(([k, ds]) => {
    const neuester = ds.reduce((a, b) => (a.datum <= b.datum ? b : a));
    const serie = ds.filter((d) => d.stand?.code === neuester.stand?.code && d.stand?.vorlage === neuester.stand?.vorlage);
    return { aufgabe: neuester.aufgabe, arm: neuester.arm, modell: neuester.modell, stand: neuester.stand, serie };
  }).sort((a, b) => `${a.aufgabe}|${a.arm}`.localeCompare(`${b.aufgabe}|${b.arm}`));
}

/** Rein: das laufende Dokument aus den Datensätzen. */
export function rendern(datensaetze, { archiv = 'docs/archive/messung-interaktiv-2026-10-04.md' } = {}) {
  const z = [
    '# Benchmark des Rigs',
    '',
    '> GENERIERT von `node auswertung/auswerten.mjs` — nicht von Hand bearbeiten. Datensätze: [`benchmark.jsonl`](benchmark.jsonl)',
    '> (eine Zeile je Lauf, Rohdaten entbehrlich, sobald die Zeile steht). Rig: [`rig/README.md`](../../rig/README.md), Analysen:',
    '> [`auswertung/README.md`](../../auswertung/README.md). Ein Lauf endet, wenn die Readiness SRR und PDR als bestanden meldet.',
    '> Die Deutung (T-E3 erfüllt oder nicht) steht in der Leitlinie, nicht hier.',
    '',
    '## Stand — je Aufgabe × Arm die jüngste Serie',
    '',
    '| Aufgabe | Arm | Modell | Stand (code · vorlage) | N | Züge | Sitzungen | Dauer je Zug Median (min) | Fragen Zug 1 | Mutationen + / − | PDR nach Zug | Dubletten | Blindurteil P ✓ · ~ · ✗ / O offen / erfunden / Dubl. / Noten |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const g of juengsteSerie(datensaetze)) {
    const s = g.serie, k = s.map((d) => d.kennzahlen).filter(Boolean), b = s.map((d) => d.blindurteil).filter(Boolean);
    z.push(`| ${g.aufgabe} | ${g.arm} | ${g.modell ?? '—'} | ${standText(g.stand)} | ${s.length} | ${spanne(k.map((x) => x.zuege))} | ${spanne(k.map((x) => x.sitzungen))} | ${spanne(k.map((x) => x.dauerMedianMs), min)} | ${spanne(k.map((x) => x.fragenZug1))} | ${spanne(k.map((x) => x.angenommen))} / ${spanne(k.map((x) => x.abgelehnt))} | ${spanne(k.map((x) => x.gateZug?.PDR))} | ${spanne(s.map((d) => d.verhalten?.dubletten?.anzahl))} | ${b.length ? `${spanne(b.map((x) => x.voll))} · ${spanne(b.map((x) => x.teil))} · ${spanne(b.map((x) => x.fehlt))} / ${spanne(b.map((x) => x.offenGefuehrt))} / ${spanne(b.map((x) => x.erfunden))} / ${spanne(b.map((x) => x.dubletten))} / ${spanne(b.map((x) => x.notensumme))}` : '—'} |`);
  }
  z.push('', '## Verlauf — ein Lauf je Zeile', '',
    '| Datum | Aufgabe | Arm | Lauf | Modell | Stand | Ende | Züge · Sitzungen | Dauer Median / Max (min) | Fragen Zug 1 | Schritte Median / Max | Mutationen + / − | Abbrüche L / F | SRR / PDR nach Zug | Elemente · Kanten | Dubletten | Gate-Fehler je Regel | Schatten: Vorschlag getroffen / verpasst | Blindurteil |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of datensaetze) {
    const k = d.kennzahlen ?? {}, v = d.verhalten, sc = d.schatten;
    const regeln = v ? Object.entries(v.fehlerJeRegel ?? {}).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}×${n}`).join(' ') || '—' : '—';
    z.push(`| ${d.datum} | ${d.aufgabe} | ${d.arm} | ${d.nr} | ${d.modell ?? '—'} | ${standText(d.stand)} | ${d.ende} | ${k.zuege ?? '—'} · ${k.sitzungen ?? '—'} | ${k.dauerMedianMs != null ? `${min(k.dauerMedianMs)} / ${min(k.dauerMaxMs)}` : '—'} | ${k.fragenZug1 ?? '—'} | ${k.schritteMedian ?? '—'} / ${k.schritteMax ?? '—'} | ${k.angenommen ?? '—'} / ${k.abgelehnt ?? '—'} | ${k.abbruch ? `${k.abbruch.laenge} / ${k.abbruch.fehler}` : '—'} | ${k.gateZug ? `${k.gateZug.SRR ?? '—'} / ${k.gateZug.PDR ?? '—'}` : '—'} | ${k.elemente ?? '—'} · ${k.kanten ?? '—'} | ${v?.dubletten?.anzahl ?? '—'} | ${regeln} | ${sc ? `${sc.agentTrafVorschlag}/${sc.mitAnwendbaremVorschlag} / ${sc.verpasst}` : '—'} | ${blind(d.blindurteil)} |`);
  }
  z.push('', `Reihe vom 2026-10-04 mit der alten Ende-Regel (Schnitt am ersten Analyse-Vorschlag): [${basename(archiv)}](../../${archiv}).`, '');
  return z.join('\n');
}

/** Einen Lauf auswerten: die gewählten Analysen, als Datensatz. */
export async function auswertenLauf(laufDir, analysen = ANALYSEN) {
  const lauf = JSON.parse(readFileSync(join(laufDir, 'lauf.json'), 'utf8'));
  const teile = {};
  if (analysen.includes('kennzahlen')) teile.kennzahlen = kennzahlen(lauf);
  if (analysen.includes('verhalten')) {
    const referenz = join(aufgabeLaden(lauf.aufgabe).referenz(lauf.arm), 'graph.json');
    teile.verhalten = verhalten(laufDir, existsSync(referenz) ? referenz : null);
  }
  if (analysen.includes('schatten')) teile.schatten = (await schatten(laufDir)).bilanz;
  if (analysen.includes('blindurteil')) teile.blindurteil = blindurteilFuer(laufDir);
  const datum = new Date(statSync(join(laufDir, 'lauf.json')).mtimeMs).toISOString().slice(0, 10);
  return datensatz(lauf, teile, datum);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((d) => resolve(d));
  const analysen = flags.analysen ? flags.analysen.split(',') : ANALYSEN;
  for (const a of analysen) if (!ANALYSEN.includes(a)) { console.error(`unbekannte Analyse „${a}" — erlaubt: ${ANALYSEN.join(', ')}`); process.exit(1); }
  let saetze = lesen();
  if (!('nur-md' in flags)) {
    for (const d of (dirs.length ? dirs : laeufeMitStand())) {
      const s = await auswertenLauf(d, analysen);
      saetze = upsert(saetze, s);
      console.log(`${s.id}: ${s.ende} · ${analysen.join(',')}`);
    }
    writeFileSync(JSONL, saetze.map((s) => JSON.stringify(s)).join('\n') + '\n');
  }
  writeFileSync(MD, rendern(saetze));
  console.log(`${saetze.length} Datensätze → ${basename(JSONL)}, ${basename(MD)}`);
}
