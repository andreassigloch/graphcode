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
 * weniger Regeln als `ALL_RULE_DEFS` (gemessen 2026-08-26: 66 gegen 73). Ab jetzt
 * steht jede nicht ausgewertete Regel als `rule:<ID>` in DERSELBEN Liste, und sie
 * wird ABGELEITET (`ALL_RULE_DEFS` minus ausgewerteter Katalog) — eine gepflegte
 * Tabelle driftet, wie die aus CR-SM-235 (18 von 71 Regeln fehlten, kein Test
 * zwang nach).
 *
 * CR-GC-442: von dieser Differenz sind ND-01/ND-02 hierher GEHOLT worden. Sie
 * standen als „nur Steering" in `skipped`, und damit tauchte ein Beinahe-Duplikat
 * in Verstoßliste, Report und Dashboard nie auf — eine blinde Stelle genau in der
 * Schicht, in der Wildwuchs entsteht. Ausgewertet wird die contracts-Regel selbst
 * (`evaluateNDRules`), kein lokaler Nachbau; graphcode liefert nur die
 * Similarity-Matrix, die die Regel per Injektion erwartet.
 *
 * Was NICHT mitgewandert ist: die Gate-Wirkung. ND bleibt außerhalb von
 * `SE_DESCRIPTOR.rules`, `mutate()` sieht die Regel also weiterhin nicht und kann
 * nicht an einem Near-Duplicate blockieren (CR-GC-287, Delta-Semantik unberührt).
 * `ruleCatalogs().notInGate` weist ND deshalb weiter aus — „nicht im Gate" und
 * „nicht ausgewertet" sind ab hier zwei verschiedene Aussagen.
 *
 * CR-GC-519: die zwei Lagen „nicht ausgewertet" (`skipped`) und „nicht im Gate"
 * (`notInGate`, CR-GC-442) reisen ab hier BEIDE am Ergebnis — jede Fläche, die
 * `skipped` gibt, gibt auch `notInGate`. Vorher führte nur `graph_readiness`
 * beide (`catalogs.notInGate`), und an `rules_get_violations` war „RC-02 nie
 * gefahren" von „RC-02 gefahren, blockiert nur nicht" nicht zu unterscheiden.
 * Und die Ableitung ist ein Vertrag: feuert eine Regel, die laut Katalog nicht
 * ausgewertet wurde, ist das kein Ergebnis, sondern ein Fehler, der sie nennt.
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
import {
  ALL_RULE_DEFS,
  getRuleDefsForProfile,
  ND_RULES,
  evaluateNDRules,
  PHASE_READINESS_NAME,
  DIMENSION_READINESS_NAME,
} from '@sigloch/contracts/se';
import { conformanceEvaluation, toOntologyGraph, type ConformanceHarness } from './conformance.js';
import type { ImportCoverage } from '@sigloch/contracts/se';
import { computeReadiness, type ReadinessReport } from './measure/readiness.js';

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
   * Die contracts-Regeln, die das GATE nicht kennt (CR-GC-442/519) — die ZWEITE
   * Lage neben `skipped`, abgeleitet aus `unevaluatedRuleIds`. Eine Regel kann hier
   * stehen und trotzdem ausgewertet sein (ND lokal, RC bei gelaufener Konformanz):
   * sie feuert dann in `findings`, blockiert aber keine Mutation. `skipped` ist
   * stets eine Teilmenge hiervon — nie umgekehrt.
   */
  notInGate: string[];
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

/**
 * Die contracts-Regeln, die graphcode LOKAL auswertet, obwohl der Gate-Katalog sie
 * nicht trägt (CR-GC-442) — heute genau ND-01/ND-02.
 *
 * Abgeleitet aus `ND_RULES`, nicht notiert: kommt in contracts eine ND-Regel dazu,
 * wertet `nearDuplicateFindings` sie mit aus UND sie verschwindet von selbst aus
 * `skipped`. Eine zweite Liste könnte hier auseinanderlaufen (CR-SM-235).
 */
export const LOCALLY_EVALUATED_RULE_IDS: readonly string[] = ND_RULES.map((rule) => rule.id);

/**
 * Die Near-Duplicate-Funde des Graphen (CR-GC-442).
 *
 * Kein Regel-Fork: Urteil, Schwelle (0.85) und Severity kommen aus
 * `evaluateNDRules` (@sigloch/contracts/se). graphcode berechnet nur die
 * Similarity-Matrix, die die Regel per Injektion erwartet — und gibt den
 * globalen contracts-Modul-State danach wieder frei (`withNDMatrices`), weil
 * AO-D01 im Gate-Katalog dieselbe Matrix mitliest.
 */
