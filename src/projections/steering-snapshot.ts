/**
 * steering-snapshot.ts — Readiness-Snapshot des STEERING-Katalogs + Delta (CR-GC-289).
 *
 * EIN Messpfad für "wo steht der Graph im Readiness-Raum": voller Regelkatalog
 * (`evaluateAllRules` inkl. UC-01/ND — dafür die ND-Matrix-Injektion, CR-GC-287)
 * plus `computeReadiness` — exakt der Raum, in dem `graph_generate` den Fokus
 * wählt. Genutzt von `generationStep` (Fokus-Wahl) und vom dryRun-Zweig in
 * `graph_mutate` (steeringDelta im Preview-Verdict). Keine Duplikation: die
 * frühere Inline-Sequenz in generate.ts ist hierher extrahiert.
 *
 * Reine Messung, deterministisch — beeinflusst weder tier noch success
 * (Muster fitAdvisory/CR-274: "die Metrik rankt, das Gate urteilt").
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import type { OntologyGraph, MetricPolicy } from '@sigloch/contracts/se';
import { evaluateAllRules } from '@sigloch/contracts/se';
import { computeReadiness } from '@sigloch/se-engine';
import { toOntologyGraph } from '../kernel/conformance.js';
import { withNDMatrices } from './nd-similarity.js';

export interface SteeringSnapshot {
  /** Der gemappte Ontology-Graph MIT injizierten ND-Matrizen. */
  og: OntologyGraph;
  /** Alle Funde des Steering-Katalogs (Full-Katalog-Eval, nicht der Gate-Delta-Katalog). */
  violations: ReturnType<typeof evaluateAllRules>;
  /** Error-Funde — die Gate-Blocker-Zählung des Steering-Raums. */
  blockingErrors: number;
  report: ReturnType<typeof computeReadiness>;
}

/**
 * Snapshot des Steering-Zustands eines Graphen — der EINE Messpfad (s. Kopf).
 *
 * CR-GC-329: `policy` ist die Urteilsschwelle der Architektur-Metriken und kommt aus
 * `graphcode.config.jsonc` — dieselbe, mit der das Gate urteilt (`harness.getMetricPolicy()`).
 * Kein Default hier: ein zweiter Wert an dieser Stelle hiesse, dass der Steuerungsraum
 * gegen eine andere Schwelle misst als die, die der Host anzeigt.
 *
 * CR-GC-336: `focusThreshold` aus demselben Grund und aus derselben Quelle
 * (`harness.getFocusThreshold()`). contracts 4.0.0 verlangt sie bei `computeReadiness`.
 */
export function takeSteeringSnapshot(
  graph: Graph,
  policy: MetricPolicy,
  focusThreshold: number,
): SteeringSnapshot {
  // CR-GC-303: DERSELBE Mapper wie der Harness-/Readiness-Pfad. Vorher lief hier
  // `JSON.parse(exportGraphJson(graph))` — das Export-Encoding flacht `attributes`
  // auf Top-Level ab (SSOT-Konvention, CR-216/228), Contracts-Regeln lesen aber
  // `element.attributes?.x`. Damit waren R-19/R-20/VR-01/SC-04/AF-01..05 in DIESEM
  // Pfad dauerhaft blind bzw. dauerhaft feuernd. Der Export bleibt unangetastet;
  // falsch war, das Export-Encoding als Regel-Eval-Input zu benutzen.
  const og = toOntologyGraph(graph);
  // CR-GC-287: ND-Matrizen für DIESEN og injizieren — erst damit liefern die
  // contracts-ND-Regeln Funde (das Gate evaluiert ND nie).
  // CR-GC-442: als KLAMMER, nicht als blankes inject. Der contracts-Modul-State ist
  // global und wird von AO-D01 (Gate-Katalog) mitgelesen; eine liegengebliebene
  // Matrix aus diesem Lauf würde den nächsten Gate-/Report-Lauf verändern.
  return withNDMatrices(og, () => {
    const violations = evaluateAllRules(og, policy);
    return {
      og,
      violations,
      blockingErrors: violations.filter((v) => v.severity === 'error').length,
      report: computeReadiness(og, policy, focusThreshold),
    };
  });
}

export const SteeringDimensionDelta = z.object({
  // null = nicht messbar (Kernmenge leer, contracts 9.x) — nie 0 %.
  before: z.number().nullable(),
  after: z.number().nullable(),
  delta: z.number(),
});
export type SteeringDimensionDelta = z.infer<typeof SteeringDimensionDelta>;

/**
 * Steuerungs-Fortschritt einer (probierten) Mutation im Readiness-Raum:
 * blockingErrors vorher/nachher + Score-Delta je Dimension. Dimensionen mit
 * applicable=0 auf BEIDEN Seiten entfallen (dort ist der Score konstruktiv 0,
 * nicht "perfekt").
 *
 * Zod, nicht `interface` (SCHEMA-steering-delta): das Delta hängt am dryRun-
 * Verdict von `graph_mutate` und wird im Best-of-N-Ranking aus einem
 * Tool-Ergebnis gelesen — dort war es bis hierher ein blanker Cast.
 */
export const SteeringDelta = z.object({
  blockingErrors: z.object({ before: z.number(), after: z.number() }),
  dimensions: z.record(z.string(), SteeringDimensionDelta),
});
export type SteeringDelta = z.infer<typeof SteeringDelta>;

/** Delta zweier Snapshots — deterministisch, reine Daten (kein Zeitstempel). */
export function computeSteeringDelta(before: SteeringSnapshot, after: SteeringSnapshot): SteeringDelta {
  const dimensions: Record<string, SteeringDimensionDelta> = {};
  const beforeByDim = new Map(before.report.scores.map((s) => [s.dimension as string, s]));
  for (const a of after.report.scores) {
    const b = beforeByDim.get(a.dimension as string);
    if ((b?.applicable ?? 0) === 0 && a.applicable === 0) continue;
    // Delta über nicht messbare Seiten: null zählt als 0 — „wird messbar" ist Fortschritt,
    // die before/after-Werte selbst bleiben ehrlich null.
    dimensions[a.dimension as string] = {
      before: b?.score ?? null,
      after: a.score,
      delta: (a.score ?? 0) - (b?.score ?? 0),
    };
  }
  return {
    blockingErrors: { before: before.blockingErrors, after: after.blockingErrors },
    dimensions,
  };
}
