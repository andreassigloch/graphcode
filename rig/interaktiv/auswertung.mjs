/**
 * auswertung.mjs — Kennzahlen eines interaktiven Laufs und seine Zeile in docs/messung/interaktiv.md (CR-GC-715).
 *
 * T-E3 der Leitlinie rechnet aus diesen Artefakten: Spanne der Zugdauer, Fragen in Zug 1, Gate-Ablehnungen und —
 * getrennt, über blindurteil.mjs — die Qualität der Spec gegen das Raster des Korpus.
 *
 * @author andreas@siglochconsulting
 */
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fragen } from './simulator.mjs';

export const TABELLE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'messung', 'interaktiv.md');

const KOPF = `# Interaktives Rig (CR-GC-715)

Eine Zeile je Lauf, geschrieben von \`rig/interaktiv/treiber.mjs\`. Korpus, Simulator und Arme: \`rig/README.md\`
(Abschnitt „interaktiv"). Dauer in Minuten; „Schritte" = Werkzeugaufrufe je Zug; „Ablehnungen" = vom Gate
abgelehnte Mutationen. Das Blindurteil steht je Runde unter der Tabelle.

| Datum | Arm | Lauf | Stempel | Modell | Züge · Ende | Dauer je Zug Median / Max | Fragen Zug 1 | Schritte Median / Max | Mutationen angenommen / abgelehnt | Elemente · Kanten |
|---|---|---|---|---|---|---|---|---|---|---|
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
  };
}

export function zeile(datum, lauf, k) {
  const g = lauf.graph ? `${lauf.graph.elements} · ${lauf.graph.traces}` : '—';
  return `| ${datum} | ${lauf.arm} | ${lauf.nr} | ${lauf.stempel} | ${lauf.modell} | ${k.zuege} · ${k.ende} | ${min(k.dauerMedian)} / ${min(k.dauerMax)} | ${k.fragenZug1} | ${k.schritteMedian} / ${k.schritteMax} | ${k.angenommen} / ${k.abgelehnt} | ${g} |\n`;
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
