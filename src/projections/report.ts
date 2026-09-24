/**
 * tools/report.ts — read-only REPORTING tools (MOD-mcp-tools, CR-GC-256).
 *
 * The derived views on the governed graph: rules (rules_evaluate /
 * rules_get_violations), audit (audit_trail / audit_stats),
 * readiness (graph_readiness), selective tests (graph_tests) and the authoring /
 * help surface (graph_help / graph_authoring_guide). All read-only — every number
 * here is derived from `harness.evaluateRules()` or the audit log, never stored.
 *
 * Size guard (CR-GC-256 §6): with nine tools this is the group that will hit the
 * 500-line limit first — the next reporting tool splits it, it does not grow.
 *
 * @author andreas@siglochconsulting
 */

import { z } from 'zod/v4';
import type { GraphNode } from '@sigloch/graph-api-core';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import {
  readTestRefs,
  type TestRef,
  TRACE_PATTERNS,
  PHASE_READINESS_NAME,
  DIMENSION_READINESS_NAME,
  ReadinessDimension,
  type ReadinessScoreType,
  type ImportCoverage,
  type SteerSpaceType,
} from '@sigloch/contracts/se';
import { takeSteeringSnapshot, type SteeringSnapshot } from '../kernel/measure/steering-snapshot.js';
// CR-GC-537: die EINE Normierung des Steuerungsraums. Erst seit CR-SM-340 aus dem Paket
// erreichbar — davor gab es sie nur paketintern, und ein Host haette sie nachbauen muessen.
import { steerScore, steerTerms } from '@sigloch/se-engine';
import {
  summarizeReadiness,
  computePhaseReadiness,
  type ReadinessReport,
  type PhaseGateReadiness,
} from '../kernel/measure/readiness.js';
import {
  evaluateAll,
  readinessOf,
  ruleCatalogs,
  stripViolationContext,
  type Finding,
  type RuleCatalogs,
} from '../kernel/evaluation.js';
import { groupViolations, type ViolationGroup } from '@sigloch/graphcode-client';
import { loadTargetProfile, intentCoverage, type AnchorCoverage } from '../loop/target-profile.js';
import { helpEntry, contextualHelp, type HelpEntry, type ContextualMeasure } from './help.js';
import { attributesFor, formatEExampleFor, type AttributeHint } from './authoring-example.js';
import { TestSelectionSchema } from '../kernel/measure/test-selection.js';
import type { MCPTool, MCPToolRegistry, ToolPort } from '../kernel/tool-contract.js';
import { heldBackTraces, type RejectedTrace } from '../kernel/harness-import.js';
import { schneide, type Umfang } from '../kernel/measure/working-set.js';

// -------------------------------------------------------------------------
// Input schemas
// -------------------------------------------------------------------------

/**
 * Detailtiefe der Lese-Flächen (CR-GC-398) — WÖRTLICH derselbe Parameter, den
 * `graph_mutate` seit CR-GC-309 trägt. Anlass: sechsmal in einer Sitzung ist ein
 * Tool-Result übergelaufen (750–850 KB bei 667 Knoten), weil `context` mit seinen
 * candidate_targets den Löwenanteil der Bytes stellt und die Lese-Tools als
 * einzige keine Projektion hatten.
 */
const detailField = z
  .enum(['summary', 'full', 'grouped'])
  .default('full')
  .describe(
    'full (Default) = das ungekürzte Finding inkl. `context` (candidate_targets/existing_traces). ' +
      'summary lässt `context` weg — ruleId, severity, message, fixHint, elementId und source ' +
      'bleiben, also alles zum Verstehen und Reparieren; `context` stellt den Löwenanteil der ' +
      'Antwortbytes (gemessen: Ergebnisse über 750 KB bei 667 Knoten). ' +
      'grouped (CR-GC-411) = die Mittel-Ebene: EINE Gruppe je ruleId mit {ruleId, severity, count, ' +
      'message, fixHint, elementIds, elementIdsOmitted}, absteigend nach count. Erst gruppieren, ' +
      'dann kappen — `count` zählt über die UNGEKAPPTEN Verstöße, `elementIdsOmitted` benennt die ' +
      'Kappung (10 Element-IDs je Gruppe). Für die Diagnose "welche Regeln feuern, an welchen ' +
      'Elementen" ohne Zeile-pro-Verstoß-Rauschen; `total` bei rules_get_violations bleibt die ' +
      'Zahl der VERSTÖSSE, nicht der Gruppen. Wer die Element-IDs vollständig braucht, nimmt summary. ' +
      'Gleiche Semantik wie graph_mutate.violations, aber SPIEGELVERKEHRTER Default: graph_mutate ' +
      'kürzt per Default, die Diagnose-Tools liefern per Default voll — das ist die Zusage aus ' +
      'CR-GC-309 ("wer candidate_targets braucht, fragt rules_get_violations"), verankert in ' +
      'mcp.mutate-violations. Bei drohendem Überlauf hier explizit summary oder grouped anfordern.',
  );

