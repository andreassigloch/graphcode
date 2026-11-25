/**
 * generate.ts — der Kaltstart-Generierungstreiber (CR-GC-275,
 * aimpro-Fahrplan-Schritt 6, Regime 1: LLM schlägt vor, Gate scort/wählt).
 *
 * Bisher existierte nur Guidance (graph_authoring_guide: legale Struktur; Skills)
 * und daneben `graph_next_step`, eine generische Aktion pro Deficit-Dimension —
 * ein zweites Steuerungswerkzeug auf derselben Messung, seit CR-GC-560..562 weg.
 * Das hier ist der GENERATIVE Treiber und seither der einzige: aus Prosa-Intention + Graph-Zustand die
 * KONKRETE nächste Generierungs-Instruktion — welche Elemente, für welche
 * Eltern, wie viele Kandidaten, und das Gate-Protokoll (dryRun-Vergleich per
 * Verdict + steerAdvisory, gewählter Batch echt). Readiness-getrieben bis zur
 * Schwelle, dann Handoff auf die ℝ⁶-Optimierung (graph_suggest, Schritt 3).
 *
 * Deterministischer Kern nach dem se-plan-Muster: DIESE Funktion ist die
 * testbare Zustandsmaschine (seed → expand → handoff); das Vorschlagen selbst
 * bleibt beim MCP-Host — der einzige nicht-deterministische Punkt, exakt der
 * Determinismus-Split des Architekturgenerator-Modells (UMI urteilt, Operator-
 * Wahl bleibt deterministisch).
 *
 * Seit CR-GC-1032 in drei Dateien: hier Vertrag und Einstieg, `generate-step-core.ts` die
 * Zustandsmaschine, `generate-klauseln.ts` die Texte und Skill-Zeiger.
 */
import { z } from 'zod/v4';
import { GraphSchema, type Graph } from '@sigloch/graph-api-core';
import { MetricPolicySchema, RULE_TASKS } from '@sigloch/contracts/se';
import { steerTerms } from '@sigloch/se-engine';
import { takeSteeringSnapshot } from '../kernel/measure/steering-snapshot.js';
import { UmbauHinweis, alsBefund, hinweisAus } from './umbau-ausloeser.js';
import { TargetProfileSchema } from './target-profile.js';
import { SteerOptimumSchema, type SteerState } from './stagnation.js';
import { RULE_CLAUSE, SKILL_FOR_STAGE, TASK_OF_ENTRY, TASK_SKILL, analyseSkill } from './generate-klauseln.js';
import { stepCore } from './generate-step-core.js';

/**
 * Datenvertrag der Generierungs-Instruktion (SCHEMA-generation-step) — Zod, nicht
 * `interface`: der Step ist das Ergebnis des MCP-Tools `graph_generate` und damit
 * die Grenze zwischen Substrat und Agent.
 */
