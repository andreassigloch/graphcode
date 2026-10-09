/**
 * steering-snapshot.ts — Readiness-Snapshot des STEERING-Katalogs + Delta (CR-GC-289).
 *
 * EIN Messpfad für "wo steht der Graph im Readiness-Raum": voller Regelkatalog
 * (`evaluateAllRules` inkl. UC-01/ND — dafür die ND-Matrix-Injektion, CR-GC-287)
 * plus `computeReadiness` — exakt der Raum, in dem `graph_generate` den Fokus wählt. Genutzt von `generationStep` (Fokus-Wahl) und vom dryRun-Zweig in
 * `graph_mutate` (steeringDelta im Preview-Verdict). Keine Duplikation: die
 * frühere Inline-Sequenz in generate.ts ist hierher extrahiert.
 *
 * Reine Messung, deterministisch — beeinflusst weder tier noch success
 * (Muster fitAdvisory/CR-274: "die Metrik rankt, das Gate urteilt").
 *
 * @author andreas@siglochconsulting
 */
import { focusViolations, blockingOf, zaehlt } from './focus-set.js';
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { OntologyGraph, RuleViolation } from '@sigloch/contracts/se';
import { countByStage } from '@sigloch/graphcode-client';
import { evaluateAllRules } from '@sigloch/contracts/se';
import { toOntologyGraph } from '../conformance.js';

/**
 * Ein Messpunkt des Steuerraums — ein Zod-Vertrag aus Bausteinen der Familie (CR-GC-644), kein Typ.
 * `takeSteeringSnapshot` prueft ihn, bevor er das Messwerk verlaesst.
 */
export const SteeringSnapshotSchema = z.object({
  /** Der gemappte Ontology-Graph MIT injizierten ND-Matrizen. */
  og: OntologyGraph,
  /** Alle Funde des Steering-Katalogs (Full-Katalog-Eval, nicht der Gate-Delta-Katalog). */
  violations: z.array(RuleViolation),
  /** Error-Funde — die Gate-Blocker-Zählung des Steering-Raums. */
  blockingErrors: z.number(),
  /** CR-GC-757: Befunde je Stufe (1–12, dann `immer`) — die eine Einteilung; keine Prozentzahl. */
  stages: z.array(z.object({ name: z.string(), findings: z.number() })),
  /** CR-GC-598: die Fokusmenge (focus-set.ts) — was die Steuerung zeigt. */
  focus: z.array(RuleViolation),
});
export type SteeringSnapshot = z.infer<typeof SteeringSnapshotSchema>;

/**
 * Snapshot des Steering-Zustands eines Graphen — der EINE Messpfad (s. Kopf).
 *
 * CR-GC-329: `policy` ist die Urteilsschwelle der Architektur-Metriken und kommt aus
 * `graphcode.config.jsonc` — dieselbe, mit der das Gate urteilt (`harness.getMetricPolicy()`).
 * Kein Default hier: ein zweiter Wert an dieser Stelle hiesse, dass der Steuerungsraum
 * gegen eine andere Schwelle misst als die, die der Host anzeigt.
 *
 * CR-GC-514: keine Fokus-Schwelle mehr. Sie wurde nur an `computeReadiness` durchgereicht, das
 * daraus `ready` bildete; seit CR-SM-310 misst die Readiness ohne Urteil. Die Schwelle wendet
 * allein die Fuehrung an (`generationStep`).
 */
export function takeSteeringSnapshot(
  graph: Graph,
  policy: MetricPolicy,
): SteeringSnapshot {
  // CR-GC-646: die Pruefung ist eingeschaltet, seit das Gate `status`/`kinds`/`method` am Eintritt
  // gegen den Element-Vertrag haelt (SCHEMA-02) und contracts nur noch `done` als abgeschlossen
  // kennt (CR-SM-362). Ein Bruch hier ist Altbestand, der am Gate vorbei kam (Import-Port) — er
  // wirft mit Pfad, statt als Teilstring-Suche still weiterzurechnen.
  return SteeringSnapshotSchema.parse(buildSnapshot(graph, policy));
}

