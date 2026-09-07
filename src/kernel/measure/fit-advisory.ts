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
import { toOntologyGraph } from '../conformance.js';

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

// ---------------------------------------------------------------------------
// CR-GC-483 — der STEUER-Score neben dem Advisory.
//
// Der ℝ⁶ oben bleibt, was er ist: eine Messung, die berichtet wird. Was er NICHT mehr ist, ist
// ein Ranking-Kriterium — CR-SM-281/-287 haben ihn an drei Klassen von Gegenbeispielen
// widerlegt, und CR-SM-292 hat den Chebyshev-Score über die Verstoßmasse an seine Stelle
// gesetzt. Er wird HIER berechnet, im selben Durchlauf und aus demselben Vorher/Nachher-Paar,
// damit es keinen zweiten Weg zum Steuersignal gibt.
//
// Warum am Gate und nicht im Executor: der Executor sieht vom dryRun nur die NEUEN Violations
// (Delta-Semantik), nie den Gesamtzustand. Der Score ist aber eine Aussage über den Zustand
// („wie schlimm ist die schlimmste Stelle"), nicht über die Differenz — er lässt sich aus den
// neuen Befunden allein nicht bilden.
// ---------------------------------------------------------------------------
import { evaluateAllRules, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { steerScore, STEER_RULES } from '@sigloch/se-engine';

export const SteerAdvisory = z.object({
  /** Die Regeln, aus denen der Score kommt — mitgeliefert, damit ein Leser nicht raten muss. */
  rules: z.array(z.string()).readonly(),
  /** Der schlimmste normierte Überschuss vorher / nachher. Kleiner ist besser. */
  before: z.number(),
  after: z.number(),
  /** `before − after`: **positiv = der Zug hat die schlimmste Stelle entschärft.** */
  improvement: z.number(),
  /** Wo die schlimmste Stelle NACH dem Zug sitzt — das WO, nicht nur das WIEVIEL. */
  worstAt: z.object({ ruleId: z.string(), elementId: z.string() }).nullable(),
  /**
   * Entfernt der Zug Elemente? Trägt die Zerstörungs-Sperre (CR-SM-291 §7.2 Grenze 1):
   * der ℝ⁵ misst Form und nie Substanz, also senkt Löschen ihn zuverlässig.
   */
  removesElements: z.boolean(),
});
export type SteerAdvisory = z.infer<typeof SteerAdvisory>;

/** Der Chebyshev-Score vor und nach dem Zug. Pure Messung, deterministisch. */
export function computeSteerAdvisory(before: Graph, after: Graph): SteerAdvisory {
  const b = toOntologyGraph(before);
  const a = toOntologyGraph(after);
  const sb = steerScore(evaluateAllRules(b, DEFAULT_METRIC_POLICY));
  const sa = steerScore(evaluateAllRules(a, DEFAULT_METRIC_POLICY));
  return {
    rules: STEER_RULES,
    before: sb.score,
    after: sa.score,
    improvement: sb.score - sa.score,
    worstAt: sa.worstAt,
    removesElements: a.elements.length < b.elements.length,
  };
}
