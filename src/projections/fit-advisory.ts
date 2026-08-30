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
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import { metrics, toArray, METRIC_DIMENSIONS, type MetricVector } from '@sigloch/se-engine';
import { toOntologyGraph } from '../kernel/conformance.js';

/**
 * Datenvertrag des Advisory (SCHEMA-fit-advisory) — Zod, nicht `interface`:
 * das Advisory verlässt den Prozess am MutateResult und kommt beim Best-of-N-
 * Ranking (`executor-rank`) aus einem Tool-Ergebnis zurück, das dort nur
 * gecastet war. Erst ein Schema macht daraus prüfbare Daten.
 */
export const FitAdvisory = z.object({
  /** Messebene: Architektur-Teilgraph (FUNC/FLOW/MOD/SCHEMA/ACTOR). */
  layer: z.literal('arch'),
  /** Dimensionslabels in kanonischer Reihenfolge (Spaltenordnung von before/after/delta). */
  dimensions: z.array(z.string()).readonly(),
  before: z.array(z.number()),
  after: z.array(z.number()),
  delta: z.array(z.number()),
  /** Dimensionen mit delta < 0 — das Advisory-Signal; blockt nie. */
  regressions: z.array(z.string()),
});
export type FitAdvisory = z.infer<typeof FitAdvisory>;

/**
 * Der ℝ⁶-Ist-Vektor auf der Architektur-Ebene — DIE eine Messung (CR-GC-451).
 *
 * Bis hierher war sie in `measure()` eingeschlossen und verließ den Prozess nur
 * als Δm am MutateResult. `graph_metrics` gibt jetzt denselben Vektor als
 * ABSOLUTWERT heraus; damit er nicht auseinanderlaufen kann, gibt es genau eine
 * Funktion und nicht zwei Aufrufe von `metrics(..., {layer:'arch'})`.
 *
 * CR-GC-324: der EINE Mapper (conformance.toOntologyGraph) statt des flachen
 * Export-Encodings — keine zweite Graph→OntologyGraph-Abbildung in src/.
 */
export function archMetrics(graph: Graph): MetricVector {
  return metrics(toOntologyGraph(graph), { layer: 'arch' });
}

function measure(graph: Graph): number[] {
  return toArray(archMetrics(graph));
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
