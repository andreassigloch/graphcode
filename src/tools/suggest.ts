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
import type { MutateResult } from '@sigloch/contracts/harness';
import { targetFor, suggestEdits, type Suggestion } from '@sigloch/se-optimizer';
import { toOntologyGraph } from '../conformance.js';
import { generationStep, type GenerationStep } from '../generate.js';
import {
  TargetWeightsSchema,
  loadTargetProfile,
  extractIntentAnchors,
  isIntentTooThin,
  persistIntentAnchors,
} from '../target-profile.js';
import type { MCPTool, MCPToolRegistry } from '../mcp-tools.js';
import type { ToolContext } from '../tool-context.js';

// -------------------------------------------------------------------------
// Input schema
// -------------------------------------------------------------------------

const GraphSuggestInputSchema = z.object({
  // Gewichts-Form = target-profile.ts (CR-GC-295) — EIN Schema für Input und Config.
  target: TargetWeightsSchema.optional().describe(
    'Zielrichtung im Metrikraum: Gewicht je Dimension in [-1,1] (>0 heben, <0 senken; ' +
      'fehlend = 0). Nur die RICHTUNG wirkt, nicht der Betrag — der Vektor wird vor dem ' +
      'Ranking L2-normalisiert, also rankt {"scalability": 1} exakt wie ' +
      '{"scalability": 0.2}; entscheidend ist das VERHÄLTNIS der Dimensionen zueinander ' +
      '(CR-GC-353, belegt durch T-C4). Das Feld `target` der Antwort echot den ROHEN ' +
      'Input zurück, nicht den normalisierten Vektor. Beispiel {"scalability": 1} = ' +
      '"raise scalability". Ohne Angabe wird .graphcode/target-profile.json als Default ' +
      'gelesen (CR-GC-295); fehlt auch die, bleibt das Ziel leer (richtungslos).',
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
      // CR-GC-324: der EINE Mapper statt des flachen Export-Encodings.
      const og = toOntologyGraph(harness.getGraph());
      // Default aus der Config NUR wenn target im Input fehlt (CR-GC-295);
      // fehlt auch die Datei, bleibt das Ziel leer — Verhalten wie vor dem CR.
      const weights = input.target ?? loadTargetProfile(harness.getRepoRoot())?.profile.weights ?? {};
      const target = targetFor(weights);
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
      .optional()
      .describe(
        'Readiness-Schwelle je Dimension für den Handoff auf graph_suggest. Ohne Angabe gilt ' +
        'die Schwelle des Hosts (graphcode.config.jsonc → focusThreshold) — CR-GC-336: ein ' +
        'Tool-Default wäre eine zweite Antwort auf dieselbe Frage.',
      ),
    defer: z
      .array(z.string())
      .optional()
      .describe(
        'Zurückgestellte focusKeys (aus GenerationStep.focusKey): diese Fund-Sets werden bei der ' +
          'Fokus-Wahl deterministisch übersprungen; sind alle Kandidaten zurückgestellt, wird defer ignoriert.',
      ),
    selection: z
      .enum(['host', 'driver'])
      .default('host')
      .describe(
        "Wer die Kandidaten-Auswahl macht (CR-GC-288): 'host' = der MCP-Client vergleicht selbst per " +
          "dryRun (Protokoll-Prosa im Prompt, Default für alle MCP-Clients); 'driver' = ein " +
          'Best-of-N-Treiber probt und wählt im Code — der dryRun-Auftrag verschwindet aus dem Prompt.',
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
      // Profil bei jedem Schritt frisch laden (CR-GC-295) — der Loader ist der
      // EINE Check-Pfad, ein Hand-Edit der Config wirkt ab der nächsten Runde.
      const repoRoot = harness.getRepoRoot();
      const profile = loadTargetProfile(repoRoot);
      // CR-GC-307: die Kernthemen der Intention werden STILL gesetzt — kein
      // Bestätigungsschritt beim Menschen, der Begriff dahinter ist Steuerungs-
      // internes. Bewusst HIER und nicht in generationStep: die Zustandsmaschine
      // bleibt rein/deterministisch (N=1-AC aus CR-GC-295), der Datei-Write ist ein
      // Effekt der Tool-Schicht. persistIntentAnchors ist idempotent und verweigert
      // jedes Überschreiben bestehender Anker.
      if (input.intent && !profile?.profile.intentAnchors?.length && !isIntentTooThin(input.intent)) {
        persistIntentAnchors(repoRoot, extractIntentAnchors(input.intent));
      }
      return generationStep(harness.getGraph(), harness.getMetricPolicy(), input.intent, input.threshold ?? harness.getFocusThreshold(), input.defer, input.selection, profile);
    },
  };

  return { graph_suggest, graph_generate };
}
