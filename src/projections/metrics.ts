/**
 * tools/metrics.ts — die ARCHITEKTUR-KENNZAHLEN je Modul (CR-GC-326).
 *
 * Eigene Gruppe, nicht in `tools/report.ts`: dessen Größen-Guard (CR-GC-256 §6)
 * sagt „der nächste Reporting-Tool splittet die Datei, sie wächst nicht" — und
 * die Datei steht seit CR-GC-325 über 500 Zeilen.
 *
 * Dünnes Binding auf `moduleMetrics()` aus `@sigloch/contracts/se` (CR-SM-232).
 * KEINE Rechnung hier: dieselbe Funktion, aus der MT-01/MT-02 ihre Verstöße
 * ableiten, liefert die Zahlen — sonst stünde die Instabilitätsformel ein zweites
 * Mal im Baum und liefe von den Regeln weg. Der eine Adapter ist die
 * Graph→OntologyGraph-Abbildung, und das ist die EINE aus `conformance.ts`
 * (CR-GC-303/324), kein Export-Encoding.
 *
 * Read-only. Schwellenlos: die Kohäsion trägt bewusst keine Ampel (CR-SM-223);
 * wer sie ampeln will, tut das im Konsumenten.
 *
 * CR-GC-451: dazu `fit` — der ℝ⁶-IST-Vektor auf der Architektur-Ebene. Er wurde
 * längst gerechnet und entschied über jede `graph_suggest`-Empfehlung, kam aber
 * an kein Tool; ein Dashboard konnte deshalb nur die Zielrichtung zeigen und
 * musste daneben schreiben, dass es den Ist-Wert nicht gibt. Auch hier KEINE
 * eigene Rechnung: `archMetrics` (fit-advisory.ts) ist dieselbe Funktion, aus
 * der das Δm-Advisory seine Differenz bildet.
 *
 * CR-GC-767: dazu `chains` und `measurability` — die Kennzahlen je FCHAIN und die
 * Quote der bewertbaren Ketten. Wieder KEINE Rechnung hier: `chainMetrics()` aus
 * contracts (CR-SM-404) liefert beides in einem Ergebnis, damit die Quote nie ohne
 * die Werte reist und die Werte nie ohne die Quote.
 *
 * CR-GC-787: dazu `riskCarriers` (immer) und `scope` (nur auf Anfrage) — wer ein Risiko trägt und
 * was eine Analyse einer Funktionsmenge lesen muss. Beides rechnet contracts (`riskCarriers`,
 * `requirementScope`, CR-SM-407); hier steht nur die Prüfung, dass jede angefragte Kennung eine
 * Funktion oder Kette des Modells ist. contracts lässt jeden anderen Seed still fallen, und ein
 * Umfang, der dann nur die Systemanforderungen nennt, sähe aus wie eine Antwort.
 *
 * CR-GC-857: dazu `constraintCarriers` (nur auf Anfrage) — die Träger jeder nicht-funktionalen
 * Anforderung ohne Rolle, aus contracts (CR-SM-418). `se-vorbereitung` §2 liest sie.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import {
  moduleMetrics,
  functionCriticality,
  chainMetrics,
  requirementScope,
  riskCarriers,
  constraintCarriers,
  ChainMetrics,
  ConstraintCarriers,
  RequirementScope,
  RiskCarriers,
  ModuleMetrics,
  FunctionCriticality,
  MetricPolicySchema,
} from '@sigloch/contracts/se';
import { MetricVector } from '@sigloch/se-engine';
import { PolicySourceSchema } from '../kernel/config.js';
import { toOntologyGraph } from '../kernel/conformance.js';
import { archMetrics } from '../kernel/measure/fit-advisory.js';
import type { MCPTool, MCPToolRegistry, ToolPort } from '../kernel/tool-contract.js';

const GraphMetricsInputSchema = z.looseObject({
  scope: z
    .array(z.string())
    .min(1)
    .optional()
    .describe('FUNC or FCHAIN ids; adds the block `scope` (what an analysis of them has to read).'),
  constraintCarriers: z
    .boolean()
    .optional()
    .describe('true adds `constraintCarriers`: carriers of every constraint.'),
});

/**
 * CR-GC-821: die Antwort von graph_metrics als EIN pruefbarer Vertrag (SCHEMA-metrics-answer).
 * Zusammengesetzt aus den Vertraegen der Bloecke, nicht nachgebaut: jede Grundgesamtheit
 * behaelt ihren eigenen Vertrag aus contracts oder se-engine.
 */