/** Die drei Projektionen EINER Ergebnisliste (CR-GC-398 + CR-GC-411). */
type Detail = 'summary' | 'full' | 'grouped';

/** Default-Auflösung für Direktaufrufe des Handlers (Tests, In-Process) — dort
 *  läuft kein Zod-Parse, der den Schema-Default einsetzen würde. */
const detailOf = (d: Detail | undefined): Detail => d ?? 'full';

const RulesEvaluateInputSchema = z.object({ detail: detailField });

const RulesGetViolationsInputSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']).optional(),
  detail: detailField,
});

const GraphReadinessInputSchema = z.object({
  detail: z
    .boolean()
    .default(false)
    .describe(
      'false (default) = summary: scores + counts + violationsByRule only (stays within the MCP ' +
        'result limit on a fully-red graph). true = full raw violations + each gate’s blocking/open lists.',
    ),
});

const GraphHelpInputSchema = z.object({
  token: z
    .string()
    .optional()
    .describe(
      'Optional dashboard token to explain: a ruleId (R-04), gate (CDR), panel id (recommendations), ' +
        'artifact id (fmea), or vocabulary token (REQ). Omit for the contextual, ranked, explained ' +
        'measures derived from the live readiness + violations (the explained Recommendations).',
    ),
});

/** Authoring-guide input (CR-GC-231) — which ElementType to surface legal edges for. */
const GraphAuthoringGuideInputSchema = z.object({
  type: z.string().describe('The ElementType to author (e.g. UC, REQ, FUNC, TEST, MOD, ACTOR).'),
});

const GraphTestsInputSchema = z.object({
  changeSet: z
    .array(z.string())
    .min(1)
    .describe('Changed node uids (e.g. git-diff → graph). The roots of the blast-radius.'),
  depth: z
    .number()
    .int()
    .nonnegative()
    .default(1)
    .describe('Impact traversal depth per changed node (same semantics as graph_impact).'),
});

// -------------------------------------------------------------------------
// Binding
// -------------------------------------------------------------------------

