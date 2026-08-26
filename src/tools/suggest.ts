/**
 * tools/suggest.ts — die GENERIERUNGS-/OPTIMIERUNGS-Tools (MOD-mcp-tools):
 * graph_suggest (CR-GC-273) + graph_generate (CR-GC-275).
 *
 * Dünnes MCP-Binding auf @sigloch/se-engine (aimpro-Fahrplan-Schritt 3):
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
 *
 * CR-GC-431 — die publizierte Zahl gehört dem ausgelieferten Edit: se-engines
 * `score` ist das Δm einer generischen Operator-SONDE (`applyRule`), der Edit
 * kommt aber aus einem zweiten Pfad (`fix-templates`). Beide Zahlen im selben
 * Objekt wichen bis zum umgekehrten Vorzeichen voneinander ab, und die falsche
 * stand im Ranking-Feld. Hier wird deshalb umgerankt: wo ein Edit anwendbar
 * ist, sind `score`/`delta` das Δm DIESES Edits — genommen aus dem Gate-
 * Advisory, das ohnehin für den dryRun anfällt (kein zweiter Messpfad).
 */
import { z } from 'zod/v4';
import type { MutateResult } from '@sigloch/contracts/harness';
import { targetFor, suggestEdits, type Suggestion } from '@sigloch/se-engine';
import { toOntologyGraph } from '../conformance/conformance.js';
import { generationStep, type GenerationStep } from '../steering/generate.js';
import {
  TargetWeightsSchema,
  loadTargetProfile,
  extractIntentAnchors,
  isIntentTooThin,
  persistIntentAnchors,
} from '../steering/target-profile.js';
import type { MCPTool, MCPToolRegistry } from './mcp-tools.js';
import type { ToolContext } from './tool-context.js';

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
  /**
   * Δm des Gate-Advisorys für genau diesen Edit — gemessen auf `advisoryLayer`
   * des umgebenden Ergebnisses, NICHT auf der Ranking-Ebene (CR-GC-353/352).
   * Vorher wurde die Zahl weggeworfen, sodass ein Treiber sie nur über einen
   * eigenen `graph_mutate`-dryRun bekam — und dann ohne den Hinweis, dass sie
   * von einer anderen Ebene stammt als sein Ranking.
   *
   * Seit CR-GC-431 ist das zugleich die QUELLE von `score`/`delta` einer
   * anwendbaren Suggestion — eine Messung, nicht zwei.
   */
  fitDelta: number[];
}

/**
 * Eine gerankte Suggestion (CR-GC-431).
 *
 * `applicable: true` heißt: ein Template-Edit liegt bei UND das Gate hat ihn im
 * dryRun durchgelassen — dann messen `score`/`delta` GENAU DIESEN Edit (Quelle:
 * `verdict.fitDelta`, das Gate-Advisory auf `advisoryLayer`).
 *
 * `applicable: false` heißt: es gibt nichts anzuwenden — entweder Fund-Ebene
 * ohne Template-Edit, oder das Gate hat den Edit abgelehnt (`verdict.success:
 * false`). Dann stammen `score`/`delta` aus der generischen Operator-Sonde
 * (`applyRule`) und beschreiben die Hebelwirkung des FUNDES, keinen Zug, den
 * jemand ausführen könnte. Solche Zeilen ranken nie über einer anwendbaren
 * Suggestion mit positivem Δm.
 */
export type RankedSuggestion = Suggestion & { applicable: boolean; verdict?: SuggestVerdict };

/** Messebene, auf der `harness.mutate()` sein `fitAdvisory` bildet (CR-GC-274). */
const ADVISORY_LAYER = 'arch' as const;

/** Numerischer Schlupf: darunter ist ein Score „flach", keine Verbesserung. */
const SCORE_EPS = 1e-12;

/** L2-normalisierte Zielrichtung t̂ — dieselbe Normierung wie in se-engine. */
function unitTarget(target: number[]): number[] {
  const n = Math.sqrt(target.reduce((s, x) => s + x * x, 0));
  return n < 1e-12 ? target : target.map((x) => x / n);
}

