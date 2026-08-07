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
import type { Graph } from '@sigloch/graph-api-core';
import type { OntologyGraph } from '@sigloch/contracts/se';
import { evaluateAllRules } from '@sigloch/contracts/se';
import { computeReadiness } from '@sigloch/se-steering';
import { toOntologyGraph } from './conformance.js';
import { injectNDMatrices } from './nd-similarity.js';

export interface SteeringSnapshot {
  /** Der gemappte Ontology-Graph MIT injizierten ND-Matrizen. */
  og: OntologyGraph;
  /** Alle Funde des Steering-Katalogs (Full-Katalog-Eval, nicht der Gate-Delta-Katalog). */
  violations: ReturnType<typeof evaluateAllRules>;
  /** Error-Funde — die Gate-Blocker-Zählung des Steering-Raums. */
  blockingErrors: number;
  report: ReturnType<typeof computeReadiness>;
}

/** Snapshot des Steering-Zustands eines Graphen — der EINE Messpfad (s. Kopf). */
export function takeSteeringSnapshot(graph: Graph): SteeringSnapshot {
  // CR-GC-303: DERSELBE Mapper wie der Harness-/Readiness-Pfad. Vorher lief hier
  // `JSON.parse(exportGraphJson(graph))` — das Export-Encoding flacht `attributes`
  // auf Top-Level ab (SSOT-Konvention, CR-216/228), Contracts-Regeln lesen aber
  // `element.attributes?.x`. Damit waren R-19/R-20/VR-01/SC-04/AF-01..05 in DIESEM
  // Pfad dauerhaft blind bzw. dauerhaft feuernd. Der Export bleibt unangetastet;
  // falsch war, das Export-Encoding als Regel-Eval-Input zu benutzen.
  const og = toOntologyGraph(graph);
  // CR-GC-287: ND-Matrizen für DIESEN og injizieren — erst damit liefern die
  // contracts-ND-Regeln Funde (das Gate evaluiert ND nie).
  injectNDMatrices(og);
  const violations = evaluateAllRules(og);
  return {
    og,
    violations,
    blockingErrors: violations.filter((v) => v.severity === 'error').length,
    report: computeReadiness(og),
  };
}

export interface SteeringDimensionDelta {
  before: number;
  after: number;
  delta: number;
}

/**
 * Steuerungs-Fortschritt einer (probierten) Mutation im Readiness-Raum:
 * blockingErrors vorher/nachher + Score-Delta je Dimension. Dimensionen mit
 * applicable=0 auf BEIDEN Seiten entfallen (dort ist der Score konstruktiv 0,
 * nicht "perfekt").
 */
export interface SteeringDelta {
  blockingErrors: { before: number; after: number };
  dimensions: Record<string, SteeringDimensionDelta>;
}

/** Delta zweier Snapshots — deterministisch, reine Daten (kein Zeitstempel). */
export function computeSteeringDelta(before: SteeringSnapshot, after: SteeringSnapshot): SteeringDelta {
  const dimensions: Record<string, SteeringDimensionDelta> = {};
  const beforeByDim = new Map(before.report.scores.map((s) => [s.dimension as string, s]));
  for (const a of after.report.scores) {
    const b = beforeByDim.get(a.dimension as string);
    if ((b?.applicable ?? 0) === 0 && a.applicable === 0) continue;
    const bScore = b?.score ?? 0;
    dimensions[a.dimension as string] = { before: bScore, after: a.score, delta: a.score - bScore };
  }
  return {
    blockingErrors: { before: before.blockingErrors, after: after.blockingErrors },
    dimensions,
  };
}
