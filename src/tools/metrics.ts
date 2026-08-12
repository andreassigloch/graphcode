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
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import { moduleMetrics, type ModuleMetrics } from '@sigloch/contracts/se';
import { toOntologyGraph } from '../conformance.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

const GraphMetricsInputSchema = z.looseObject({});

export function bindMetricsTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, graphVersion } = ctx;

  const graph_metrics: MCPTool<
    z.infer<typeof GraphMetricsInputSchema>,
    { modules: ModuleMetrics[]; graphVersion: number }
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
      'cohesion first — the ranking IS the signal. Read-only.',
    inputSchema: GraphMetricsInputSchema,
    async handler(_input) {
      return {
        modules: moduleMetrics(toOntologyGraph(harness.getGraph())),
        graphVersion: graphVersion(),
      };
    },
  };

  return { graph_metrics };
}