export const GraphMetricsAnswerSchema = z.object({
  modules: z.array(ModuleMetrics),
  /**
   * CR-GC-518: Kritikalitaet je FUNC — Wirkketten und Use Cases darueber (CR-SM-314).
   *
   * EIGENER Vertrag neben "modules", nicht dieselbe Liste breiter: es ist eine andere
   * Grundgesamtheit auf einem anderen Baum. MOD ist der Abhaengigkeitsbaum, FUNC der
   * Wertbaum, und sie spiegeln einander ausdruecklich nicht.
   */
  functions: z.array(FunctionCriticality),
  /**
   * CR-GC-767: eine Zeile je FCHAIN — die Kennzahlen, oder `reasons` statt jeder Zahl, wenn
   * die Kette nicht bewertbar ist. Graph-Reihenfolge, keine Rangfolge: die Zahl urteilt nicht.
   */
  chains: ChainMetrics.shape.chains,
  /** Die Reichweite von `chains`: bewertbare / alle Ketten; `ratio` ist `null` ohne Ketten. */
  measurability: ChainMetrics.shape.measurability,
  /**
   * CR-GC-787: je Risiko seine Träger (Blattfunktionen) und Erfüller, je Träger seine Risiken.
   * Immer da; ohne Risiken zwei leere Listen.
   */
  riskCarriers: RiskCarriers,
  /** CR-GC-787: der Betrachtungsumfang der angefragten Funktionen und Ketten — nur mit Eingabe `scope`. */
  scope: RequirementScope.optional(),
  /**
   * CR-GC-857: je Constraint (nicht-funktionale REQ ohne Rolle an Modul, Kette oder System) seine
   * Träger und Erfüller — nur mit Eingabe `constraintCarriers: true`. Am eigenen Modell rund 33 KB,
   * deshalb nicht in jeder Antwort.
   */
  constraintCarriers: ConstraintCarriers.optional(),
  policy: MetricPolicySchema,
  policySource: PolicySourceSchema,
  /** CR-GC-451: der ℝ⁶-Ist-Vektor. CR-GC-861: ohne Zielmarke — Gewichte und Zielwerte sind zurueckgebaut. */
  fit: z.object({
    layer: z.literal('arch'),
    metrics: MetricVector,
  }),
  graphVersion: z.number().int(),
});
export type GraphMetricsAnswer = z.infer<typeof GraphMetricsAnswerSchema>;

export function bindMetricsTools(ctx: ToolPort) {
  const { harness, graphVersion } = ctx;

  const graph_metrics: MCPTool<typeof GraphMetricsInputSchema, GraphMetricsAnswer> = {
    name: 'graph_metrics',
    description:
      'Which module is the coupling problem? One row per MOD — fan-in/out, instability, LCOM4, ' +
      'cohesion — each next to the threshold it was judged against. Take it when graph_readiness says ' +
      'a dimension is weak and you need to know WHICH module; a value without its threshold is not a ' +
      'statement. Also `chains` per FCHAIN, `riskCarriers` per risk, and with `scope` (FUNC/FCHAIN ' +
      'ids) what an analysis of them has to read. ' +
      '`graph_help({token:"graph_metrics"})` explains the figures. Read-only.',
    inputSchema: GraphMetricsInputSchema,
    async handler(input) {
      // CR-GC-329: Wert UND Schwelle aus EINER Antwort. Ein Konsument, der „71 % /
      // Ziel <= 70 %" zeichnet, hat beide Zahlen von hier und keinen eigenen Zielwert;
      // `policySource` sagt, ob sie aus `graphcode.config.jsonc` stammt oder der
      // benannte contracts-Startwert ist — verschwiegen wird nichts.
      const { config, source } = harness.getGraphcodeConfig();
      const graph = harness.getGraph();
      const metrics = archMetrics(graph);
      const ontology = toOntologyGraph(graph);
      const chains = chainMetrics(ontology);
      // CR-GC-787: eine Kennung, die keine Funktion oder Kette dieses Modells ist, wird benannt
      // abgelehnt — die ganze Anfrage, nicht nur der eine Seed.
      if (input.scope) {
        const typeOf = new Map(ontology.elements.map((e) => [e.id, e.type]));
        const fremd = input.scope.filter((id) => typeOf.get(id) !== 'FUNC' && typeOf.get(id) !== 'FCHAIN');
        if (fremd.length > 0) {
          const benannt = fremd.map((id) => (typeOf.has(id) ? `'${id}' (${typeOf.get(id)})` : `'${id}' (unknown)`));
          throw new Error(
            `graph_metrics: scope takes ids of FUNC or FCHAIN elements of this model; rejected: ${benannt.join(', ')}. ` +
              "`graph_elements({type:'FCHAIN'})` lists the chains.",
          );
        }
      }
      return GraphMetricsAnswerSchema.parse({
        modules: moduleMetrics(ontology),
        functions: functionCriticality(ontology),
        chains: chains.chains,
        measurability: chains.measurability,
        riskCarriers: riskCarriers(ontology),
        ...(input.scope ? { scope: requirementScope(ontology, input.scope) } : {}),
        ...(input.constraintCarriers ? { constraintCarriers: constraintCarriers(ontology) } : {}),
        policy: config.metricPolicy,
        policySource: source,
        fit: { layer: 'arch', metrics },
        graphVersion: graphVersion(),
      });
    },
  };

  return { graph_metrics } satisfies MCPToolRegistry;
}
