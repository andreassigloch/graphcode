/**
 * auswertung.mjs — Kennzahlen eines interaktiven Laufs und seine Zeile in docs/messung/interaktiv.md (CR-GC-715).
 *
 * T-E3 der Leitlinie rechnet aus diesen Artefakten: Spanne der Zugdauer, Fragen in Zug 1, Gate-Ablehnungen und —
 * getrennt, über blindurteil.mjs — die Qualität der Spec gegen das Raster des Korpus.
 *
 * @author andreas@siglochconsulting
 */
import { appendFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fragen, bisKern } from './simulator.mjs';

export const TABELLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'messung', 'interaktiv.md');

const KOPF = `# Interaktives Rig (CR-GC-715)

Eine Zeile je Lauf, geschrieben von \`rig/interaktiv/treiber.mjs\`. Korpus, Simulator und Arme: \`rig/README.md\`
(Abschnitt „interaktiv"). Dauer in Minuten; „Schritte" = Werkzeugaufrufe je Zug; „Ablehnungen" = vom Gate
abgelehnte Mutationen. Das Blindurteil steht je Runde unter der Tabelle.

| Datum | Arm | Lauf | Stempel | Modell | Züge · Ende | Dauer je Zug Median / Max | Fragen Zug 1 | Schritte Median / Max | Mutationen angenommen / abgelehnt | Abbrüche Länge / Fehler | Elemente · Kanten |
|---|---|---|---|---|---|---|---|---|---|---|---|
`;

const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const min = (ms) => (ms / 60_000).toFixed(1);

/** Rein: die Kennzahlen eines Laufs aus seinem Protokoll. */
export function kennzahlen(lauf) {
  const z = lauf.zuege;
  const dauer = z.map((x) => x.dauerMs);
  const schritte = z.map((x) => x.werkzeuge.length);
  return {
    zuege: z.length,
    ende: lauf.ende,
    dauerMedian: median(dauer),
    dauerMax: Math.max(0, ...dauer),
    fragenZug1: z.length ? fragen(z[0].text).length : 0,
    schritteMedian: median(schritte),
    schritteMax: Math.max(0, ...schritte),
    angenommen: z.reduce((a, x) => a + x.audit.angenommen, 0),
    abgelehnt: z.reduce((a, x) => a + x.audit.abgelehnt, 0),
    // Ältere Läufe trugen keine Abbrüche — „—" statt einer erfundenen 0.
    abbruch: z.every((x) => x.abbruch) ? { laenge: z.reduce((a, x) => a + x.abbruch.laenge, 0), fehler: z.reduce((a, x) => a + x.abbruch.fehler, 0) } : null,
  };
}

export function zeile(datum, lauf, k) {
  const g = lauf.graph ? `${lauf.graph.elements} · ${lauf.graph.traces}` : '—';
  return `| ${datum} | ${lauf.arm} | ${lauf.nr} | ${lauf.stempel} | ${lauf.modell} | ${k.zuege} · ${k.ende} | ${min(k.dauerMedian)} / ${min(k.dauerMax)} | ${k.fragenZug1} | ${k.schritteMedian} / ${k.schritteMax} | ${k.angenommen} / ${k.abgelehnt} | ${k.abbruch ? `${k.abbruch.laenge} / ${k.abbruch.fehler}` : '—'} | ${g} |\n`;
}

export function anhaengen(z, pfad = TABELLE) {
  if (!existsSync(pfad)) writeFileSync(pfad, KOPF);
  appendFileSync(pfad, z);
}

/** Audit-Zeilen eines Zugs → angenommene und abgelehnte Mutationen. */
export function auditDelta(zeilen) {
  const mut = zeilen.map((l) => JSON.parse(l)).filter((a) => a.operation === 'mutate');
  return { angenommen: mut.filter((a) => a.result === 'applied').length, abgelehnt: mut.filter((a) => a.result === 'rejected').length };
}

/**
 * Normierung auf den Kern (Entscheid Autor 2026-10-04): ein Lauf, der über den Kern hinaus lief, wird beim ersten
 * Analyse-Vorschlag geschnitten. Die Züge bis dorthin geben die Kennzahlen; der Graph an diesem Punkt entsteht
 * neu aus dem Audit (die angewandten Mutationen dieser Züge, in Reihenfolge, durch das echte Gate eines
 * Wegwerf-Stores) — gemessen wird er wie jeder Export über `openMeasured`.
 */
export async function normieren(dir) {
  const lauf = JSON.parse(readFileSync(join(dir, 'lauf.json'), 'utf8'));
  const zuege = bisKern(lauf.zuege);
  if (!zuege) throw new Error(`${dir}: kein Zug mit Analyse-Vorschlag — der Kern wurde nicht fertig`);
  const n = zuege.reduce((a, z) => a + z.audit.angenommen + z.audit.abgelehnt, 0);
  // Ein abgebrochener Lauf hat sein Audit nur im Lauf-Repo (kopiert wird erst am Ende).
  const auditPfad = existsSync(join(dir, 'audit.jsonl')) ? join(dir, 'audit.jsonl') : join(dir, 'todo', '.graphcode', 'audit.jsonl');
  const audit = readFileSync(auditPfad, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((a) => a.operation === 'mutate');
  const angewandt = audit.slice(0, n).filter((a) => a.result === 'applied');

  const { openMeasured, stampLine } = await import('../../dist/index.js');
  const { commandsToFormatE } = await import('@sigloch/graph-api-core');
  const repo = join(dir, 'todo');
  const leer = await openMeasured({ systemId: 'todo', configFrom: repo });
  let flach;
  try {
    for (const a of angewandt) {
      const typ = (uid) => leer.graph().nodes.find((x) => x.uid === uid)?.type;
      const r = await leer.tools.graph_mutate.handler({ formatE: commandsToFormatE(a.commands, typ), consumerId: 'normieren' });
      if (!r.success) throw new Error(`${dir}: Audit-Eintrag ${a.id} geht beim Nachspielen nicht durchs Gate`);
    }
    const g = leer.graph();
    flach = {
      elements: g.nodes.map((x) => ({ id: x.uid, type: x.type, name: x.name, description: x.description, attributes: x.attributes ?? {} })),
      traces: g.edges.map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType, ...(e.attributes?.label ? { label: e.attributes.label } : {}) })),
    };
  } finally {
    await leer.close();
  }
  const pfad = resolve(dir, 'graph-kern.json');
  writeFileSync(pfad, JSON.stringify(flach, null, 1));
  const m = await openMeasured({ graph: pfad, systemId: 'todo', configFrom: repo });
  try {
    const kern = { ...lauf, ende: `kern (normiert, Zug ${zuege.length}/${lauf.zuege.length})`, zuege, stempel: stampLine(m.provenance).replace(`${resolve(dir)}/`, '').replace(`${dir.replace(/\/$/, '')}/`, ''),
      modell: lauf.modell ?? JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8')).model,
      graph: { elements: m.provenance.graph.elements, traces: m.provenance.graph.traces } };
    return kern;
  } finally {
    await m.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [schritt, ...dirs] = process.argv.slice(2);
  if (schritt !== 'normieren' || dirs.length === 0) {
    console.error('node rig/interaktiv/auswertung.mjs normieren <lauf-dir> …');
    process.exit(1);
  }
  for (const d of dirs) {
    const kern = await normieren(d);
    anhaengen(zeile(new Date().toISOString().slice(0, 10), kern, kennzahlen(kern)));
    console.log(`${d}: ${kern.ende} · ${kern.stempel}`);
  }
}