export const GenerationStep = z.object({
  /** seed = leerer Graph; expand = Deficit-getriebene Verdichtung; handoff = Schwelle erreicht. */
  /** CR-GC-596: stalled = nur noch zurueckgestellte Funde — nicht fertig, Uebergabe an den Menschen. */
  phase: z.enum(['seed', 'expand', 'handoff', 'stalled']),
  /** true genau in phase 'handoff' — die Struktur trägt, weiter mit graph_suggest. */
  done: z.boolean(),
  /** Die konkrete generative Instruktion für den MCP-Host. */
  prompt: z.string(),
  /** Befunde je Stufe — nur die Stufen, in denen etwas meldet (CR-GC-757). */
  readiness: z.array(z.object({ stage: z.string(), findings: z.number() })),
  threshold: z.number(),
  /** Error-Violations (Gate-Blocker) — müssen vor dem Handoff auf 0. */
  blockingErrors: z.number(),
  /** Stabiler Identifikator des fokussierten Fund-Sets (CR-GC-281):
   * `${stufe}:${rule_id}:${element_ids sortiert}`. null wenn kein
   * Fokus (seed/handoff/keine regelbaren Funde). */
  focusKey: z.string().nullable(),
  /** Fokus-Elementtypen des Schritts (CR-GC-285): `STAGE_FOCUS_TYPES` der
   * Fokus-Dimension bzw. der seed-Phase; leer bei handoff/keinem Fokus. Als
   * Feld, damit ein Leser den Prompt-String nicht parsen muss. */
  focusTypes: z.array(z.string()),
  /** Die Fund-Knoten des Schritts (CR-GC-652) — dieselben uids, die im `focusKey` stecken, aber als
   * Feld: wer die uids braucht, soll sie lesen, nicht aus einem zusammengesetzten Schluessel
   * herausschneiden. Nur in der expand-Phase gesetzt; seed/handoff haben keinen Fund. */
  focusElements: z.array(z.string()).optional(),
  /** Fokus-Dimension des Schritts (CR-GC-558): Schluessel in `STAGE_FOCUS_TYPES`
   * (`seed` | `uc` | `req` | `arch` | ...), null bei handoff. Steckt zwar auch im
   * `focusKey`-Praefix, aber der ist ein zusammengesetzter Identifikator — wer die
   * Dimension braucht, soll sie lesen, nicht aus einem Key herausschneiden. */
  focusStage: z.string().nullable(),
  /** CR-GC-589: die Anleitung zur Fokus-Dimension als VERWEIS (`se:author-req`) — der Host laedt
   * den Skill ueber sein Skill-Werkzeug. null, wenn es fuer die Dimension keinen Autorier-Skill gibt. */
  skill: z.string().nullable(),
  /** CR-GC-608: der Steuerzustand (Termvektor, Summe der Ueberschuesse) — das Fertig-Kriterium der
   * Steuerregeln liest ihn im Sitzungsgedaechtnis. */
  steer: z.object({ key: z.string(), sum: z.number(), terms: z.array(z.string()) }).optional(),
  /** CR-GC-728: nur in phase 'stalled' — die Analyse-Tasks, deren Eintrittspunkt offen ist. Als Feld,
   * damit ein Leser sie nennen kann, ohne den Prompt-Text zu zerlegen. Leer = der Kern selbst sitzt fest. */
  offeneTasks: z.array(z.string()).optional(),
  /** CR-GC-728: nur in phase 'stalled' — die zurückgestellten Fund-Fenster (focusKeys). */
  offeneFunde: z.array(z.string()).optional(),
  /** CR-GC-934: ein Befund einer Regel mit Zug ist offen — weiter mit graph_suggest; null sonst. */
  umbau: UmbauHinweis.nullable(),
});
export type GenerationStep = z.infer<typeof GenerationStep>;

/**
 * Was ein Aufrufer an `generationStep` gibt (FLOW-generation-request, CR-GC-1022): Graph,
 * Metrikpolitik, Intention, Schwelle, Zurueckgestelltes, Zielprofil, Task und Steuer-Optimum.
 * Vorher acht Positionsargumente — ein Aufrufer aus einem anderen Repo gab sie verschoben.
 */
export const GenerationRequestSchema = z.strictObject({
  graph: GraphSchema,
  policy: MetricPolicySchema,
  intent: z.string().optional(),
  threshold: z.number(),
  defer: z.array(z.string()).default([]),
  profile: z.strictObject({ profile: TargetProfileSchema }).nullable().default(null),
  task: z.enum(RULE_TASKS).default('kern'),
  steerOptimum: SteerOptimumSchema.nullable().default(null),
});
/** Der Graph kommt als `Graph` (Attribute gesetzt), gerechnet wird auf ihm. */
export type GenerationRequest = z.input<typeof GenerationRequestSchema> & { graph: Graph };

