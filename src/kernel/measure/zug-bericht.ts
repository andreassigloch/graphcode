/**
 * zug-bericht.ts — die drei Berichte zu einem angewandten Zug (CR-GC-778).
 *
 * Architekturmass, Steuerwert und Dateiliste rechnete bis hierher das Gate selbst, nach dem
 * Speichern, und haengte sie an seine Antwort. Das Gate urteilt und speichert; berichten ist
 * nicht sein Geschaeft, und es zog das Messwerk in den Kern zurueck. Jetzt gibt das Gate den
 * Stand davor und danach heraus, und wer berichten will, rechnet HIER aus diesem Paar — die
 * Werkzeuge `graph_mutate` und `graph_suggest`, sonst niemand.
 *
 * Ein Bericht ist nie ein Urteil: scheitert die Messung, bleibt der Zug, was das Gate aus ihm
 * gemacht hat. Die Antwort nennt dann den fehlenden Bericht (`berichtFehlt`), statt ihn zu
 * verschweigen oder den Zug nachtraeglich als gescheitert zu melden.
 *
 * Rein: zwei Graph-Staende und die Schwellen rein, Berichte raus. Kein Store, kein Dateisystem.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { computeFitAdvisory, computeSteerAdvisory, FitAdvisory, SteerAdvisory } from './fit-advisory.js';
import { congruenceWorkOrder, WorkOrder } from './work-order.js';

/** Der Vertrag der Berichte — er quert die Grenze vom Messwerk zur Werkzeugschicht. */
export const ZugBericht = z.object({
  /** Nur auf Wunsch: das Architekturmass blockt nicht, waehlt nicht und rankt nicht. */
  fitAdvisory: FitAdvisory.optional(),
  steerAdvisory: SteerAdvisory,
  workOrder: WorkOrder,
});
export type ZugBericht = z.infer<typeof ZugBericht>;

export interface BerichtFehlt {
  berichtFehlt: string;
}

/** Was das Gate neben seinem Urteil herausgibt: das Paar, oder nichts bei einem geblockten Zug. */
export interface ZugStaende {
  before: Graph;
  after: Graph;
}

export function zugBericht(before: Graph, after: Graph, policy: MetricPolicy, opts: { fit: boolean }): ZugBericht | BerichtFehlt {
  try {
    return {
      ...(opts.fit ? { fitAdvisory: computeFitAdvisory(before, after) } : {}),
      steerAdvisory: computeSteerAdvisory(before, after, policy),
      workOrder: congruenceWorkOrder(before, after),
    };
  } catch (err) {
    return { berichtFehlt: `Bericht zum Zug nicht berechenbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Das Urteil des Gates mit den Berichten dazu. Ein geblockter Zug hat kein Paar und bleibt ohne Bericht. */
export function mitBericht<R extends object>(
  outcome: { result: R; states: ZugStaende | null },
  policy: MetricPolicy,
  opts: { fit: boolean },
): R & Partial<ZugBericht & BerichtFehlt> {
  if (!outcome.states) return outcome.result;
  return { ...outcome.result, ...zugBericht(outcome.states.before, outcome.states.after, policy, opts) };
}
