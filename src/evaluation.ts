/**
 * evaluation.ts — DIE Auswertungsfläche (CR-GC-398).
 *
 * Vorher beantworteten drei Werkzeuge dieselbe Frage verschieden: `rules_evaluate`
 * und `rules_get_violations` riefen nur `harness.evaluateRules()` (reiner Graph,
 * kein I/O), `graph_readiness` zusätzlich die RC-Konformanzregeln (Dateisystem).
 * Gemessen bei graphVersion 181: 128 gegen 137 Findings, Differenz exakt RC-04 (6)
 * und RC-05 (3). Die Trennung nach I/O ist begründet — falsch war, dass die
 * ABWESENHEIT unsichtbar blieb: `jq … | select(.ruleId=="RC-05")` lieferte stumm
 * `0` statt „nicht ausgewertet".
 *
 * Ab hier gilt: EINE Funktion wertet aus (`evaluateAll`), die Werkzeuge sind
 * Projektionen derselben Liste — sie unterscheiden sich im Filter, nie in der
 * Grundgesamtheit. Jedes Finding trägt seine Herkunft (`source`), jedes Ergebnis
 * trägt die nicht befragten Quellen (`skipped`).
 *
 * NICHT hier: das Apply-Gate. `harness.mutate()` bewertet weiter rein graph-seitig
 * (`evaluateRules`), und das muss so bleiben — eine Mutation darf nicht pro Batch
 * den Quellbaum parsen. Das Gate ist keine Auswertungs-Fläche, es ist der Schreibweg.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync } from 'node:fs';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { Graph } from '@sigloch/graph-api-core';
import { conformanceViolations, type ConformanceHarness } from './conformance.js';
import { computeReadiness, type ReadinessReport } from './readiness.js';

type CGraph = Pick<Graph, 'nodes' | 'edges'>;

/** Woher ein Finding kommt: aus den Graph-Regeln oder aus dem Code-Abgleich. */
export type FindingSource = 'rules' | 'conformance';

/** Ein Regelbefund mit seiner Herkunft. */
export type Finding = RuleViolation & { source: FindingSource };

export interface Evaluation {
  /** Die EINE Ergebnisliste. Jede Fläche filtert daraus, keine erhebt selbst. */
  findings: Finding[];
  /**
   * Quellen, die NICHT befragt werden konnten. Leer heißt „vollständig
   * ausgewertet" — und das ist der ganze Zweck des Feldes: eine Compliance-Zahl
   * ohne diese Angabe ist nicht interpretierbar, weil man ihr nicht ansieht,
   * welche Fläche gefragt wurde.
   */
  skipped: FindingSource[];
}

/**
 * Werte den Graphen vollständig aus: Graph-Regeln + Code-Konformanz.
 *
 * `conformance` wird übersprungen, wenn der Quellbaum nicht lesbar ist — kein
 * `repoRoot`, oder die Extraktion wirft. Das `catch` versteckt hier nichts,
 * es ist der Mechanismus, der die Abwesenheit zu DATEN macht: ohne ihn liefert
 * ein unlesbarer Baum entweder eine Exception mitten im Report oder — schlimmer —
 * stillschweigend null RC-Findings, die wie „alles sauber" aussehen.
 */
export function evaluateAll(harness: ConformanceHarness): Evaluation {
  const findings: Finding[] = harness
    .evaluateRules()
    .map((v) => ({ ...v, source: 'rules' as const }));
  const skipped: FindingSource[] = [];

  const repoRoot = harness.getRepoRoot();
  if (!repoRoot || !existsSync(repoRoot)) {
    skipped.push('conformance');
  } else {
    try {
      for (const v of conformanceViolations(harness)) findings.push({ ...v, source: 'conformance' });
    } catch {
      skipped.push('conformance');
    }
  }
  return { findings, skipped };
}

/**
 * Produkt-seitige Readiness: Graph-Regeln + RC-Konformanz in EINEM Report.
 * Jeder Readiness-Konsument (graph_readiness, graph_help, Dashboard) geht hier
 * durch — `scoreReadiness` bleibt das reine/browser-taugliche Primitiv.
 */
export function scoreReadinessWithConformance(harness: ConformanceHarness): ReadinessReport {
  return readinessOf(evaluateAll(harness), harness.getGraph());
}

/** Readiness aus einer bereits erhobenen Auswertung — kein zweiter Lauf. */
export function readinessOf(evaluation: Evaluation, graph: CGraph): ReadinessReport {
  return computeReadiness(evaluation.findings, graph);
}

/**
 * Violations ohne `context` (CR-GC-309, hierher gezogen von CR-GC-398).
 *
 * `context` trägt `candidate_targets`/`existing_traces` — die Fix-Automations-Daten,
 * die den Löwenanteil der Antwortbytes ausmachen. Eine Implementierung für alle
 * Flächen (`graph_mutate`, `rules_evaluate`, `rules_get_violations`), damit die
 * Projektion nicht dreimal leicht verschieden entsteht.
 */
export function stripViolationContext<V extends { context?: unknown }>(violations: readonly V[]): V[] {
  return violations.map(({ context: _context, ...rest }) => rest as V);
}
