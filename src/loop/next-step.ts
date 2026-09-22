/**
 * next-step.ts — der naechste Schritt in der Antwort auf die angewandte Mutation (CR-GC-588).
 *
 * Gemessen (Bericht "Zeitlinie", Runde 7/8): 12–26 von 25–44 Mutationen je Lauf kamen ohne ein
 * frisches `graph_generate` seit der letzten — dort steuerte nur die Gate-Antwort, und die sagt,
 * was falsch ist, nicht was als Naechstes dran ist. Holt der Host den Fokus doch, kostet das
 * einen Roundtrip, und Turns sind seit CR-GC-570/579 der Kostentreiber (Cache-Lesung waechst
 * mit Turns × Kontext).
 *
 * KEINE zweite Stimme ([[one-imperative-principle]]): `next` ist DERSELBE Schritt, den
 * `graph_generate` unmittelbar danach liefern wuerde — aus `generationStep`, nicht neu
 * formuliert. Kompakt heisst: ohne Readiness-Tabellen (die stehen in `graph_readiness`) und ohne
 * das Gate-Protokoll (das der Host gerade ausgefuehrt hat und in jedem `graph_generate` hat).
 *
 * Nur nach ANGEWANDTER Mutation ueber die Leitung: bei `dryRun` und bei Ablehnung ist das
 * Urteil der Kanal. Nur fuer MCP-Hosts — der Executor geht am Tool vorbei ans Gate und baut
 * seine Runden selbst.
 *
 * @author andreas@siglochconsulting
 */
import type { Graph } from '@sigloch/graph-api-core';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { z } from 'zod/v4';
import { generationStep, type GenerationStep } from './generate.js';
import { loadTargetProfile } from './target-profile.js';
import { stepWithMemory, type FocusMemory } from './stagnation.js';

/** Trennmarke des Gate-Protokolls im Prompt — dieselbe, an der die Tests den Prompt teilen. */
const PROTOCOL_MARK = 'Gate-Protokoll';

export const NextStep = z.object({
  phase: z.enum(['seed', 'expand', 'handoff', 'stalled']),
  done: z.boolean(),
  /** Der Imperativ der Runde ohne Gate-Protokoll. */
  prompt: z.string(),
  focusKey: z.string().nullable(),
  focusTypes: z.array(z.string()),
  focusDimension: z.string().nullable(),
  skill: z.string().nullable(),
});
export type NextStep = z.infer<typeof NextStep>;

/** Die kompakte Projektion eines Schritts — verlustfrei bis auf Protokoll und Tabellen. */
export function compactStep(step: GenerationStep): NextStep {
  const i = step.prompt.indexOf(PROTOCOL_MARK);
  return {
    phase: step.phase,
    done: step.done,
    prompt: (i >= 0 ? step.prompt.slice(0, i) : step.prompt).trim(),
    focusKey: step.focusKey,
    focusTypes: step.focusTypes,
    focusDimension: step.focusDimension,
    skill: step.skill,
  };
}

/**
 * Der naechste Schritt nach einer angewandten Mutation — genau der Aufruf, den `graph_generate`
 * fuer einen MCP-Host machen wuerde: Intention aus dem SYS, Schwelle des Hosts, `selection: 'host'`,
 * Profil frisch geladen. `defer` kennt die Mutation nicht; wer zurueckstellen will, ruft
 * `graph_generate {defer}` — das ist der eine Fall, in dem der Roundtrip bleibt.
 */
export function nextStepAfterApply(
  graph: Graph,
  policy: MetricPolicy,
  threshold: number,
  repoRoot: string,
  memory: FocusMemory,
  version: number,
): NextStep {
  // CR-GC-596: dieselbe Abbruchregel wie graph_generate — ein Gedaechtnis je Sitzung.
  const profile = loadTargetProfile(repoRoot);
  return compactStep(
    stepWithMemory(memory, version, (defer) => generationStep(graph, policy, undefined, threshold, defer, 'host', profile)),
  );
}