function nearDuplicateFindings(graph: CGraph): Finding[] {
  const og = toOntologyGraph(graph);
  // CR-SM-286: keine ND-Klammer mehr — die Regeln rechnen ihre Aehnlichkeit selbst
  // (contracts `similarity.ts`), es gibt keinen Modulzustand, den ein Lauf erben koennte.
  return evaluateNDRules(og).map((v) => ({
    ruleId: v.rule_id,
    severity: v.severity,
    elementId: v.element_id,
    message: v.message,
    fixHint: v.fix_hint,
    context: v.context,
    source: 'rules' as const,
  }));
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
  /**
   * Die contracts-Regeln, die der Gate-Katalog nicht kennt — abgeleitet, dieselbe
   * Menge wie `Evaluation.notInGate` (CR-GC-519), aus derselben Funktion.
   *
   * CR-GC-442: NICHT dasselbe wie `skipped`. ND-01/ND-02 stehen weiter hier (das
   * Gate kann an ihnen nicht blockieren), werden aber inzwischen ausgewertet und
   * fehlen deshalb in `skipped`.
   */
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
  // CR-GC-442: die ND-Regeln, die der Gate-Katalog nicht trägt — hier ausgewertet,
  // damit ein Beinahe-Duplikat in Verstoßliste/Report/Dashboard überhaupt sichtbar
  // wird. Gate-frei: `mutate()` fährt weiter nur `evaluateRules()`.
  findings.push(...nearDuplicateFindings(harness.getGraph()));
  // Die Konformanz laeuft VOR der Auslassungs-Rechnung, weil ihr Gelingen mitentscheidet,
  // welche Regeln als ausgelassen gelten (CR-GC-489).
  const repoRoot = harness.getRepoRoot();
  let importCoverage: ImportCoverage | null = null;
  let conformanceRan = false;
  if (repoRoot && existsSync(repoRoot)) {
    try {
      const conf = conformanceEvaluation(harness);
      for (const v of conf.violations) findings.push({ ...v, source: 'conformance' });
      importCoverage = conf.importCoverage;
      conformanceRan = true;
    } catch {
      // Extraktion gescheitert — `conformanceRan` bleibt false, die RC-Regeln stehen unten
      // namentlich in `skipped`. Nie ein stilles Null.
    }
  }

  // Regel-Ebene: was der geladene Katalog gar nicht erst enthält (CR-GC-428) und
  // was auch hier niemand nachholt — abgeleitet, nicht gepflegt.
  //
  // CR-GC-489: die RC-Regeln stehen seit CR-SM-305 im Katalog und werden vom GATE nie geladen
  // (Profil `conformance`), erschienen hier also IMMER als ausgelassen — auch dann, wenn
  // `conformanceEvaluation` sie gerade gefahren hatte. Gemessen am graphcode-Selbstmodell:
  // 3 RC-04-Befunde in `findings` UND `rule:RC-04` in `skipped`, in DERSELBEN Antwort.
  // Dieselbe Antwort sagte beides, und die zwei Lagen — „ausgewertet, 0 Verstoesse" gegen
  // „nie ausgefuehrt" — waren an der Oberflaeche nicht unterscheidbar.
  //
  // Dasselbe Muster wie `LOCALLY_EVALUATED_RULE_IDS` fuer ND, nur BEDINGT: RC zaehlt als
  // ausgewertet genau dann, wenn die Erhebung lief. Das frueher zusaetzlich gesetzte
  // Quellen-Token `'conformance'` entfaellt — es sagte dieselbe Sache ein zweites Mal und
  // groeber, naemlich ohne die drei `error`-Regeln RC-01/02/03 zu benennen.
  const conformanceRuleIds = getRuleDefsForProfile('conformance').map((r) => r.id);
  const evaluatedLocally = new Set<string>(LOCALLY_EVALUATED_RULE_IDS);
  if (conformanceRan) for (const id of conformanceRuleIds) evaluatedLocally.add(id);
  // CR-GC-519: „nicht im Gate" ist die zweite Lage und reist mit — `skipped` ist ihre
  // Teilmenge (minus alles, was lokal oder von der Konformanz nachgeholt wurde).
  const notInGate = unevaluatedRuleIds(harness.getLoadedRuleIds());
  const gap = new Set(notInGate.filter((id) => !evaluatedLocally.has(id)));
  // Und die Gegenrichtung, die `unevaluatedRuleIds` nicht leisten KANN: lief die Konformanz
  // nicht, sind ihre Regeln ausgelassen — auch dann, wenn der geladene Katalog sie fuehrt.
  // Ohne diesen Zweig verschwaende ein vollstaendig geladener Katalog das Ausfall-Signal
  // vollstaendig, und `skipped: []` hiesse „nichts ausgelassen", wo die Quelle fehlte.
  // Genau das hat der Regelkatalog-Test gefangen; es ist dieselbe Fail-open-Klasse, gegen die
  // dieser CR angetreten ist.
  if (!conformanceRan) for (const id of conformanceRuleIds) gap.add(id);
  // CR-GC-519: der Vertrag der Ableitung. Feuert eine Regel, die laut Katalog niemand
  // ausgewertet hat, widersprechen sich `getLoadedRuleIds` und `evaluateRules` — das ist
  // ein Harness-Fehler und wird benannt, nie als Antwort mit beidem ausgeliefert.
  const contradicted = [...new Set(findings.map((f) => f.ruleId).filter((id) => gap.has(id)))].sort();
  if (contradicted.length > 0) {
    throw new Error(
      `evaluateAll: ${contradicted.join(', ')} gefeuert, aber laut Katalog nicht ausgewertet — ` +
        'getLoadedRuleIds() und evaluateRules() der Harness widersprechen sich (CR-GC-519)',
    );
  }
  const skipped: string[] = [...gap].sort().map((id) => `${SKIPPED_RULE_PREFIX}${id}`);

  return { findings, skipped, notInGate, importCoverage };
}