export interface GraphSuggestResult {
  /** Aufgelöster Zielvektor (ℝ⁶, kanonische Dimensionsordnung). */
  target: number[];
  /** Messebene des RANKINGS (= Eingabe `layer`). */
  layer: 'all' | 'arch';
  /**
   * Messebene des GATE-ADVISORYS (`verdict.fitDelta`) — heute fest `'arch'`.
   * Zwei Zahlen, zwei Ebenen: ohne diese Angabe konnte ein Treiber auf `'all'`
   * ranken und ein Δ von 0 aus dem Advisory lesen, ohne dass irgendetwas den
   * Widerspruch benannte. Seit CR-GC-431 ist das zugleich die Messebene von
   * `score`/`delta` jeder ANWENDBAREN Suggestion.
   */
  advisoryLayer: typeof ADVISORY_LAYER;
  /**
   * Gesetzt, sobald Ranking- und Advisory-Ebene auseinanderlaufen. Kein Fehler
   * und keine Warnung im Log — ein Satz IM ERGEBNIS, weil genau dort gelesen wird.
   */
  layerMismatch?: string;
  suggestions: RankedSuggestion[];
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
      'ein Edit den Graphen entlang der Zielrichtung im 6-Metrik-Raum bewegt (score = Δm·t̂). ' +
      'WAS score MISST (CR-GC-431): bei `applicable:true` das Δm GENAU DES beigelegten Template-Edits ' +
      '— dieselbe Zahl wie verdict.fitDelta (Gate-Advisory), nur auf die Zielrichtung projiziert. Bei ' +
      '`applicable:false` gibt es nichts anzuwenden (Fund ohne Template-Edit oder ein vom Gate ' +
      'abgelehnter Edit); dann misst score die generische Operator-Sonde, also die Hebelwirkung des ' +
      'FUNDES, keinen ausführbaren Zug. Anwendbares mit positivem Δm rankt immer über Nicht-Anwendbarem. ' +
      'ZWEI MESSEBENEN: `layer` ist die Ebene des Fund-Rankings, `advisoryLayer` die des Gate-Advisorys ' +
      "(fest 'arch') und damit der anwendbaren Scores. Laufen sie auseinander, sagt das Feld " +
      '`layerMismatch` es im Ergebnis. Wendet NIE selbst an: Edits gehen über graph_mutate. ' +
      'UMHÄNGEN (CR-GC-435): trägt ein Edit `retire`, ist das die Kante, die laut Kardinalitäts-' +
      'Obergrenze weichen muss — anwenden als EIN graph_mutate-Batch [delete-edge(retire), ' +
      'add-edge(edit)], nie als zwei Aufrufe; genau diesen Verbund hat der dryRun beurteilt. ' +
      'Ein `codeImpact` benennt Datei+Zielmodul, wenn das Umhängen einer realisierten FUNC ' +
      'Code-Arbeit nach sich zieht. Read-only; die Metrik rankt, das Gate urteilt.',
    inputSchema: GraphSuggestInputSchema,
    async handler(input) {
      // CR-GC-324: der EINE Mapper statt des flachen Export-Encodings.
      const og = toOntologyGraph(harness.getGraph());
      // Default aus der Config NUR wenn target im Input fehlt (CR-GC-295);
      // fehlt auch die Datei, bleibt das Ziel leer — Verhalten wie vor dem CR.
      const weights = input.target ?? loadTargetProfile(harness.getRepoRoot())?.profile.weights ?? {};
      const target = targetFor(weights);
      // CR-GC-431: ALLE Kandidaten holen, nicht die Top-k der Sonde. Das k-Fenster
      // wird erst NACH dem Umranken auf das Edit-Δm geschnitten — sonst fiele ein
      // gut bewerteter Edit heraus, weil die generische Sonde ihn niedrig rankte.
      const suggestions = suggestEdits(og, target, { layer: input.layer });

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
          // CR-GC-435: der dryRun urteilt über den VOLLSTÄNDIGEN Verbund — trägt
          // der Template-Edit ein `retire` (Umhängen: die Kante, die laut
          // Kardinalitäts-Obergrenze weichen muss), gehen delete+add als EIN
          // Batch durchs Gate. Das Gate bewertet nur den Endzustand; der
          // Zwischenzustand „zwei Allokationen" wird nie gemessen. Verschiedene
          // Kanten-Schlüssel — der persist-Fallstrick (deletes last) greift nur
          // bei delete+add DERSELBEN Kante. Welche Kante weicht, hat se-engine
          // hergeleitet; hier wird kein Grammatikwissen nachgebaut.
          const res = await harness.mutate(
            [
              ...(s.edit.retire
                ? [{ op: 'delete-edge' as const, edge: { sourceId: s.edit.retire.source, targetId: s.edit.retire.target, edgeType: s.edit.retire.type } }]
                : []),
              { op: 'add-edge' as const, edge: { sourceId: s.edit.source, targetId: s.edit.target, edgeType: s.edit.type, attributes: {} } },
            ],
            { dryRun: true },
          );
          await harness.loadGraph();
          out.push({
            tier: res.tier,
            success: res.success,
            violations: res.violations.map((v) => ({ ruleId: v.ruleId, severity: v.severity, message: v.message })),
            fitDelta: (res as { fitAdvisory?: { delta?: number[] } }).fitAdvisory?.delta ?? [],
          });
        }
        return out;
      });

      // CR-GC-431 — die publizierte Zahl misst das, was ausgeliefert wird:
      // Wo ein Template-Edit anwendbar ist, sind `score`/`delta` das Δm GENAU
      // DIESES Edits (Quelle: das Gate-Advisory oben, kein zweiter Messpfad).
      // Vorher rankte hier das Δm einer generischen Operator-Sonde, während im
      // selben Objekt ein anderer Edit lag — bis hin zum umgekehrten Vorzeichen.
      const t = unitTarget(target);
      const ranked: RankedSuggestion[] = suggestions.map((s, i) => {
        const verdict = verdicts[i];
        // Anwendbar = Edit vorhanden UND vom Gate durchgelassen UND ein
        // vollständiges Advisory-Δm da. Ein geblockter Edit hat kein fitAdvisory
        // (harness.applyMutation liefert es nur bei success) — dann bleibt die
        // Sonde stehen, aber als nicht anwendbar markiert.
        const editDelta = verdict?.success && verdict.fitDelta.length === target.length ? verdict.fitDelta : null;
        if (!editDelta) return { ...s, applicable: false, ...(verdict ? { verdict } : {}) };
        return {
          ...s,
          delta: editDelta,
          score: editDelta.reduce((sum, x, d) => sum + x * t[d], 0),
          applicable: true,
          verdict,
        };
      });
      // Anwendbares mit positivem Δm zuerst — sonst stünde ein Fund, den niemand
      // ausführen kann, weiter über einem Zug, den das Gate durchlässt. Innerhalb
      // beider Gruppen: Score absteigend, Tiebreak ruleId (deterministisch).
      const rankGroup = (s: RankedSuggestion) => (s.applicable && s.score > SCORE_EPS ? 0 : 1);
      ranked.sort((a, b) => rankGroup(a) - rankGroup(b) || b.score - a.score || a.ruleId.localeCompare(b.ruleId));

      return {
        target,
        layer: input.layer,
        advisoryLayer: ADVISORY_LAYER,
        ...(input.layer !== ADVISORY_LAYER
          ? {
              layerMismatch:
                `Ranking auf layer:'${input.layer}', Gate-Advisory (verdict.fitDelta) auf ` +
                `layer:'${ADVISORY_LAYER}' — die beiden Zahlen sind NICHT vergleichbar. ` +
                `Konkret: score/delta einer Suggestion mit applicable:true stammen aus dem ` +
                `Advisory und messen auf layer:'${ADVISORY_LAYER}', die der Fund-Zeilen ` +
                `(applicable:false) auf layer:'${input.layer}'. ` +
                `Für eine Kette aus einer Ebene: layer:'${ADVISORY_LAYER}' ranken.`,
            }
          : {}),
        suggestions: ranked.slice(0, input.k),
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
