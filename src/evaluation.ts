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
 * trägt das nicht Ausgewertete (`skipped`).
 *
 * CR-GC-428: `skipped` nannte nur QUELLEN und war deshalb selbst wieder eine Zahl
 * ohne Grundgesamtheit. Innerhalb der Quelle `rules` lädt der Descriptor-Katalog
 * weniger Regeln als `ALL_RULE_DEFS` (gemessen 2026-08-26: 66 gegen 73) — die
 * Differenz BQ-01/02/04/06/07 plus ND-01/ND-02 wertet nur der Steering-Pfad aus
 * (CR-GC-287: ND bleibt
 * Steering, nie Gate-Blocker). Das ist eine Entscheidung, kein Versehen; falsch
 * war nur, dass `skipped: []` daneben Vollständigkeit behauptete. Ab jetzt steht
 * jede nicht ausgewertete Regel als `rule:<ID>` in DERSELBEN Liste, und sie wird
 * ABGELEITET (`ALL_RULE_DEFS` minus geladener Katalog) — eine gepflegte Tabelle
 * driftet, wie die aus CR-SM-235 (18 von 71 Regeln fehlten, kein Test zwang nach).
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
import { ALL_RULE_DEFS, PHASE_READINESS_NAME, DIMENSION_READINESS_NAME } from '@sigloch/contracts/se';
import { conformanceEvaluation, type ConformanceHarness } from './conformance.js';
import type { ImportCoverage } from '@sigloch/contracts/se';
import { computeReadiness, type ReadinessReport } from './readiness.js';

type CGraph = Pick<Graph, 'nodes' | 'edges'>;

/** Woher ein Finding kommt: aus den Graph-Regeln oder aus dem Code-Abgleich. */
export type FindingSource = 'rules' | 'conformance';

/** Ein Regelbefund mit seiner Herkunft. */
export type Finding = RuleViolation & { source: FindingSource };

/**
 * Präfix der REGEL-Ebene in `skipped` (CR-GC-428) — `rule:BQ-01` neben der
 * QUELLEN-Ebene `conformance`. Ein Präfix statt zweier Felder, damit die Frage
 * „was wurde ausgelassen?" EINE Antwort hat und `skipped: []` beweisbar
 * „nichts" heißt.
 */
export const SKIPPED_RULE_PREFIX = 'rule:';

/**
 * Die Harness-Fläche, die eine Auswertung braucht: die Konformanz-Quelle plus
 * den GELADENEN Regelkatalog. Letzterer ist kein Komfort — ohne ihn ließe sich
 * die nicht ausgewertete Differenz nur als Konstante pflegen.
 */
export interface EvaluationHarness extends ConformanceHarness {
  /** Die Regel-IDs, die diese Harness registriert hat (`GraphCodeHarness.getLoadedRuleIds`). */
  getLoadedRuleIds(): string[];
}

export interface Evaluation {
  /** Die EINE Ergebnisliste. Jede Fläche filtert daraus, keine erhebt selbst. */
  findings: Finding[];
  /**
   * Alles, was NICHT in `findings` einfließen konnte — auf BEIDEN Ebenen:
   * eine nicht befragbare QUELLE (`conformance`) und jede nicht geladene REGEL
   * (`rule:BQ-01`). Leer heißt „vollständig ausgewertet", und nur mit dieser
   * Zusicherung ist eine Compliance-Zahl interpretierbar: man sieht ihr sonst
   * weder an, welche Fläche gefragt wurde, noch mit welchem Katalog.
   */
  skipped: string[];
  /**
   * Abdeckung des Import-Graphen (CR-GC-429 §2 / CR-SM-268 Teil 2) — das
   * GESCHWISTER von `skipped`, nie damit zusammengelegt: `skipped` heißt „diese
   * Quelle wurde GAR NICHT ausgewertet", die Abdeckung heißt „ausgewertet, und
   * ein Teil fällt trotzdem durch" (`unassigned` benennt die Dateien, die weder
   * über eine realRef-gebundene FUNC noch über ein `MOD.path`-Präfix einer MOD
   * zuzuordnen waren — RC-05 war für sie blind). `null` genau dann, wenn die
   * Quelle `conformance` in `skipped` steht — nie eine stille 0.
   */
  importCoverage: ImportCoverage | null;
}