// CR-GC-489: `scoreReadinessWithConformance` ist hier GELOESCHT. Sie hatte genau einen
// Aufrufer (einen Test), waehrend ihr Docstring behauptete, jeder Readiness-Konsument gehe
// durch sie hindurch — fuenf Aufrufstellen schrieben ihren Rumpf inline. Ein zweiter Pfad plus
// eine Zusage, die er nicht hielt. Der Ausdruck ist `readinessOf(evaluateAll(h), h.getGraph())`,
// und er steht dort, wo er gebraucht wird.

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

/** Der Platzhalter, der in `message`/`fixHint` an der Stelle der elementId steht. */
export const ELEMENT_PLACEHOLDER = '{el}';

/** Ein Befund je (Regel, Meldungsmuster) statt je Element — die Elemente als Liste. */
export interface GroupedViolation {
  ruleId: string;
  severity: RuleViolation['severity'];
  /** Meldung mit `{el}` an der Stelle der elementId — je Eintrag in `elements` einmal einzusetzen. */
  message: string;
  fixHint?: string;
  /** Die betroffenen Elemente, in Fundreihenfolge. Leer, wenn der Befund kein Element nennt. */
  elements: string[];
}

/**
 * Befunde nach Regel und Meldungsmuster falten (CR-GC-570).
 *
 * Gemessen an `runs/opus5-5`: 23 Gate-Antworten trugen 487 Befunde in 143.523 Zeichen, und
 * in **allen 487** stand die elementId im Meldungstext. Der Befundkörper — Meldung und
 * fixHint, zusammen Ø 151 Zeichen — wiederholte sich damit je Element wortgleich bis auf die
 * eine uid: `R-19` 73-mal, `RD-01` 73-mal. Ersetzt man die uid durch `{el}` und sammelt die
 * Elemente, fallen dieselben Antworten auf 51.057 Zeichen (−64 %).
 *
 * **Verlustfrei, nicht gekürzt.** Das ist eine Faktorisierung, kein Weglassen: aus Muster plus
 * Elementliste ist jede Originalmeldung wieder herstellbar. Deshalb kann die Projektion auch
 * blockierende Befunde falten — sie verliert keinen.
 *
 * Nicht gefaltet wird, was sich wirklich unterscheidet: tragen zwei Befunde derselben Regel
 * verschiedene Muster (gemessen `R-18`: 19 Muster auf 32 Funde), bleiben es zwei Einträge.
 * Der Schlüssel ist das vollständige Muster, keine Heuristik.
 *
 * Reihenfolge = Fundreihenfolge — dieselbe Eingabe ergibt dieselbe Ausgabe, sonst wären
 * Ranking, Test und Replay nicht mehr vergleichbar.
 */
export function groupViolationsByRule(violations: readonly RuleViolation[]): GroupedViolation[] {
  const groups = new Map<string, GroupedViolation>();
  for (const v of violations) {
    // Nur die uid als GANZES Token ersetzen, nie als Teilstück eines längeren
    // Bezeichners: sonst wird `REQ-ab` bei elementId `REQ-a` zu `{el}b`. Das wäre
    // zwar noch rückwärts auflösbar, aber zwei Meldungen könnten auf dasselbe
    // Muster maskieren und dann falsch zusammenfallen — und lesbar ist es auch nicht.
    const uidToken = v.elementId
      ? new RegExp(`(?<![A-Za-z0-9_-])${v.elementId.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'g')
      : null;
    // Ohne elementId gibt es nichts zu ersetzen — solche Befunde falten nur bei
    // wortgleicher Meldung, was der Schlüssel unten ohnehin erzwingt.
    const mask = (text: string | undefined): string | undefined =>
      text === undefined || !uidToken ? text : text.replace(uidToken, ELEMENT_PLACEHOLDER);
    const message = mask(v.message) ?? '';
    const fixHint = mask(v.fixHint);
    const key = JSON.stringify([v.ruleId, v.severity, message, fixHint ?? null]);
    const hit = groups.get(key);
    if (hit) {
      if (v.elementId) hit.elements.push(v.elementId);
      continue;
    }
    groups.set(key, {
      ruleId: v.ruleId,
      severity: v.severity,
      message,
      ...(fixHint === undefined ? {} : { fixHint }),
      elements: v.elementId ? [v.elementId] : [],
    });
  }
  return [...groups.values()];
}