/**
 * Dieselbe Messung ohne Wurf, fuer die PROBE (`graph_mutate` dryRun, ITEM-2026-570): ein Graph mit
 * Altbestand ausserhalb des Element-Vertrags ist genau der, dessen Migration man probt. Dort ist
 * der Steuerraum nicht messbar — gesagt mit dem ersten Pfad, nicht verschwiegen und nicht geraten.
 */
export function measureSteering(
  graph: Graph,
  policy: MetricPolicy,
): { snapshot: SteeringSnapshot } | { unmeasurable: string } {
  const parsed = SteeringSnapshotSchema.safeParse(buildSnapshot(graph, policy));
  if (parsed.success) return { snapshot: parsed.data };
  const first = parsed.error.issues[0];
  const at = first?.path.join('.') ?? '';
  return {
    unmeasurable: `Steuerraum nicht messbar: der Graph verletzt den Element-Vertrag (${parsed.error.issues.length} Befund(e), erster ${at}: ${first?.message})`,
  };
}

function buildSnapshot(graph: Graph, policy: MetricPolicy): SteeringSnapshot {
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
  // CR-SM-286: die Klammer ist entfallen — kein contracts-Modulzustand mehr.
  const violations = evaluateAllRules(og, policy);
  const focus = focusViolations(og, violations);
  const snapshot: SteeringSnapshot = {
    og,
    violations,
    // CR-GC-598: Fehler der FOKUSMENGE, die am Gate wirklich blocken — nicht jeder Fehler des
    // 74-Regel-Stroms (FM-03 war damals ein nicht-blockender error und abnehmbar; die Probe meldete sonst 0 → 8).
    focus,
    blockingErrors: blockingOf(focus),
    // CR-GC-766: dieselbe Regelmenge wie Marken, Bericht und Viewer — der Schritt zaehlt nichts, was dort fehlt.
    stages: befundeJeStufe(violations.filter((v) => zaehlt(v.rule_id))),
  };
  return snapshot;
}

/** Befunde je Stufe — `countByStage` des Clients (eine Rechnung fuer Schritt, Probe, Bericht und Viewer). */
function befundeJeStufe(violations: readonly RuleViolation[]): { name: string; findings: number }[] {
  const harness = violations.map((v) => ({ ruleId: v.rule_id, severity: v.severity, elementId: v.element_id, message: v.message }));
  return countByStage(harness as Parameters<typeof countByStage>[0]).map((s) => ({ name: s.name, findings: s.findings }));
}

export const SteeringStageDelta = z.object({
  before: z.number(),
  after: z.number(),
  /** Positiv = weniger Befunde in der Stufe. */
  delta: z.number(),
});
export type SteeringStageDelta = z.infer<typeof SteeringStageDelta>;

/**
 * Steuerungs-Fortschritt einer (probierten) Mutation: blockingErrors vorher/nachher und die Zahl der
 * Befunde je Stufe vorher/nachher (CR-GC-757 — vorher ein Score-Delta je Dimension). Stufen ohne
 * Befund auf beiden Seiten entfallen.
 *
 * Zod, nicht `interface` (SCHEMA-steering-delta): das Delta hängt am dryRun-Verdict von
 * `graph_mutate` und wird vom Client aus einem Tool-Ergebnis gelesen.
 */
export const SteeringDelta = z.object({
  blockingErrors: z.object({ before: z.number(), after: z.number() }),
  stages: z.record(z.string(), SteeringStageDelta),
});
export type SteeringDelta = z.infer<typeof SteeringDelta>;

/** Delta zweier Snapshots — deterministisch, reine Daten (kein Zeitstempel). */
export function computeSteeringDelta(before: SteeringSnapshot, after: SteeringSnapshot): SteeringDelta {
  const stages: Record<string, SteeringStageDelta> = {};
  const vorher = new Map(before.stages.map((s) => [s.name, s.findings]));
  for (const a of after.stages) {
    const b = vorher.get(a.name) ?? 0;
    if (b === 0 && a.findings === 0) continue;
    stages[a.name] = { before: b, after: a.findings, delta: b - a.findings };
  }
  return {
    blockingErrors: { before: before.blockingErrors, after: after.blockingErrors },
    stages,
  };
}
