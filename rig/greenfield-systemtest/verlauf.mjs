#!/usr/bin/env node
/**
 * verlauf.mjs — die Kennzahlen einer S2-Runde als EINE Zeile in `docs/messung/verlauf.md` (CR-GC-709).
 *
 * Jede Änderung am Executor (Auftrag, Kontext, Skill, Abstellmaßnahme) muss ihre Wirkung belegen —
 * nicht in der Erinnerung, sondern als Zeile neben der vorigen. Die Werte stehen je Lauf nebeneinander
 * (n ist klein: keine Mittelwerte). Quellen: die Ergebnisdatei der Runde und je Lauf `runs/<arm>-<n>/`.
 *
 *   node rig/greenfield-systemtest/verlauf.mjs results-s2-40r-cr707.json "CR-GC-707: Treiber ohne Eintrittspunkte"
 *
 * Spalten: Elemente · Gate-Durchgang (angewandt ÷ eingereicht) · Dubletten ÷ Elemente (ohne Schablone,
 * `verhalten.dubletten`) · Wirkketten mit genau einer FUNC · Ähnlichkeit zum Golden (Typ-Kante-Typ-Muster)
 * · Fokusfunde am Ende (was der Treiber noch vor sich hat) · Lösungsquote der Fokusrunden (`zuege.mjs`;
 * „—", wenn der Lauf gegen den heutigen Code nicht nachspielbar ist) · MOD.
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateAllRules, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { dubletten, ladeGraph, struktur } from './verhalten.mjs';
import { nachspielen } from './zuege.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const VERLAUF = join(HERE, '..', '..', 'docs', 'messung', 'verlauf.md');
const KOPF = [
  '# Kennzahlverlauf der S2-Runden',
  '',
  'Eine Zeile je S2-Runde, geschrieben von `rig/greenfield-systemtest/verlauf.mjs` (CR-GC-709); je Lauf ein',
  'Wert, getrennt durch „/". Definitionen: [`kennzahlen.md`](kennzahlen.md) (Executor-Züge) und der Kopf von',
  '`verlauf.mjs`. Eine Änderung am Executor gilt erst als wirksam, wenn ihre Zeile hier steht.',
  '',
  '| Datum | Anlass | Läufe × Runden | Elemente | Gate-Durchgang | Dubletten | Ketten mit 1 FUNC | Ähnlichkeit Golden | Fokusfunde Ende | Lösungsquote Fokus | MOD |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
];

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');

/** Kennzahlen eines Laufs aus Ergebniszeile und Laufverzeichnis. */
export async function laufKennzahlen(row, dir, golden) {
  const loop = row.tokens?.loop ?? {};
  const k = {
    elemente: row.elements ?? null,
    gate: pct(loop.mutatesApplied ?? 0, (loop.mutatesApplied ?? 0) + (loop.mutatesRejected ?? 0)),
    mod: row.structure?.MOD ?? 0,
    dubletten: '—', ketten: '—', golden: '—', fokusEnde: '—', loesung: '—',
  };
  const audit = join(dir, 'audit.jsonl'), graph = join(dir, 'graph.json');
  if (existsSync(audit) && k.elemente) k.dubletten = pct(dubletten(readFileSync(audit, 'utf8')).anzahl, k.elemente);
  if (existsSync(graph)) {
    const g = ladeGraph(graph);
    if (golden) {
      const s = struktur([g], golden);
      k.ketten = `${s.ketten.mitEinerFunc}/${s.ketten.mitFunc}`;
      k.golden = pct(s.aehnlichGolden[0], 1);
    }
    const og = JSON.parse(readFileSync(graph, 'utf8'));
    const { focusViolations } = await import(pathToFileURL(join(HERE, '..', '..', 'dist', 'kernel', 'measure', 'focus-set.js')).href);
    k.fokusEnde = String(focusViolations(og, evaluateAllRules(og, DEFAULT_METRIC_POLICY), 'kern').length);
  }
  if (existsSync(audit) && existsSync(join(dir, 'run-raw.log'))) {
    const s = await nachspielen(dir);
    const fokus = s.nachspielbar ? s.zeilen.filter((z) => z.regel) : [];
    if (fokus.length) k.loesung = pct(fokus.filter((z) => z.geloest).length, fokus.length);
  }
  return k;
}

/** Die Tabellenzeile einer Runde. */
export function zeile(datum, anlass, rows, ks) {
  const j = (f) => ks.map(f).join(' / ');
  const runden = [...new Set(rows.map((r) => r.tokens?.loop?.genRounds ?? '?'))].join('–');
  return `| ${datum} | ${anlass} | ${rows.length} × ${runden} | ${j((k) => k.elemente)} | ${j((k) => k.gate)} | ${j((k) => k.dubletten)} `
    + `| ${j((k) => k.ketten)} | ${j((k) => k.golden)} | ${j((k) => k.fokusEnde)} | ${j((k) => k.loesung)} | ${j((k) => k.mod)} |`;
}

/** Hängt die Zeile an `verlauf.md` an (legt die Datei mit Kopf an, wenn sie fehlt). */
export function anhaengen(z, pfad = VERLAUF) {
  const alt = existsSync(pfad) ? readFileSync(pfad, 'utf8').trimEnd() : KOPF.join('\n');
  writeFileSync(pfad, `${alt}\n${z}\n`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [datei, anlass, datum = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  if (!datei || !anlass) {
    console.error('node verlauf.mjs <results-….json> "<Anlass>" [Datum]');
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(join(HERE, datei), 'utf8')).filter((r) => !r.error);
  const gPfad = rows.find((r) => r.stempel?.golden?.pfad)?.stempel.golden.pfad;
  const golden = gPfad && existsSync(gPfad) ? ladeGraph(gPfad) : null;
  const ks = [];
  for (const r of rows) ks.push(await laufKennzahlen(r, join(HERE, 'runs', `${r.arm}-${r.run}`), golden));
  const z = zeile(datum, anlass, rows, ks);
  anhaengen(z);
  console.log(z);
}
