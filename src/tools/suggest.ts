/**
 * tools/suggest.ts — die GENERIERUNGS-/OPTIMIERUNGS-Tools (MOD-mcp-tools):
 * graph_suggest (CR-GC-273) + graph_generate (CR-GC-275).
 *
 * Dünnes MCP-Binding auf @sigloch/se-optimizer (aimpro-Fahrplan-Schritt 3):
 * gegeben eine Zielrichtung im ℝ⁶-Metrikraum, ranke die feuernden
 * Operator-Regeln nach Δm·t̂. Ausgeliefert wird die FUND-EBENE (Violation +
 * Richtung + Δm) — ein konkreter Edit nur, wenn ein rule-spezifisches
 * Fix-Template ihn deterministisch aus dem Elementtext herleitet (Spike-2:
 * kein generisch synthetisierter Edit war unverändert anwendbar).
 *
 * NIE auto-apply: jeder Template-Edit wird als dryRun durchs volle Gate
 * geschickt (CR-GC-234) und kommt mit dem 3-Tier-Verdict zurück; anwenden
 * muss ihn der Consumer selbst über graph_mutate. Nach jedem Preview wird
 * die In-Memory-Kopie via loadGraph() restauriert — das Tool ist read-only.
 */
import { z } from 'zod/v4';
import type { OntologyGraph } from '@sigloch/contracts/se';
import type { MutateResult } from '@sigloch/contracts/harness';
import { targetFor, suggestEdits, type Suggestion } from '@sigloch/se-optimizer';
import { exportGraphJson } from '../exporter.js';
import { generationStep, type GenerationStep } from '../generate.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schema
// -------------------------------------------------------------------------

const weight = z.number().min(-1).max(1);

const GraphSuggestInputSchema = z.object({
  target: z
    .object({
      modifiability: weight.optional(),
      faultTolerance: weight.optional(),
      flowEfficiency: weight.optional(),
      coherence: weight.optional(),
      viability: weight.optional(),
      scalability: weight.optional(),
    })
    .describe(
      'Zielrichtung im Metrikraum: Gewicht je Dimension in [-1,1] (>0 heben, <0 senken; ' +
        'fehlend = 0). Beispiel {"scalability": 1} = "raise scalability".',
    ),
  k: z.number().int().positive().max(20).default(5).describe('Top-k Suggestions (Default 5).'),
  layer: z
    .enum(['all', 'arch'])
    .default('arch')
    .describe("Messebene für Δm: 'arch' = Architektur-Teilgraph (FUNC/FLOW/MOD/SCHEMA/ACTOR), 'all' = ganzer Graph."),
});

// -------------------------------------------------------------------------
// Output types
// -------------------------------------------------------------------------

export interface SuggestVerdict {
  /** Der 3-Tier-Gate-Spruch für den Template-Edit (dryRun, nichts persistiert). */
  tier: MutateResult['tier'];
  success: boolean;
  violations: { ruleId: string; severity: string; message: string }[];
}

export interface GraphSuggestResult {
  /** Aufgelöster Zielvektor (ℝ⁶, kanonische Dimensionsordnung). */
  target: number[];
  layer: 'all' | 'arch';
  suggestions: (Suggestion & { verdict?: SuggestVerdict })[];
}

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindSuggestTools(ctx: ToolContext): MCPToolRegistry {
  const { harness, serializeToolWrite } = ctx;

  const graph_suggest: MCPTool<z.infer<typeof GraphSuggestInputSchema>, GraphSuggestResult> = {
    name: 'graph_suggest',
    description:
      'Greedy-1-Schritt-Optimierungsvorschläge: ranke die feuernden Operator-Regeln danach, wie weit ' +
      'ihr Edit den Graphen entlang der Zielrichtung im 6-Metrik-Raum bewegt (score = Δm·t̂). Liefert ' +
      'die Fund-Ebene (Violation + Richtung + Δm); ein konkreter Edit nur aus rule-spezifischen ' +
      'Fix-Templates — jeder mit dryRun-Gate-Verdict (3-Tier). Wendet NIE selbst an: Edits gehen ' +
      'über graph_mutate. Read-only; die Metrik rankt, das Gate urteilt.',
    inputSchema: GraphSuggestInputSchema,
    async handler(input) {
      const og = JSON.parse(exportGraphJson(harness.getGraph())) as OntologyGraph;
      const target = targetFor(input.target);
      const suggestions = suggestEdits(og, target, { k: input.k, layer: input.layer });

      // dryRun-Preview der Template-Edits auf der Schreibkette (kein Interleaving
      // mit echten Writes); nach jedem Preview zurück auf die Disk-Basis, damit
      // jeder Edit gegen DENSELBEN Stand beurteilt wird und nichts liegen bleibt.
      const verdicts = await serializeToolWrite(async () => {
        const out: (SuggestVerdict | undefined)[] = [];
        for (const s of suggestions) {
          if (!s.edit) {
            out.push(undefined);
            continue;
          }
          const res = await harness.mutate(
            [{ op: 'add-edge', edge: { sourceId: s.edit.source, targetId: s.edit.target, edgeType: s.edit.type, attributes: {} } }],
            { dryRun: true },
          );
          await harness.loadGraph();
          out.push({
            tier: res.tier,
            success: res.success,
            violations: res.violations.map((v) => ({ ruleId: v.ruleId, severity: v.severity, message: v.message })),
          });
        }
        return out;
      });

      return {
        target,
        layer: input.layer,
        suggestions: suggestions.map((s, i) => (verdicts[i] ? { ...s, verdict: verdicts[i] } : s)),
      };
    },
  };

  const GraphGenerateInputSchema = z.object({
    intent: z
      .string()
      .optional()
      .describe(
        'Die Systemintention als Prosa (1 Absatz). Nur beim Kaltstart nötig — sobald ein SYS existiert, ' +
          'wird sie aus dessen description gelesen.',
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.8)
      .describe('Readiness-Schwelle je Dimension für den Handoff auf graph_suggest (Default 0.8).'),
    defer: z
      .array(z.string())
      .optional()
      .describe(
        'Zurückgestellte focusKeys (aus GenerationStep.focusKey): diese Fund-Sets werden bei der ' +
          'Fokus-Wahl deterministisch übersprungen; sind alle Kandidaten zurückgestellt, wird defer ignoriert.',
      ),
  });

  const graph_generate: MCPTool<z.infer<typeof GraphGenerateInputSchema>, GenerationStep> = {
    name: 'graph_generate',
    description:
      'Der Kaltstart-Generierungstreiber (Regime 1: LLM schlägt vor, Gate scort/wählt). Liefert aus ' +
      'Prosa-Intention + Graph-Zustand die KONKRETE nächste Generierungs-Instruktion: seed (SYS/ACTOR/UC ' +
      'aus der Intention) → expand (Deficit-Dimension, konkrete Funde, Kandidaten-Protokoll: dryRun-' +
      'Vergleich per Verdict + fitAdvisory, bester Batch echt) → handoff (Schwelle erreicht → graph_suggest). ' +
      'Read-only und deterministisch; das Vorschlagen bleibt beim Host, das Urteil beim Gate. ' +
      'Festgefahrene Fund-Sets lassen sich per {defer:[focusKey,…]} zurückstellen (Fund-Rotation).',
    inputSchema: GraphGenerateInputSchema,
    async handler(input) {
      return generationStep(harness.getGraph(), input.intent, input.threshold, input.defer);
    },
  };

  return { graph_suggest, graph_generate };
}
