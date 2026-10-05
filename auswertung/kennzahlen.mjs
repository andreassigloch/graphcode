/**
 * kennzahlen.mjs — wie ein Lauf lief, aus `lauf.json` allein (Leitlinie T-E3): Züge, Sitzungen, Dauer je Zug,
 * Fragen in Zug 1, Werkzeugschritte, Mutationen angenommen/abgelehnt, Abbrüche, der Zug, in dem SRR bzw. PDR
 * fiel, Umfang des Graphen. Rein; `auditDelta` zählt die Mutationen eines Zugs aus den Audit-Zeilen, die er
 * hinterließ (der Treiber ruft es je Zug).
 *
 * @author andreas@siglochconsulting
 */
import { fragen } from '../rig/simulator.mjs';

const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Audit-Zeilen eines Zugs → angenommene und abgelehnte Mutationen. */
export function auditDelta(zeilen) {
  const mut = zeilen.map((l) => JSON.parse(l)).filter((a) => a.operation === 'mutate');
  return { angenommen: mut.filter((a) => a.result === 'applied').length, abgelehnt: mut.filter((a) => a.result === 'rejected').length };
}

/**
 * Der Zug, ab dem das Gate bestanden blieb — null, wenn es am Ende nicht bestanden ist. Nicht der erste Treffer:
 * PDR steht bei leerem Graphen formal auf „bestanden" (keine Funktion, keine Lücke) und fällt mit der ersten Funktion.
 */
const gateZug = (zuege, gate) => {
  if (!zuege.length || !zuege.at(-1).gates?.[gate]) return null;
  let i = zuege.length - 1;
  while (i > 0 && zuege[i - 1].gates?.[gate]) i--;
  return zuege[i].zug;
};

export function kennzahlen(lauf) {
  const z = lauf.zuege ?? [];
  const dauer = z.map((x) => x.dauerMs);
  const schritte = z.map((x) => x.werkzeuge.length);
  return {
    zuege: z.length,
    sitzungen: lauf.sitzungen ?? new Set(z.map((x) => x.sitzung ?? 1)).size,
    ende: lauf.ende,
    dauerMedianMs: median(dauer),
    dauerMaxMs: Math.max(0, ...dauer),
    fragenZug1: z.length ? fragen(z[0].text).length : 0,
    schritteMedian: median(schritte),
    schritteMax: Math.max(0, ...schritte),
    angenommen: z.reduce((a, x) => a + x.audit.angenommen, 0),
    abgelehnt: z.reduce((a, x) => a + x.audit.abgelehnt, 0),
    // Läufe ohne Abbruch-Zählung tragen null — „—" statt einer erfundenen 0.
    abbruch: z.length && z.every((x) => x.abbruch) ? { laenge: z.reduce((a, x) => a + x.abbruch.laenge, 0), fehler: z.reduce((a, x) => a + x.abbruch.fehler, 0) } : null,
    gateZug: { SRR: gateZug(z, 'SRR'), PDR: gateZug(z, 'PDR') },
    elemente: lauf.graph?.elements ?? null,
    kanten: lauf.graph?.traces ?? null,
  };
}