export function bindReportTools(ctx: ToolPort): MCPToolRegistry {
  const { harness, graphVersion, arbeitsmenge } = ctx;

  /**
   * Projektion der EINEN Ergebnisliste — nie eine zweite Erhebung (CR-GC-398).
   * `grouped` (CR-GC-411) delegiert an die SSOT-Aggregation aus
   * @sigloch/graphcode-client, dieselbe, die das gve-Dashboard rendert — kein
   * zweiter Gruppierungspfad in der Familie.
   */
  const project = (findings: Finding[], detail: Detail): Finding[] | ViolationGroup[] => {
    if (detail === 'full') return findings;
    if (detail === 'grouped') return groupViolations(findings);
    return stripViolationContext(findings);
  };

  const rules_evaluate: MCPTool<
    z.infer<typeof RulesEvaluateInputSchema>,
    {
      violations: Finding[] | ViolationGroup[];
      skipped: string[];
      notInGate: string[];
      importCoverage: ImportCoverage | null;
    }
  > = {
    name: 'rules_evaluate',
    description:
      'The whole rule picture in three non-overlapping layers: what FIRED, what was NOT evaluated ' +
      '(`skipped`), and what the gate catalog does not carry at all (`notInGate`). Take it when you ' +
      'want to know what the judgement could and could not see; take rules_get_violations when you want ' +
      'the work list. Reading the result without `skipped` treats a partial figure as a complete one. ' +
      '`graph_help({token:"rules_evaluate"})` explains the layers. Read-only.',
    inputSchema: RulesEvaluateInputSchema,
    async handler(input) {
      const ev = evaluateAll(harness);
      return {
        violations: project(ev.findings, detailOf(input.detail)),
        skipped: ev.skipped,
        notInGate: ev.notInGate,
        importCoverage: ev.importCoverage,
      };
    },
  };

  const rules_get_violations: MCPTool<
    z.infer<typeof RulesGetViolationsInputSchema>,
    { violations: Finding[] | ViolationGroup[]; total: number; skipped: string[]; notInGate: string[]; umfang: Umfang }
  > = {
    name: 'rules_get_violations',
    description:
      'The work list: what is broken and how to fix it. Every finding carries its `fixHint` and its ' +
      'candidate targets, so the repair needs no follow-up query. Take it to REPAIR; take ' +
      'rules_evaluate to see what the judgement could not evaluate. Scope (CR-GC-613): answers over ' +
      'the uids this session WROTE — `umfang` names the slice and counts what lies outside; no write ' +
      'moves yet = whole model. `total` counts only the evaluated rules, so read it with `skipped`.',
    inputSchema: RulesGetViolationsInputSchema,
    async handler(input) {
      const ev = evaluateAll(harness);
      const matched = input.severity
        ? ev.findings.filter((v) => v.severity === input.severity)
        : ev.findings;
      /*
       * CR-GC-613 — die Antwort geht vorgabeweise ueber die ARBEITSMENGE der Sitzung.
       *
       * Gemessen im Code-Test (Lauf gefuehrt-1): ein `{severity:'warning'}` lieferte 32.630
       * Zeichen — alle Warnungen des Systems, vor allem R-19/R-20 der SECHS nicht beauftragten
       * Module. Die Antwort war sachlich richtig und beantwortete eine weitere Frage als die
       * gestellte; der Beleg, dass sie nicht abgearbeitet wurde, steht im Lauf: danach schrieb
       * der Agent EINEN Satz und exportierte.
       *
       * Der Rest faellt nicht weg, er wird zur ZAHL (`umfang.ausserhalb`). Ein Gate, das ohne
       * Abdeckung gruen meldet, ist schlimmer als keins.
       */
      const { genommen, umfang } = schneide(matched, await arbeitsmenge(), (v) => v.elementId);
      // `total` ist die Zahl der VERSTÖSSE, nie der Gruppen — auch bei
      // detail:'grouped' (CR-GC-411): die gefilterte Grundgesamtheit ist die
      // Aussage, die Projektion ändert nur ihre Darstellung. Seit CR-GC-613 zaehlt sie die
      // GELIEFERTEN — was ausserhalb liegt, steht in `umfang.ausserhalb`, nie doppelt.
      return {
        violations: project(genommen, detailOf(input.detail)),
        total: genommen.length,
        umfang,
        skipped: ev.skipped,
        notInGate: ev.notInGate,
      };
    },
  };

  // READINESS tool — exposes the family compliance score (CR-GC-107 / MOD-readiness)
  // over the agent surface. se-review / se-status read it instead of the retired
  // GET /api/graph/readiness. Delegates to scoreReadiness(harness) → evaluateRules()
  // (L2 gate) so the score is driven by contracts V3_RULES (R-/RD-), never foreign BQ-*.

  /**
   * CR-GC-325: die 8 RULE_TO_DIMENSION-Themenscores.
   *
   * Keine zweite Rechnung: `computeReadiness` aus @sigloch/se-engine bleibt die
   * einzige Implementierung, hier wird ihr Ergebnis aus DEMSELBEN Snapshot
   * durchgereicht, den `graph_generate` benutzt (CR-GC-324). Deshalb ist der Score, den
   * ein Dashboard zeigt, exakt der, aus dem die Empfehlung entstand.
   *
   * VOLLSTÄNDIG: die Reihenfolge kommt aus `ReadinessDimension.options`, damit eine
   * fehlende Dimension nicht als "alles gut" durchgeht. Fehlt eine im Report, wird
   * sie mit `applicable: 0` ausgewiesen — konstruktiv nicht messbar, NICHT perfekt
   * (Muster computeSteeringDelta).
   */
  const dimensionReadiness = (snap: SteeringSnapshot): ReadinessScoreType[] => {
    const scores = new Map(snap.report.scores.map((s) => [s.dimension as string, s]));
    return ReadinessDimension.options.map(
      (dimension) =>
        scores.get(dimension) ?? { dimension, score: null, violations: 0, applicable: 0, coreApplicable: 0 },
    );
  };

  /**
   * CR-GC-537 (ITEM-2026-059) — der STEUERUNGSRAUM im Bericht, Stufe 2: das Füllen.
   *
   * Readiness misst ABDECKUNG ("wie viele Stellen sind erledigt"), der Steuer-Score
   * AUSPRÄGUNG ("wie schlimm ist die schlimmste offene"). Beide lesen denselben Regelstrom,
   * beide gehören in denselben Bericht — sonst rechnet der nächste Leser die zweite Hälfte
   * selbst nach. Genau das drohte: das GVE-Dashboard (ITEM-2026-018 Punkt 1) hätte
   * `steerScore` nachbauen müssen, weil die Zahlen bisher nur als
   * `verdict.steer.improvement` je Suggestion sichtbar waren.
   *
   * KEINE ZWEITE RECHNUNG, und das ist hier wörtlich zu nehmen: die Terme kommen aus
   * `steerTerms` in se-engine (CR-SM-337/340) — derselben Funktion, aus der `steerScore`
   * seinerseits rechnet. Es gibt genau eine Normierung `(value − threshold)/threshold` und
   * genau eine Regel-Liste (STEER_RULES), beide in se-engine. Und der Regelstrom ist
   * DERSELBE Snapshot, aus dem `dimension_readiness` und `graph_generate` kommen (CR-GC-324) —
   * also auch derselbe wie in `computeSteerAdvisory` am dryRun-Verdict (`evaluateAllRules`,
   * voller Katalog, nicht der Gate-Delta-Katalog).
   *
   * `measured` ist eine ZAHL, kein Flag: sie sagt, wie viele Blackboxes in die Rechnung
   * eingegangen sind. `score: 0` bei `measured: 0` heisst "nichts gemessen",
   * `score: 0` bei `measured: 42` heisst "jede Blackbox im Budget" — ohne das Feld sähen
   * beide gleich aus. (Der CR-Text sagte "measured:false"; der ratifizierte Vertrag
   * CR-SM-337 hat daraus die Anzahl gemacht, die dieselbe Frage genauer beantwortet.)
   */
  const steerSpace = (snap: SteeringSnapshot): SteerSpaceType => ({
    ...steerScore(snap.violations),
    terms: steerTerms(snap.violations),
  });

  const graph_readiness: MCPTool<
    z.infer<typeof GraphReadinessInputSchema>,
    ReadinessReport & {
      [PHASE_READINESS_NAME]: PhaseGateReadiness[];
      /** CR-GC-325: die 8 RULE_TO_DIMENSION-Themenscores — die zweite Projektion
       * DESSELBEN Regelstroms, aus DEMSELBEN Snapshot wie graph_generate. */
      [DIMENSION_READINESS_NAME]: ReadinessScoreType[];
      /** CR-GC-537: der STEUERUNGSRAUM — `worst`/`worstAt`/`mean`/`score`/`measured` plus
       * einen Term je gemessener Blackbox (`value`, `threshold`, normierter `overshoot`).
       * Die DRITTE Projektion desselben Regelstroms: readiness misst Abdeckung, dieser
       * Block Ausprägung. Aus se-engines `steerTerms`/`steerScore`, nie hier gerechnet. */
      steer: SteerSpaceType;
      /** CR-GC-613: was die Sitzung angefasst hat und wie viele Funde ausserhalb liegen. Die
       * SCORES bleiben global — eine geschnittene Compliance-Zahl waere ein falsches Gruen. */
      umfang: Umfang;
      graphVersion: number;
      /** Intent-Coverage-Read-out (CR-GC-295): je bestätigtem Anker, ob/wo er in
       * UC/REQ/FUNC adressiert ist. KPI, NIE ein Gate-Blocker — Abdeckung sagt
       * "adressiert", nicht "gut gelöst". null ohne Config/intentAnchors. */
      intentCoverage: AnchorCoverage[] | null;
      /** CR-GC-489: die Reichweite neben dem Urteil — wie viel des Import-Graphen die
       * RC-Auflösung überhaupt ansehen konnte. `null`, wenn die Konformanz gar nicht lief
       * (dann nennt `skipped` die RC-Regeln). Ohne sie sieht 0 % Bindung aus wie 0 Verstöße. */
      importCoverage: ImportCoverage | null;
      /** CR-GC-398/428: was NICHT ausgewertet wurde — jede nicht ausgewertete Regel als
       * `rule:<id>`, seit CR-GC-489 einschließlich der RC-Regeln beim Namen statt hinter
       * einem Quellen-Token. Leer = vollständig. Ohne dieses Feld ist
       * violationsByRule nicht interpretierbar. */
      skipped: string[];
      /** CR-GC-428: aus welchem Regelkatalog welcher Zahlenblock stammt. Die
       * Verstoßzahlen kommen aus dem geladenen Gate-Katalog, dimension_readiness
       * aus dem vollen contracts-Katalog — bisher stand das nur im Beschreibungs-
       * text, nie am Ergebnis. */
      catalogs: RuleCatalogs;
      /** CR-GC-532: committed traces no pattern admits, held back from the store (CR-GC-530).
       * R-18 cannot report them — they are not in the graph. Derived, so it survives a restart;
       * empties with the export that finishes the repair (delete-edge, then graph_export). */
      heldBackTraces: RejectedTrace[];
    }
  > = {
    name: 'graph_readiness',
    description:
      'Where does the project stand? Coverage (how many places are done) AND severity (how bad the ' +
      'worst open one is), from ONE rule run: compliance, the SRR/PDR/CDR/TRR gates, the MS impl-gates, ' +
      'the 8 topic scores and the steering space. Take it to decide WHAT NEXT, not to diagnose a single ' +
      'finding — that is rules_get_violations. Read `score` only together with `measured`, and the ' +
      'numbers only together with `skipped` and `importCoverage`: a figure without its reach is not a ' +
      'statement. `graph_help({token:"graph_readiness"})` explains every block. Read-only.',
    inputSchema: GraphReadinessInputSchema,
    async handler(input) {
      // EINE Erhebung, drei Ableitungen (Report, Phase-Gates, skipped) — CR-GC-398.
      const ev = evaluateAll(harness);
      // CR-GC-537: EIN Snapshot für die beiden Projektionen des Steering-Katalogs
      // (dimension_readiness und steer). Vorher nahm `dimensionReadiness` ihn selbst —
      // ein zweiter Aufruf hier hiesse, denselben vollen Regellauf zweimal zu fahren
      // und beide Blöcke aus verschiedenen Erhebungen zu speisen.
      const snapshot = takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy());
      const report = readinessOf(ev, harness.getGraph());
      const phaseReadiness = computePhaseReadiness(report.violations);
      // Intent-Coverage (CR-GC-295): nur wenn die Config bestätigte Anker trägt;
      // der Loader prüft dabei auch die Zielkonflikt-Paare (Warning, kein Block).
      const anchors = loadTargetProfile(harness.getRepoRoot())?.profile.intentAnchors ?? [];
      const coverage =
        anchors.length > 0
          ? intentCoverage(
              anchors,
              harness.getGraph().nodes.map((n) => ({ id: n.uid, type: n.type, name: n.name, description: n.description })),
            )
          : null;
      /*
       * CR-GC-613 — hier steht der Umfang als AUSWEIS, und die Zahlen bleiben global.
       *
       * Das ist kein halber Schnitt, sondern die Zusage dieses Werkzeugs: Readiness ist eine
       * Aussage ueber das PROJEKT ("wie viele Stellen sind erledigt"). Eine auf die eigenen
       * Schreibzuege geschnittene Compliance-Zahl waere genau das, wovor der CR selbst warnt —
       * ein Gate, das gruen meldet, weil es weniger gesehen hat. `umfang` sagt deshalb, was die
       * Sitzung angefasst hat und wie viele Funde AUSSERHALB davon liegen; geschnitten wird die
       * Verstossliste der beiden Diagnose-Werkzeuge, nie der Score.
       */
      const umfang = schneide(report.violations, await arbeitsmenge(), (v) => v.elementId).umfang;
      return {
        ...(input.detail ? report : summarizeReadiness(report)),
        umfang,
        [PHASE_READINESS_NAME]: phaseReadiness,
        [DIMENSION_READINESS_NAME]: dimensionReadiness(snapshot),
        steer: steerSpace(snapshot),
        graphVersion: graphVersion(),
        intentCoverage: coverage,
        skipped: ev.skipped,
        // CR-GC-489: die REICHWEITE gehoert neben das Urteil. `rules_evaluate` fuehrte sie
        // schon als Geschwister von `skipped`; hier fehlte sie — und genau hier liest jemand
        // „wie fertig bin ich?". Ohne sie sieht 0 % Bindung aus wie 0 Verstoesse (gemessen:
        // FUNC-realRef 100/92/81 % in drei Repos, 0 % in moneyflow).
        importCoverage: ev.importCoverage,
        catalogs: ruleCatalogs(harness),
        heldBackTraces: heldBackTraces(harness.getRepoRoot(), harness.getScope().systemId, harness.getGraph()),
      };
    },
  };

  // TEST-DEDUCTION tool — selective test set (CR-GC-134 + CR-GC-204 / FUNC-deduce-tests
  // + FUNC-resolve-tests-from-code). Resolves the impacted TEST nodes via the SINGLE
  // harness.testImpact() traversal (one getSubgraph primitive, no parallel blast-radius):
  // a CODE changeset (MOD/FUNC) is walked DIRECTIONALLY `node →satisfy/allocate→ REQ
  // →verify→ TEST`, a REQ changeset degenerates to its verify-dependents. Each impacted
  // TEST is resolved via its `testRefs` runnable bindings to concrete files; the emitted
  // command runs ONLY those affected test files — never the full suite. TESTs without a
  // testRefs (concept-only) surface under `unresolved`, never lost.
  //
  // git-diff → node: the changeSet is graph node uids, not paths. The agent maps a
  // changed source file to its node by the repo's MOD/FUNC naming convention
  // (`src/codec.ts` → `MOD-codec`, a function → its `FUNC-*`); `graph_elements({search})`
  // looks the uid up when the convention is ambiguous. graph_tests stays path-agnostic so
  // the same deduction works for any consumer regardless of its file layout.

  const graph_tests: MCPTool<
    z.infer<typeof GraphTestsInputSchema>,
    {
      command: string;
      tests: Array<{ id: string; name: string; testRefs: TestRef[] }>;
      coverage: { changeSet: string[]; impactedNodes: number; impactedTests: number; resolved: number; files: string[] };
      unresolved: Array<{ id: string; name: string; reason: string }>;
    }
  > = {
    name: 'graph_tests',
    description:
      'Deduce the minimal selective test set for a change (FUNC-deduce-tests / CR-GC-134 + ' +
      'FUNC-resolve-tests-from-code / CR-GC-204). Maps a changeSet (changed node uids — a CODE ' +
      'node MOD/FUNC or a REQ) → impacted TEST nodes via the SINGLE harness.testImpact() traversal: ' +
      'a code node is walked DIRECTIONALLY `node →satisfy/allocate→ REQ →verify→ TEST` (not plain ' +
      'incoming-impact, which never reaches a code node’s tests), a REQ degenerates to its verify- ' +
      'dependents. Resolves each impacted TEST via its `testRefs` bindings [{file, case?, tool, level?}, …] ' +
      'and emits the minimal `vitest run <only-affected-files>` command + coverage. TESTs without a ' +
      'resolvable testRefs (concept-only) are reported under `unresolved` (never silently dropped).',
    inputSchema: GraphTestsInputSchema,
    async handler(input) {
      // Directed code→REQ→TEST resolution via the SINGLE getSubgraph primitive
      // (harness.testImpact — one traversal path, no second blast-radius).
      const directed = await harness.testImpact(input.changeSet, input.depth);
      const impacted = new Map<string, GraphNode>();
      for (const node of directed.nodes) impacted.set(node.uid, node);

      const impactedTests = [...impacted.values()].filter((n) => n.type === 'TEST');

      const tests: Array<{ id: string; name: string; testRefs: TestRef[] }> = [];
      const unresolved: Array<{ id: string; name: string; reason: string }> = [];
      const files = new Set<string>();

      for (const node of impactedTests) {
        // CR-SM-360: der Familienleser unterscheidet „fehlt" von „kaputt" — beides ist hier ein
        // eigener, benannter Grund, kein stilles Weglassen.
        const read = readTestRefs(node.attributes);
        if (read.state === 'absent') {
          const reason = node.attributes?.concept === true ? 'concept-only (no run artifact yet)' : 'no testRefs attribute';
          unresolved.push({ id: node.uid, name: node.name, reason });
          continue;
        }
        if (read.state === 'invalid') {
          unresolved.push({ id: node.uid, name: node.name, reason: `invalid testRefs: ${read.error}` });
          continue;
        }
        // CR-GC-338: ALLE Dateien der Abnahme in den selektiven Lauf — genau dafuer ist
        // 1:n da (CR-SM-231). Nur die erste zu nehmen liesse den Visual-Lauf ungelaufen.
        tests.push({ id: node.uid, name: node.name, testRefs: read.value });
        for (const ref of read.value) files.add(ref.file);
      }

      // Minimal selective run: ONLY the affected test files, sorted+deduped.
      const fileList = [...files].sort();
      const command = fileList.length > 0 ? `vitest run ${fileList.join(' ')}` : 'vitest run --passWithNoTests';

      // FLOW-test-selection: die Werkzeugantwort passiert ihren Vertrag am
      // Werkzeugrand (SCHEMA-test-selection). Der Konsument ist ein Agent, der auf
      // `command` blind ein Testkommando faehrt — eine formfremde Antwort muss hier
      // scheitern, nicht dort.
      return TestSelectionSchema.parse({
        command,
        tests,
        coverage: {
          changeSet: input.changeSet,
          impactedNodes: impacted.size,
          impactedTests: impactedTests.length,
          resolved: tests.length,
          files: fileList,
        },
        unresolved,
      });
    },
  };

  const graph_help: MCPTool<
    z.infer<typeof GraphHelpInputSchema>,
    HelpEntry | { measures: ContextualMeasure[] }
  > = {
    name: 'graph_help',
    description:
      'What does this rule / gate / panel / metric / tool mean, and what do I do about it? Plain ' +
      'language and the SE term for any on-screen token, plus the exact fix where one applies. Take it ' +
      'instead of guessing from a rule id — and instead of asking a tool description to carry the ' +
      'semantics. The argument is `token`; without it you get the contextual next steps for the ' +
      'current state, so a wrong argument name silently asks the WIDER question (CR-GC-623).',
    inputSchema: GraphHelpInputSchema,
    async handler(input) {
      if (input.token !== undefined) {
        const entry = helpEntry(input.token);
        if (!entry) {
          throw new Error(
            `graph_help: unknown token '${input.token}'. Try a ruleId (e.g. R-04), a gate (SRR/PDR/CDR/TRR, ` +
              `SAR/FCA/SVR/FRR), a panel (readiness/recommendations/artifacts/impact/health), an artifact ` +
              `(e.g. fmea), a metric dimension (coherence/modifiability/faultTolerance/flowEfficiency/` +
              `viability/scalability), or a vocabulary token (e.g. REQ). Omit the token for contextual help.`,
          );
        }
        return entry;
      }
      // EINE Erhebung für Report UND Maßnahmenliste (CR-GC-398) — vorher liefen
      // hier zwei Auswertungen nebeneinander, die auseinanderlaufen konnten.
      const ev = evaluateAll(harness);
      return { measures: contextualHelp(readinessOf(ev, harness.getGraph()), ev.findings) };
    },
  };

  /**
   * CR-GC-622 — die Sitzung merkt sich, welcher Typ schon einen vollen Leitfaden bekommen hat.
   *
   * Der Satz "take it ONCE" stand seit CR-GC-612 in der Beschreibung; im Spezifikationslauf
   * `opus5-0` (2026-09-22) fielen trotzdem 10 Aufrufe / 22.769 Zeichen an. Ein Satz in der
   * Beschreibung ersetzt keine Idempotenz im Werkzeug — die Antwort haengt an `SE_DESCRIPTOR` und
   * `TRACE_PATTERNS`, nicht am Graphen, sie ist je Typ konstant.
   *
   * Die Closure IST die Sitzung: `bindReportTools` wird einmal je Host gebunden (derselbe
   * Lebensdauer-Grund, aus dem `tool-context.ts` seinen Zustand hinter eine Fabrik legt).
   */
  const leitfadenAufruf = new Map<string, number>();
  let leitfadenZaehler = 0;

  const graph_authoring_guide: MCPTool<
    z.infer<typeof GraphAuthoringGuideInputSchema>,
    {
      type: string;
      outgoing: Array<{ edgeType: string; targetType: string; cardinality?: string; description?: string }>;
      incoming: Array<{ edgeType: string; sourceType: string; cardinality?: string; description?: string }>;
      requiredAttrs: string[];
      attributes?: AttributeHint[];
      formatEExample?: string;
      wiederholt?: string;
    }
  > = {
    name: 'graph_authoring_guide',
    description:
      'How do I write THIS element type through the gate: the legal trace patterns, the attributes it ' +
      'carries, and one Format-E example. Take it ONCE per type — a repeat call in the same session ' +
      'returns the edge grammar only and says which call carried the rest (CR-GC-622).',
    inputSchema: GraphAuthoringGuideInputSchema,
    async handler(input) {
      const descriptor = SE_DESCRIPTOR.nodeTypes[input.type as keyof typeof SE_DESCRIPTOR.nodeTypes];
      if (!descriptor) {
        throw new Error(
          `graph_authoring_guide: unknown element type '${input.type}'. Valid types: ` +
            `${Object.keys(SE_DESCRIPTOR.nodeTypes).join(', ')}.`,
        );
      }
      const patterns = TRACE_PATTERNS as ReadonlyArray<{
        source: string;
        target: string;
        type: string;
        cardinality?: string;
        description?: string;
      }>;
      const outgoing = patterns
        .filter((p) => p.source === input.type)
        .map((p) => ({ edgeType: p.type, targetType: p.target, cardinality: p.cardinality, description: p.description }));
      const incoming = patterns
        .filter((p) => p.target === input.type)
        .map((p) => ({ edgeType: p.type, sourceType: p.source, cardinality: p.cardinality, description: p.description }));
      const requiredAttrs = [...(descriptor.requiredAttrs ?? [])];
      const ersterAufruf = leitfadenAufruf.get(input.type);
      leitfadenZaehler += 1;
      if (ersterAufruf !== undefined) {
        // GEKUERZT, nicht leer: die Kanten-Grammatik bleibt vollstaendig. Der Executor bettet sie
        // JEDE Runde neu in den Rundenprompt ein (`buildRoundChannels`) und liest dafuer genau
        // `outgoing`/`incoming`/`requiredAttrs` — ein Stub haette ab Runde 2 den Block geleert,
        // dessen Vorhandensein derselbe Prompt zusichert. Weg fallen die Attribut-Hinweise, das
        // Format-E-Beispiel und die Kanten-Beschreibungen: 1.823 → 402 Zeichen im Mittel ueber
        // alle 12 Elementtypen.
        const ohneText = <T extends { description?: string }>(e: T): Omit<T, 'description'> => {
          const { description: _weg, ...rest } = e;
          return rest;
        };
        return {
          type: input.type,
          outgoing: outgoing.map(ohneText),
          incoming: incoming.map(ohneText),
          requiredAttrs,
          wiederholt:
            `Attribut-Hinweise und Format-E-Beispiel fuer ${input.type} standen in Aufruf ` +
            `${ersterAufruf} dieser Sitzung; die Kanten-Grammatik steht hier vollstaendig.`,
        };
      }
      leitfadenAufruf.set(input.type, leitfadenZaehler);
      return {
        type: input.type,
        outgoing,
        incoming,
        requiredAttrs,
        attributes: attributesFor(input.type),
        // CR-GC-625: das Beispiel zeigt den Kanten-Fan-out an einem ECHTEN Muster dieses Typs —
        // `outgoing` liegt hier schon, es wird gereicht statt neu abgeleitet.
        formatEExample: formatEExampleFor(input.type, outgoing),
      };
    },
  };

  return {
    rules_evaluate,
    rules_get_violations,
    graph_readiness,
    graph_tests,
    graph_help,
    graph_authoring_guide,
  };
}
