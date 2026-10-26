/**
 * constraints.ts — Prüffunktionen für Constraints (CR-GC-851, Konzept CR-GC-804).
 *
 * Ein Constraint ist eine nicht-funktionale Anforderung am Element mit verifizierendem TEST; die
 * Testdatei liest den committeten Snapshot und ruft eine dieser Funktionen. Je Antwortform eine
 * Funktion. Der Subpath `@sigloch/graphcode/constraints` exportiert sie, damit Constraint-Tests
 * anderer Repos dieselbe Prüfung rufen statt sie nachzubauen.
 *
 * Misst contracts schon (LCOM4, kreuzende Flüsse, Kettenkennzahlen), ruft die Prüffunktion diese
 * Messung und rechnet nicht nach. Die Lookups kommen aus dem Index von contracts (`indexOf`).
 *
 * Rein: Graph rein, Befund raus. Kein Store, kein Dateisystem.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { indexOf, type OntologyGraph } from '@sigloch/contracts/se';

/** Befund von `eingaengeNurAus`. Beide Listen leer = Constraint erfüllt. */
export const EingangsBefund = z.strictObject({
  /** Eingehende Flüsse außerhalb der erlaubten Liste, je mit den Elementen, die in ihn schreiben. */
  fremd: z.array(z.strictObject({ fluss: z.string(), absender: z.array(z.string()) })),
  /** Flüsse der erlaubten Liste, die im Modell nicht in das Element führen. */
  fehlend: z.array(z.string()),
});
export type EingangsBefund = z.infer<typeof EingangsBefund>;

/**
 * Eingänge eines Elements nur aus der erlaubten Liste.
 *
 * Eingang = jede `io`-Kante, die in `elementId` zeigt. Eine Ratsche in beide Richtungen: ein Fluss
 * außerhalb der Liste ist `fremd`, ein Fluss der Liste ohne Kante ins Element ist `fehlend`. So
 * kann die Liste weder still wachsen noch still veralten.
 */
export function eingaengeNurAus(
  graph: OntologyGraph,
  elementId: string,
  erlaubt: readonly string[],
): EingangsBefund {
  const idx = indexOf(graph);
  const erlaubtSet = new Set(erlaubt);
  const eingaenge = [...new Set(idx.in(elementId, 'io').map((t) => t.source))].sort();
  const fremd = eingaenge
    .filter((fluss) => !erlaubtSet.has(fluss))
    .map((fluss) => ({ fluss, absender: [...new Set(idx.in(fluss, 'io').map((t) => t.source))].sort() }));
  const vorhanden = new Set(eingaenge);
  const fehlend = [...erlaubtSet].filter((fluss) => !vorhanden.has(fluss)).sort();
  return EingangsBefund.parse({ fremd, fehlend });
}
