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
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import {
  moduleMetrics,
  functionCriticality,
  type ModuleMetrics,
  type FunctionCriticality,
  type MetricPolicy,
} from '@sigloch/contracts/se';
import type { MetricVector } from '@sigloch/se-engine';
import type { PolicySource } from '../kernel/config.js';
import { toOntologyGraph } from '../kernel/conformance.js';
import { archMetrics } from '../kernel/measure/fit-advisory.js';
import { loadTargetProfile } from '../loop/target-profile.js';
import type { TargetWeights, TargetValues } from '../loop/target-profile-contract.js';
import type { MCPTool, MCPToolRegistry, ToolPort } from '../kernel/tool-contract.js';

const GraphMetricsInputSchema = z.looseObject({});

/** Die Dimensionen, in denen Gewicht und Zielwert in verschiedene Richtungen zeigen. */
type Dimension = keyof TargetWeights;

/**
 * CR-GC-457: Gewicht und Zielwert sind zwei Felder mit zwei Aufgaben — und können
 * sich widersprechen. `coherence` mit Gewicht `+1` („heben") und Sollwert `3.0` bei
 * Ist `3.71` ist ein Profil, das in zwei Richtungen zeigt.
 *
 * Die Prüfung sitzt HIER und nicht im Loader: `loadTargetProfile` liest eine Datei
 * und kennt den Graphen nicht — ohne Ist-Wert ist der Widerspruch nicht entscheidbar.
 * Ergebnis ist eine Liste, kein Fehler: ein bewusster Zielkonflikt ist legitim
 * (dieselbe Linie wie `conflictWarnings`), ein unsichtbarer ist es nicht.
 */
function inconsistentDimensions(
  weights: TargetWeights,
  values: TargetValues,
  actual: MetricVector,
): Dimension[] {
  const out: Dimension[] = [];
  for (const dim of Object.keys(values) as Dimension[]) {
    const target = values[dim];
    const w = weights[dim] ?? 0;
    // Kein Gewicht = keine Steuerabsicht, also nichts, dem der Wert widersprechen
    // könnte. Gleichstand (Ziel === Ist) ist erreicht, nicht widersprüchlich.
    if (target === undefined || w === 0) continue;
    const gap = target - actual[dim];
    if (gap !== 0 && Math.sign(gap) !== Math.sign(w)) out.push(dim);
  }
  return out;
}

export function bindMetricsTools(ctx: ToolPort): MCPToolRegistry {
  const { harness, graphVersion } = ctx;

  const graph_metrics: MCPTool<
    z.infer<typeof GraphMetricsInputSchema>,
    {
      modules: ModuleMetrics[];
      /**
       * CR-GC-518: Kritikalitaet je FUNC — Wirkketten und Use Cases darueber (CR-SM-314).
       *
       * EIGENER Vertrag neben "modules", nicht dieselbe Liste breiter: es ist eine andere
       * Grundgesamtheit auf einem anderen Baum. MOD ist der Abhaengigkeitsbaum, FUNC der
       * Wertbaum, und sie spiegeln einander ausdruecklich nicht.
       */
      functions: FunctionCriticality[];
      policy: MetricPolicy;
      policySource: PolicySource;
      fit: {
        layer: 'arch';
        metrics: MetricVector;
        target: {
          weights: TargetWeights;
          values: TargetValues;
          source: 'profile' | 'none';
          inconsistent: Dimension[];
        };
      };
      graphVersion: number;
    }
  > = {
    name: 'graph_metrics',
    description:
      'Which module is the coupling problem? One row per MOD — fan-in/out, instability, LCOM4, ' +
      'cohesion — each next to the threshold it was judged against. Take it when graph_readiness says ' +
      'a dimension is weak and you need to know WHICH module; a value without its threshold is not a ' +
      'statement. `graph_help({id:"graph_metrics"})` explains the figures. Read-only.',
    inputSchema: GraphMetricsInputSchema,
    async handler(_input) {
      // CR-GC-329: Wert UND Schwelle aus EINER Antwort. Ein Konsument, der „71 % /
      // Ziel <= 70 %" zeichnet, hat beide Zahlen von hier und keinen eigenen Zielwert;
      // `policySource` sagt, ob sie aus `graphcode.config.jsonc` stammt oder der
      // benannte contracts-Startwert ist — verschwiegen wird nichts.
      const { config, source } = harness.getGraphcodeConfig();
      const graph = harness.getGraph();
      // CR-GC-451: Wert UND Zielmarke aus EINER Antwort — dieselbe Regel wie
      // policy/policySource oben. Kein Profil heißt `source: 'none'` mit leeren
      // Gewichten; ein erfundener Nullvektor sähe aus wie „überall neutral
      // entschieden" und ist etwas anderes als „nie entschieden".
      const profile = loadTargetProfile(harness.getRepoRoot());
      // CR-GC-457: der Zielwert steht auf DERSELBEN Skala wie `metrics` (0–5), das
      // Gewicht daneben auf seiner eigenen (−1…1). Beide reisen mit, weil sie zwei
      // Fragen beantworten — „wohin" und „wie dringend" —, und `inconsistent` sagt,
      // wo die zwei Antworten einander widersprechen.
      const metrics = archMetrics(graph);
      const weights = profile?.profile.weights ?? {};
      const values = profile?.profile.values ?? {};
      return {
        modules: moduleMetrics(toOntologyGraph(graph)),
        functions: functionCriticality(toOntologyGraph(graph)),
        policy: config.metricPolicy,
        policySource: source,
        fit: {
          layer: 'arch',
          metrics,
          target: {
            weights,
            values,
            source: profile ? 'profile' : 'none',
            inconsistent: inconsistentDimensions(weights, values, metrics),
          },
        },
        graphVersion: graphVersion(),
      };
    },
  };

  return { graph_metrics };
}
