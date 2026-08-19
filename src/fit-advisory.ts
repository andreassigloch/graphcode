/**
 * fit-advisory.ts — Fit-Gate Härtegrad 1 (CR-GC-274, aimpro-Fahrplan-Schritt 4).
 *
 * Δm-Advisory pro Mutation am Apply-Gate: vor/nach jeder ERFOLGREICHEN Mutation
 * wird der ℝ⁶-Topologievektor auf der Architektur-Ebene gemessen
 * (@sigloch/se-engine `metrics(G, {layer:'arch'})` — FUNC/FLOW/MOD/SCHEMA/ACTOR)
 * und die Differenz ans MutateResult gehängt.
 *
 * GATE-PHILOSOPHIE (hiermit entschieden, dokumentierte Tendenz): das Advisory
 * ist eine MESSUNG, KEIN Gate — es beeinflusst weder tier noch success, analog
 * zur Allocation-Cohesion (CR-SM-223: "a measurement, not a gate"). Regressionen
 * werden benannt (`regressions`), geblockt wird ausschließlich über Regeln.
 * Härtegrad 2+ (Kompensations-Operatoren, A-Stern/Beam) ist Fahrplan-Schritt 5.
 */
import type { Graph } from '@sigloch/graph-api-core';
import { metrics, toArray, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { toOntologyGraph } from './conformance.js';

export interface FitAdvisory {
  /** Messebene: Architektur-Teilgraph (FUNC/FLOW/MOD/SCHEMA/ACTOR). */
  layer: 'arch';
  /** Dimensionslabels in kanonischer Reihenfolge (Spaltenordnung von before/after/delta). */
  dimensions: readonly string[];
  before: number[];
  after: number[];
  delta: number[];
  /** Dimensionen mit delta < 0 — das Advisory-Signal; blockt nie. */
  regressions: string[];
}

function measure(graph: Graph): number[] {
  // CR-GC-324: der EINE Mapper (conformance.toOntologyGraph) statt des flachen
  // Export-Encodings — keine zweite Graph→OntologyGraph-Abbildung in src/.
  return toArray(metrics(toOntologyGraph(graph), { layer: 'arch' }));
}

/** Δm(before → after) auf layer:'arch'. Pure Messung, deterministisch. */
export function computeFitAdvisory(before: Graph, after: Graph): FitAdvisory {
  const b = measure(before);
  const a = measure(after);
  const delta = a.map((x, i) => x - b[i]);
  return {
    layer: 'arch',
    dimensions: METRIC_DIMENSIONS,
    before: b,
    after: a,
    delta,
    regressions: METRIC_DIMENSIONS.filter((_, i) => delta[i] < 0),
  };
}
