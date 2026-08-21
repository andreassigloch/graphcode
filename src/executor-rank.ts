/**
 * executor-rank.ts — Best-of-N-Kandidatenauswahl des embedded Executors
 * (CR-GC-288/289, aus `executor.ts` herausgeschnitten mit CR-GC-320).
 *
 * Reine Funktionen über `CandidateProbe` — kein Registry-, Backend- oder
 * Loop-Bezug. Der deterministische Judge ('gate') lebt vollständig hier.
 *
 * @author andreas@siglochconsulting
 */
import type { MutateResult } from '@sigloch/contracts/harness';
import type { SteeringDelta } from './steering-snapshot.js';

/** Anker des Kandidaten-Samplings — gemessene Jaccard-Spreizung 0.45/0.18/0.14
 * bei temp 0.15/0.4/0.7 (Design-Runde CR-GC-288). */
export const TEMPERATURE_ANCHORS = [0.15, 0.4, 0.7] as const;

/**
 * Temperatur-Spread für N Kandidaten (openai-Backend). N=3 trifft die Anker
 * exakt; N≠3 wird deterministisch stückweise-linear über die Anker interpoliert
 * (N=2 → [0.15, 0.7]). anthropic nutzt KEINEN Spread — N Calls ohne temperature
 * (die Claude-5-API lehnt den Parameter ab, s. buildCallModel).
 */
export function temperatureSpread(n: number): number[] {
  const a = TEMPERATURE_ANCHORS;
  if (n <= 1) return [a[0]];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i * (a.length - 1)) / (n - 1); // Position im Anker-Raum [0, a.length-1]
    const lo = Math.min(Math.floor(p), a.length - 2);
    out.push(a[lo] + (p - lo) * (a[lo + 1] - a[lo]));
  }
  return out;
}

/** Kandidat fürs Ranking: Index (letzter, deterministischer Tiebreaker) + dryRun-Verdict. */
export interface CandidateProbe {
  index: number;
  verdict:
    | (Partial<MutateResult> & {
        success: boolean;
        fitAdvisory?: { delta?: number[] };
        steeringDelta?: SteeringDelta;
      })
    | null;
  /**
   * REQ/UC-Beinahe-Duplikate im Batch dieses Kandidaten (CR-GC-361), gemessen im
   * Preflight. Nur der Zähler geht ins Ranking — die Struktur ist absichtlich
   * minimal, damit `executor-rank` nichts über nd-similarity wissen muss.
   */
  duplicates?: { score: number }[];
}

const TIER_RANK: Record<string, number> = { 'auto-apply': 2, suggest: 1, block: 0 };

/** Σ der fitAdvisory-Deltas (layer:arch) — das Δm-Kriterium des Rankings. */
export function deltaSum(verdict: CandidateProbe['verdict']): number {
  return (verdict?.fitAdvisory?.delta ?? []).reduce((s, x) => s + x, 0);
}

/** Score-Delta der Fokus-Dimension aus dem steeringDelta des dryRun-Verdicts (CR-GC-289). */
export function focusDelta(verdict: CandidateProbe['verdict'], focusDimension?: string | null): number {
  if (!focusDimension) return 0;
  return verdict?.steeringDelta?.dimensions[focusDimension]?.delta ?? 0;
}

/**
 * Der um Redundanz BEREINIGTE Fokus-Fortschritt (CR-GC-361) — das primäre
 * Ranking-Kriterium nach dem Viability-Filter.
 *
 * Warum überhaupt: Readiness-Scores entstehen aus Regel-Verletzungen, und die
 * Regeln sind strukturell pro Element („UC hat REQs", „REQ hat verify-TEST").
 * Ein Beinahe-Duplikat erfüllt sie exakt so gut wie ein eigenständiges Element —
 * `focusDelta` allein kann Fortschritt und Scheinfortschritt nicht unterscheiden
 * und belohnt anschließend über den `mutations`-Tiebreaker die größere Menge.
 *
 * Die Bereinigung: der Anteil der Duplikate an der Element-Ausbeute wird vom
 * GEWINN abgezogen. Ein Batch, dessen Ausbeute vollständig aus Duplikaten
 * besteht, zählt als Null-Fortschritt; einer mit einem Duplikat unter fünf
 * Elementen verliert ein Fünftel — echter Fortschritt bleibt Fortschritt
 * (das ist die Gegenmaßnahme zum v16-Fehler in Gegenrichtung).
 *
 * Verluste werden NICHT bereinigt: ein negativer Fokus-Delta bleibt, wie er ist —
 * Redundanz darf eine Verschlechterung nicht abmildern.
 */
