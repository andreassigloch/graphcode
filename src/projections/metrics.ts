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
import { moduleMetrics, type ModuleMetrics, type MetricPolicy } from '@sigloch/contracts/se';
import type { MetricVector } from '@sigloch/se-engine';
import type { PolicySource } from '../kernel/config.js';
import { toOntologyGraph } from '../kernel/conformance.js';
import { archMetrics } from './fit-advisory.js';
import { loadTargetProfile } from '../loop/target-profile.js';
import type { TargetWeights, TargetValues } from '../loop/target-profile-contract.js';
import type { MCPTool, MCPToolRegistry } from '../surface/mcp-tools.js';
import type { ToolContext } from '../surface/tool-context.js';

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

export function bindMetricsTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, graphVersion } = ctx;

  const graph_metrics: MCPTool<
    z.infer<typeof GraphMetricsInputSchema>,
    {
      modules: ModuleMetrics[];
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
      'Architecture metrics per MOD (CR-GC-326) — one row for EVERY module, whether or not a rule ' +
      'fires on it: {moduleId, moduleName, allocatedFuncs, fanIn, fanOut, instability, lcom4, ' +
      'cohesion:{internal,external,ratio}}. This is the drill-down under the `alloc`/`arch` scores of ' +
      'graph_readiness: the dimension score says "alloc is 87 %", this says WHICH module. ' +
      'MT-01 only reports modules above 70 % instability and MT-02 only those with >= 4 components, ' +
      'and both only inside a prose message — so below the threshold there was no value, there was ' +
      'nothing, and a trend ("was 62 %, is 68 %") was unobtainable. Same computation as the rules ' +
      '(contracts moduleMetrics, CR-SM-232), never a second one; parsing the MT-01 message string is ' +
      'obsolete. `null` never means 0: instability is null without any coupling, lcom4 below 2 ' +
      'allocated FUNCs, cohesion below 2 FUNCs or without an external connection — a value that is ' +
      'not measurable is not zero percent. Cohesion is deliberately THRESHOLD-FREE (CR-SM-223: a ' +
      'measurement must not masquerade as a defect); judge it, do not gate on it. Sorted worst ' +
      'cohesion first — the ranking IS the signal. CR-GC-329: the answer also carries the ' +
      'JUDGING THRESHOLDS it was measured against — `policy` {instability, lcom4:{info,warning}} ' +
      'plus `policySource` ("config" = graphcode.config.jsonc, "default" = the named contracts ' +
      'DEFAULT_METRIC_POLICY). Draw the traffic light from THIS answer; a consumer that keeps a ' +
      'target value of its own is a second source for the same number. `policy.instability: null` ' +
      'means measure, do not judge: MT-01 never fires, the instability value is still in every ' +
      'module row. CR-GC-451: `fit` carries the ℝ⁶ CURRENT-STATE vector on the architecture layer ' +
      '(`metrics`, the same measurement graph_suggest ranks its Δm against) TOGETHER WITH the target ' +
      'it is judged against (from .graphcode/target-profile.json, `target.source: \'none\'` when no ' +
      'profile exists — never an invented zero vector). Same rule as policy/policySource: value and ' +
      'target leave the host in ONE answer, a consumer that keeps a target of its own is a second ' +
      'source for the same number. CR-GC-457: the target has TWO fields, and they are not ' +
      'interchangeable. `target.weights` (−1…1) is the STEERING DIRECTION — L2-normalized, only its ' +
      'direction reaches graph_suggest\'s ranking (CR-GC-353); it is NOT a value on the metric scale, ' +
      'and rendering it next to `metrics` invites reading "raise (1.0)" beside a current 3.71 as ' +
      '"lower to 1.0". `target.values` (0…5) is the GOAL on the SAME scale as `metrics` — that is the ' +
      'number to draw a gap against; a dimension missing there has no goal, never an invented 2.5 ' +
      'midpoint. `target.inconsistent` lists dimensions where sign(weight) and sign(value − metrics) ' +
      'disagree (raise, but the goal sits below where we are). It is a WARNING, never a block: a ' +
      'deliberate trade-off is legitimate, an invisible one is not. `layer: \'arch\'` is part of the ' +
      'answer — this is NOT the global metrics(G); whoever compares must know against what. Read-only.',
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