/**
 * Der nächste Generierungsschritt für (Graph, Intention). Deterministisch —
 * gleicher Graph + gleiche Intention + gleiches defer ⇒ gleicher Schritt.
 *
 * `defer` (CR-GC-281): zurückgestellte focusKeys — Fund-Sets, an denen sich
 * der Host festgefahren hat. Die Fokus-Wahl überspringt sie deterministisch
 * (das nächste Fenster in der Reihenfolge der Stufen, CR-GC-749); sind ALLE
 * Kandidaten zurückgestellt, endet die Maschine `stalled` (CR-GC-596).
 *
 * Ein 'local'-Minimal-Rendering (CR-GC-282) wurde gemessen und VERWORFEN:
 * v13b lieferte 22 Elemente vs. 82 mit diesem vollen Rendering — die
 * Multi-Kandidaten-Instruktion erzeugt die großen verbundenen Batches, und
 * Ein-Fund-Batches kollidieren mit Batch-Invarianten (REQ braucht TEST im
 * selben Batch). Ein Profil-Parameter existiert deshalb bewusst NICHT.
 */
export function generationStep(eingabe: GenerationRequest): GenerationStep {
  const { policy, intent, threshold, defer, profile, task, steerOptimum } = GenerationRequestSchema.parse(eingabe);
  // Der Graph ist geprueft; gerechnet wird auf dem Original — die Kopie des Schemas verloere Felder,
  // die der Vertrag nicht nennt.
  const graph = eingabe.graph;
  const snap = takeSteeringSnapshot(graph, policy);
  const { imperativSkill, ...core } = stepCore(snap, policy, intent, threshold, defer, profile, task, steerOptimum);
  // CR-GC-601: im Task nennt der Schritt den Skill des Tasks, im Kern den der Fokus-Dimension.
  // CR-GC-604: steht im Kern ein Eintrittspunkt im Fokus, ist der Skill der des Tasks — nicht der
  // der Dimension (AF-04/AF-05 liegen in ver/ms, fuer die es keinen Autorier-Skill gibt: `next.skill` war null).
  const fensterRegel = core.focusKey?.split(':')[1] ?? '';
  const eintrittsTask = task === 'kern' && core.focusKey ? TASK_OF_ENTRY.get(fensterRegel) : undefined;
  // CR-GC-748: eine Regel, die zu einer Analyse gehoert und keine Klausel traegt, nennt deren Skill.
  const skillDerAnalyse = core.focusKey && !(fensterRegel in RULE_CLAUSE) ? analyseSkill(fensterRegel) : undefined;
  const skill =
    task !== 'kern'
      ? TASK_SKILL[task]
      : eintrittsTask
        ? TASK_SKILL[eintrittsTask]
        : skillDerAnalyse !== undefined
          ? skillDerAnalyse
        : // CR-GC-655: im expand entscheidet der Imperativ (Klausel vor Dimension); seed/handoff
          // haben keinen, dort gilt die Dimension (seed:uc → author-uc usw.).
          imperativSkill !== undefined
          ? imperativSkill
          : core.focusStage
            ? (SKILL_FOR_STAGE[core.focusStage]?.name ?? null)
            : null;
  const step: GenerationStep = { ...core, skill, steer: steerState(snap.violations), umbau: hinweisAus(snap.violations.map(alsBefund)) };
  // CR-GC-983: der Schritt ist die Antwort von graph_generate — der Erzeuger prueft ihn (RC-04).
  GenerationStep.parse(step);
  return step;
}

/** CR-GC-608: der kanonische Steuerzustand aus se-engines `steerTerms` — kein eigener Messpfad. */
function steerState(violations: Parameters<typeof steerTerms>[0]): SteerState {
  const terms = steerTerms(violations)
    .filter((t) => t.overshoot > 0)
    .map((t) => `${t.ruleId}@${t.elementId} (${t.overshoot.toFixed(2)})`)
    .sort();
  const sum = steerTerms(violations).reduce((a, t) => a + Math.max(0, t.overshoot), 0);
  return { key: terms.join('|'), sum, terms };
}