export function effectiveFocusDelta(
  candidate: CandidateProbe,
  focusDimension?: string | null,
): number {
  const raw = focusDelta(candidate.verdict, focusDimension);
  const dupes = candidate.duplicates?.length ?? 0;
  if (raw <= 0 || dupes === 0) return raw;
  // mutations = Element-Ausbeute des Batches. Fehlt sie (oder ist 0), während
  // Duplikate gemessen wurden, ist der gesamte Gewinn unbelegt ⇒ Anteil 1.
  const yieldCount = candidate.verdict?.mutations ?? 0;
  const share = yieldCount > 0 ? Math.min(1, dupes / yieldCount) : 1;
  return raw * (1 - share);
}

/** Gesamt-Readiness-Delta: ungewichtete Summe der Score-Deltas aller Dimensionen. */
export function totalDelta(verdict: CandidateProbe['verdict']): number {
  const sd = verdict?.steeringDelta;
  if (!sd) return 0;
  return Object.values(sd.dimensions).reduce((s, d) => s + d.delta, 0);
}

/** blockingErrors-ANSTIEG (Steering-Katalog) — strikt schlechter, nie belohnt. */
function blockingRise(verdict: CandidateProbe['verdict']): number {
  const b = verdict?.steeringDelta?.blockingErrors;
  return b ? Math.max(0, b.after - b.before) : 0;
}

/**
 * Deterministisches Kandidaten-Ranking (der Judge 'gate'), CR-GC-289: Ziel-Delta
 * statt Volumen — das Kriterium ist der messbare Steuerungs-Fortschritt im
 * Readiness-Raum, dem Raum, in dem graph_generate den Fokus wählt:
 * tier (auto-apply > suggest > block) →
 * um Redundanz bereinigter Score-Delta der FOKUS-Dimension (GenerationStep.focusKey,
 * CR-GC-361) →
 * Gesamt-Readiness-Delta (blockingErrors-Anstieg strikt schlechter, davor) →
 * Δm-fitAdvisory auf layer:arch →
 * Element-Ausbeute (mutations) → Kandidaten-Index (Determinismus-Anker).
 * block/Preflight-Block/fehlendes Verdict ranken als tier 0.
 */
export function rankCandidates<T extends CandidateProbe>(
  candidates: T[],
  focusDimension?: string | null,
): T[] {
  const viable = (c: CandidateProbe): number => (c.verdict?.success === true ? 1 : 0);
  const tierOf = (c: CandidateProbe): number => TIER_RANK[c.verdict?.tier ?? 'suggest'] ?? 1;
  // v17-Befund (Runde 3): tier VOR focus ließ einen Null-Fortschritt-auto-apply
  // (20 Upsert-Mutationen, total=0.00) einen Reparatur-suggest (+0.04) schlagen —
  // Reparatur-Batches tragen oft frische Warnings (R-19 der neuen TESTs) und
  // landen als suggest. tier ist deshalb nur noch (1) Block-Filter und (2)
  // SPÄTE Präferenz bei gleichem Ziel-Delta; das Ziel-Delta führt.
  return [...candidates].sort(
    (a, b) =>
      viable(b) - viable(a) ||
      effectiveFocusDelta(b, focusDimension) - effectiveFocusDelta(a, focusDimension) ||
      blockingRise(a.verdict) - blockingRise(b.verdict) ||
      totalDelta(b.verdict) - totalDelta(a.verdict) ||
      tierOf(b) - tierOf(a) ||
      deltaSum(b.verdict) - deltaSum(a.verdict) ||
      (b.verdict?.mutations ?? 0) - (a.verdict?.mutations ?? 0) ||
      a.index - b.index,
  );
}
