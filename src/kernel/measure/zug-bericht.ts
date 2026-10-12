/**
 * zug-bericht.ts — die Berichte zu einem angenommenen Zug (CR-GC-778).
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
 * CR-GC-790: dazu im Probelauf `metricsAfter` — die Zeilen der Kennzahlen, die der Zug aendert, im
 * Stand danach. Ein Probelauf schreibt nichts, `graph_metrics` misst danach also den alten Stand; der Stand danach
 * liegt nur in diesem Paar vor. KEINE Rechnung hier: dieselben vier Funktionen aus contracts, die
 * `graph_metrics` aufruft, auf beiden Staenden, und heraus geht, was sich unterscheidet.
 *
 * Rein: zwei Graph-Staende und die Schwellen rein, Berichte raus. Kein Store, kein Dateisystem.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import {
  chainMetrics,
  moduleMetrics,
  functionCriticality,
  riskCarriers,
  ChainMetrics,
  ModuleMetrics,
  FunctionCriticality,
  RiskCarriers,
  type MetricPolicy,
} from '@sigloch/contracts/se';
import { toOntologyGraph } from '../conformance.js';
import { computeFitAdvisory, computeSteerAdvisory, FitAdvisory, SteerAdvisory } from './fit-advisory.js';
import { congruenceWorkOrder, WorkOrder } from './work-order.js';

const Kennungen = z.array(z.string());

/**
 * Die Zeilen von `graph_metrics`, die ein Zug aendert oder neu anlegt, im Stand danach — wortgleich
 * die Zeilen, die `graph_metrics` nach dem Anwenden liefert. `removed` nennt je Liste die Kennungen
 * der Zeilen, die es danach nicht mehr gibt. Lauter leere Listen heissen: der Zug aendert keine
 * Kennzahl. Das ist eine Aussage und steht deshalb da, statt zu fehlen.
 */
export const MetricsAfter = z.object({
  chains: ChainMetrics.shape.chains,
  modules: z.array(ModuleMetrics),
  functions: z.array(FunctionCriticality),
  riskCarriers: RiskCarriers,
  removed: z.object({ chains: Kennungen, modules: Kennungen, functions: Kennungen, risks: Kennungen, surface: Kennungen }),
});
export type MetricsAfter = z.infer<typeof MetricsAfter>;

/** Was sich zwischen zwei Listen von Zeilen unterscheidet: die Zeilen danach und die entfallenen Kennungen. */
function unterschied<T>(davor: readonly T[], danach: readonly T[], kennung: (zeile: T) => string): { zeilen: T[]; entfallen: string[] } {
  const alt = new Map(davor.map((z) => [kennung(z), JSON.stringify(z)]));
  const neu = new Set(danach.map(kennung));
  return {
    zeilen: danach.filter((z) => alt.get(kennung(z)) !== JSON.stringify(z)),
    entfallen: [...alt.keys()].filter((id) => !neu.has(id)),
  };
}

export function computeMetricsAfter(before: Graph, after: Graph): MetricsAfter {
  const davor = toOntologyGraph(before);
  const danach = toOntologyGraph(after);
  const chains = unterschied(chainMetrics(davor).chains, chainMetrics(danach).chains, (z) => z.chainId);
  const modules = unterschied(moduleMetrics(davor), moduleMetrics(danach), (z) => z.moduleId);
  const functions = unterschied(functionCriticality(davor), functionCriticality(danach), (z) => z.funcId);
  const traegerDavor = riskCarriers(davor);
  const traegerDanach = riskCarriers(danach);
  const risks = unterschied(traegerDavor.risks, traegerDanach.risks, (z) => z.riskId);
  const surface = unterschied(traegerDavor.surface, traegerDanach.surface, (z) => z.funcId);
  return {
    chains: chains.zeilen,
    modules: modules.zeilen,
    functions: functions.zeilen,
    riskCarriers: { risks: risks.zeilen, surface: surface.zeilen },
    removed: {
      chains: chains.entfallen,
      modules: modules.entfallen,
      functions: functions.entfallen,
      risks: risks.entfallen,
      surface: surface.entfallen,
    },
  };
}

/** Der Vertrag der Berichte — er quert die Grenze vom Messwerk zur Werkzeugschicht. */
export const ZugBericht = z.object({
  /** Nur im Probelauf: das Architekturmass blockt nicht, waehlt nicht und rankt nicht. */
  fitAdvisory: FitAdvisory.optional(),
  steerAdvisory: SteerAdvisory,
  workOrder: WorkOrder,
  /**
   * CR-GC-790: nur im Probelauf, dort immer, auch leer. Nach dem Schreiben misst `graph_metrics`
   * den Stand danach; dieselben Zeilen ein zweites Mal in jeder Schreibantwort waeren ein zweiter Kanal.
   */
  metricsAfter: MetricsAfter.optional(),
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
      // `fit` ist der Probelauf: beide Berichte haben nur dort einen Leser (CR-GC-778, CR-GC-790).
      ...(opts.fit ? { fitAdvisory: computeFitAdvisory(before, after), metricsAfter: computeMetricsAfter(before, after) } : {}),
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
