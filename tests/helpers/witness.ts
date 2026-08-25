/**
 * witness.ts — Spike-Helper CR-GC-407 (NUR test-seitig, kein Produktionscode).
 *
 * Konvergenz-Zeuge über einer Zustandssequenz:
 *   - skalarer Zeuge w·m(G): ℝ⁶-Metrikvektor (@sigloch/se-engine metrics/toArray,
 *     layer 'arch') über den EINEN Mapper `toOntologyGraph` (derselbe Pfad wie
 *     fitAdvisory/Snapshot, CR-GC-303/324 — kein zweiter Messpfad), skalarisiert
 *     mit target-profile-Gewichten (leer ⇒ Gleichgewichtung 1/6 je Dimension);
 *   - Zustands-Archiv: sha256 des kanonischen `exportGraphJson` je Zustand
 *     (deterministisch, source-order-unabhängig — der Graph wird gehasht, nicht
 *     der Vektor: 6 Dimensionen sind grob, verschiedene Graphen teilen sich
 *     einen Vektor ⇒ Fehlalarm).
 *
 * Klassifikation der drei Endzustände:
 *   cyclic      — Hash-Wiederbesuch (ein Zustand identisch wieder erreicht)
 *   stationary  — kein strikter Zeugen-Anstieg über die letzten k Schritte,
 *                 KEIN Wiederbesuch ⇒ Pareto-Punkt erreicht ("fertig")
 *   progressing — sonst (läuft noch)
 */
import { createHash } from 'node:crypto';
import type { Graph } from '@sigloch/graph-api-core';
import { metrics, toArray, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { toOntologyGraph } from '../../src/conformance.js';
import { exportGraphJson } from '../../src/exporter.js';
import type { TargetWeights } from '../../src/target-profile.js';

export interface WitnessSample {
  /** ℝ⁶-Metrikvektor m(G), layer 'arch', kanonische Dimensionsreihenfolge. */
  vector: number[];
  /** Skalarer Zeuge w·m(G). */
  scalar: number;
  /** sha256 des kanonischen Exports — Identität des Zustands. */
  hash: string;
}

/** Gleichgewichtung, wenn KEIN Gewicht gesetzt ist (leeres Profil, CR-289-Verhalten). */
function weightVector(weights: TargetWeights): number[] {
  const anySet = METRIC_DIMENSIONS.some((d) => weights[d as keyof TargetWeights] !== undefined);
  if (!anySet) return METRIC_DIMENSIONS.map(() => 1 / METRIC_DIMENSIONS.length);
  return METRIC_DIMENSIONS.map((d) => weights[d as keyof TargetWeights] ?? 0);
}

/** m(G), w·m(G) und Export-Hash EINES Zustands — der einzige Messpfad des Spikes. */
export function witnessSample(graph: Graph, weights: TargetWeights = {}): WitnessSample {
  const vector = toArray(metrics(toOntologyGraph(graph), { layer: 'arch' }));
  const w = weightVector(weights);
  const scalar = vector.reduce((acc, x, i) => acc + w[i] * x, 0);
  const hash = createHash('sha256').update(exportGraphJson(graph)).digest('hex');
  return { vector, scalar, hash };
}

export type SequenceVerdict = 'cyclic' | 'stationary' | 'progressing';

export interface SequenceReport {
  verdict: SequenceVerdict;
  /** Δ(w·m) je Schritt: deltas[i] = scalar(i+1) − scalar(i). */
  deltas: number[];
  /** Anteil der Schritte mit |Δ(w·m)| ≤ epsilon — die Totzone. */
  deadZoneShare: number;
  /** Bei 'cyclic': Schritt-Index des Wiederbesuchs + Index des zuerst gesehenen Zustands. */
  revisit?: { at: number; seenAt: number };
}

/**
 * Sequenz klassifizieren. `k` = Fenster für Stationarität (kein strikter
 * Anstieg über die letzten k Schritte). `epsilon` trennt "0" von Float-Rauschen.
 */
export function classifySequence(
  samples: WitnessSample[],
  k = 3,
  epsilon = 1e-9,
): SequenceReport {
  const deltas = samples.slice(1).map((s, i) => s.scalar - samples[i].scalar);
  const deadZoneShare =
    deltas.length === 0 ? 0 : deltas.filter((d) => Math.abs(d) <= epsilon).length / deltas.length;

  // Zustands-Archiv: Wiederbesuch eines Export-Hashes = Zyklus.
  // Rot gesehen (CR-GC-407): mit deaktiviertem Archiv schlug der Zyklus-Test
  // fehl ("expected 'cyclic', received 'progressing'") — der Detektor trägt.
  const seen = new Map<string, number>();
  let revisit: SequenceReport['revisit'];
  for (let i = 0; i < samples.length; i++) {
    const prev = seen.get(samples[i].hash);
    if (prev !== undefined) {
      revisit = { at: i, seenAt: prev };
      break;
    }
    seen.set(samples[i].hash, i);
  }
  if (revisit) return { verdict: 'cyclic', deltas, deadZoneShare, revisit };

  const tail = deltas.slice(-k);
  const stationary = deltas.length >= k && tail.every((d) => d <= epsilon);
  return { verdict: stationary ? 'stationary' : 'progressing', deltas, deadZoneShare };
}