/**
 * Die contracts-Regeln, die der übergebene Katalog NICHT enthält — sortiert.
 *
 * Die EINE Stelle, an der die Differenz entsteht: abgeleitet aus `ALL_RULE_DEFS`,
 * nie irgendwo notiert. Fällt eine Regel aus dem geladenen Katalog, erscheint sie
 * hier von selbst — es gibt nichts nachzuziehen.
 */
export function unevaluatedRuleIds(loadedRuleIds: Iterable<string>): string[] {
  const loaded = new Set(loadedRuleIds);
  return ALL_RULE_DEFS.map((rule) => rule.id)
    .filter((id) => !loaded.has(id))
    .sort();
}

/** Ein Regelkatalog als Herkunftsangabe: wer, wie viele, für welche Zahlen. */
export interface RuleCatalogProvenance {
  /** Der Katalog samt Paket — die Antwort auf „woher kommt diese Zahl?". */
  catalog: string;
  /** Wie viele Regeln er auswertet — gezählt, nie notiert. */
  ruleCount: number;
  /** Die Ergebnisfelder, die aus ihm entstehen. */
  fields: string[];
}

/**
 * Die Katalog-Herkunft je Zahlenblock (CR-GC-428).
 *
 * `graph_readiness` mischt zwei Ströme: die Verstoßzahlen kommen aus dem
 * geladenen Gate-Katalog, `dimension_readiness` aus dem vollen contracts-Katalog
 * des Steering-Pfads. Beide Zahlen sind richtig und beantworten dieselbe Frage
 * verschieden — deshalb reist die Herkunft ab jetzt AM ERGEBNIS mit, nicht nur
 * im Beschreibungstext des Werkzeugs.
 */
export interface RuleCatalogs {
  /** Gate-/Diagnosepfad: `SE_DESCRIPTOR.rules` + die RC-Konformanzregeln. */
  gate: RuleCatalogProvenance;
  /** Steering-Pfad: `evaluateAllRules` über den vollen contracts-Katalog. */
  steering: RuleCatalogProvenance;
  /** Die contracts-Regeln, die der Gate-Katalog nicht kennt — abgeleitet. */
  notInGate: string[];
}

/** Herkunft der Zahlenblöcke, aus dem LIVE geladenen Katalog gezählt. */
export function ruleCatalogs(harness: Pick<EvaluationHarness, 'getLoadedRuleIds'>): RuleCatalogs {
  const loaded = harness.getLoadedRuleIds();
  return {
    gate: {
      catalog: 'SE_DESCRIPTOR.rules (@sigloch/graph-api-core) + CODE_CONFORMANCE_RULES',
      ruleCount: loaded.length,
      fields: ['compliance', 'violations', 'violationsByRule', 'phaseGates', 'implGates', PHASE_READINESS_NAME],
    },
    steering: {
      catalog: 'ALL_RULE_DEFS (@sigloch/contracts/se) via evaluateAllRules',
      ruleCount: ALL_RULE_DEFS.length,
      fields: [DIMENSION_READINESS_NAME],
    },
    notInGate: unevaluatedRuleIds(loaded),
  };
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
export function evaluateAll(harness: EvaluationHarness): Evaluation {
  const findings: Finding[] = harness
    .evaluateRules()
    .map((v) => ({ ...v, source: 'rules' as const }));
  // Regel-Ebene: was der geladene Katalog gar nicht erst enthält (CR-GC-428).
  // Steht VOR der Quellen-Ebene, weil es die Grundgesamtheit der Quelle `rules`
  // beschreibt — und es ist abgeleitet, nicht gepflegt.
  const skipped: string[] = unevaluatedRuleIds(harness.getLoadedRuleIds()).map(
    (id) => `${SKIPPED_RULE_PREFIX}${id}`,
  );

  const repoRoot = harness.getRepoRoot();
  let importCoverage: ImportCoverage | null = null;
  if (!repoRoot || !existsSync(repoRoot)) {
    skipped.push('conformance');
  } else {
    try {
      const conf = conformanceEvaluation(harness);
      for (const v of conf.violations) findings.push({ ...v, source: 'conformance' });
      importCoverage = conf.importCoverage;
    } catch {
      skipped.push('conformance');
    }
  }
  return { findings, skipped, importCoverage };
}

/**
 * Produkt-seitige Readiness: Graph-Regeln + RC-Konformanz in EINEM Report.
 * Jeder Readiness-Konsument (graph_readiness, graph_help, Dashboard) geht hier
 * durch — `scoreReadiness` bleibt das reine/browser-taugliche Primitiv.
 */
export function scoreReadinessWithConformance(harness: EvaluationHarness): ReadinessReport {
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
