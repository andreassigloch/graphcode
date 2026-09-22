/**
 * zugvermerk.ts — das Gedächtnis des Executors zwischen zwei Zügen (CR-GC-614).
 *
 * **Der Graph ist das Gedächtnis, nicht der Gesprächsverlauf.** Gemessen am Spec-Lauf opus5-15
 * (2026-09-22): höchster Kontext 378k Tokens, davon ~220k (≈58 %) DENKBLÖCKE des Modells — mehr
 * als alles, was graphcode in dem Lauf lieferte. In Claude Code ist das nicht zu ändern. In
 * unserer eigenen Schleife schon: das Ergebnis eines Zuges steht im Graphen.
 *
 * Der Executor baut seine Nachrichtenliste deshalb je Runde NEU (`executor.ts`) — nichts aus einem
 * abgeschlossenen Zug reist mit. Das ist die halbe Wahrheit und war bis hierher die ganze: ohne
 * jede Erinnerung versucht die nächste Runde denselben Zug noch einmal, und der einzige
 * Gegendruck war ein Stagnations-Hinweis, der nur sagte "schon wieder", nicht WAS war.
 *
 * Hier steht die andere Hälfte: ein **benannter und begrenzter** Vermerk je Zug — welcher Fokus,
 * was versucht, was das Gate sagte. Neueste zuerst, hart bei `ZUGVERMERK_MAX` Zeichen
 * abgeschnitten, und der Schnitt wird ANGESAGT statt still zu passieren. Eine Obergrenze, die
 * niemand sieht, ist ein Kontextleck mit Verzögerung.
 *
 * @author andreas@siglochconsulting
 */

/** Ein abgeschlossener Zug, wie ihn die Runde hinterlässt. */
export interface Zug {
  /** 1-basiert, wie im Trace. */
  runde: number;
  /** Der Fokus, an dem gearbeitet wurde — `null`, wenn die Runde keinen hatte. */
  fokus: string | null;
  /** Was der Zug am Gate erreicht hat. */
  ergebnis: 'angewandt' | 'abgewiesen' | 'nichts';
  /** Die Regel-IDs der Abweisung, leer sonst. Regel-IDs, nie Regeltext. */
  regeln: string;
}

/**
 * Die Obergrenze des Vermerks in Zeichen.
 *
 * 1.200 ≈ 300 Tokens: genug für die letzten fünf bis acht Züge, und klein genug, dass der Vermerk
 * über 30 Runden nicht selbst zu dem wird, was er verhindern soll. Die Zahl steht hier und nicht
 * im Prompt-Text — eine Grenze, die man nicht messen kann, ist keine.
 */
export const ZUGVERMERK_MAX = 1_200;

/** Eine Zeile je Zug — kurz genug, dass fünf davon unter die Grenze passen. */
function zeile(z: Zug): string {
  const fokus = z.fokus ?? '—';
  const nach = z.ergebnis === 'abgewiesen' && z.regeln ? ` (${z.regeln})` : '';
  return `  R${z.runde} ${fokus}: ${z.ergebnis}${nach}`;
}

/**
 * Der Vermerk für die nächste Runde — leer, solange es nichts zu vermerken gibt.
 *
 * NEUESTE ZUERST: läuft der Platz aus, fehlt das Älteste, und das ist das Richtige — was gerade
 * abgewiesen wurde, wiegt mehr als der erste Zug der Sitzung. Wird gekürzt, sagt der Vermerk es
 * selbst; sonst liest das Modell eine kurze Liste als vollständige.
 */
export function zugvermerk(zuege: readonly Zug[], max = ZUGVERMERK_MAX): string {
  if (zuege.length === 0) return '';
  const kopf = 'BISHER IN DIESER SITZUNG (der Graph trägt das Ergebnis, hier steht nur der Weg):';
  const neueste = [...zuege].reverse();
  const zeilen: string[] = [];
  let laenge = kopf.length;
  let genommen = 0;
  for (const z of neueste) {
    const l = zeile(z);
    if (laenge + l.length + 1 > max) break;
    zeilen.push(l);
    laenge += l.length + 1;
    genommen += 1;
  }
  // Der Fall, dass nicht einmal EINE Zeile passt: dann ist der Vermerk leer und sagt das auch.
  if (genommen === 0) return '';
  const rest = zuege.length - genommen;
  const fuss = rest > 0 ? `\n  … ${rest} ältere Züge hier weggelassen (Grenze ${max} Zeichen).` : '';
  return `${kopf}\n${zeilen.join('\n')}${fuss}`;
}
