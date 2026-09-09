/**
 * help-content.ts — the AUTHORED Plain/SE help layer (CR-GC-227).
 *
 * Two audiences (help-system.md §2): a systems engineer who doesn't know OUR
 * encoding, and a user with no SE background. The DERIVED fields (a rule's
 * title/severity/message, a gate's owned rules, a tool's purpose) already live in
 * `V3_RULES` / `readiness.ts` / the MCP registry — help reads those, never restates
 * them. THIS module is only the two hand-written layers per item — `plain` (Layer 0,
 * no jargon, ends with the one plain action) and `se` (Layer 1, maps our token →
 * standard SE concept via the Vocabulary) — plus the Vocabulary legend itself.
 *
 * CR-SM-300: the RULE-keyed pairs no longer live here. They are `RULE_HELP` in
 * `@sigloch/contracts/se`, co-located with the catalogue they explain, and spread into
 * `HELP_CONTENT` below — ONE source, no fork. CR-GC-227 kept them here on purpose (speed:
 * no bump, no family review) and recorded the promotion as a later decision; it has now
 * been taken, because the split drifted in both directions unnoticed — 11 entries for
 * deleted rule ids, 8 catalogue rules with no entry, across four releases. Behind a
 * symlink no version range applies (CR-GC-488 §1a), so nothing forced the two together.
 *
 * What stays here is what hangs on GRAPHCODE's surface rather than on the rule catalogue:
 * phase gates, panels, the three readiness numbers, the artifacts, the vocabulary and
 * `METRIC_HELP`. All of it is still an ANNOTATION over existing ids — never a new
 * Rule/ElementType/TraceType/TRACE_PATTERN.
 *
 * `tests/help-content.test.ts` pins coverage against the LIVE registries (rule ids from
 * `SE_DESCRIPTOR`, gate ids from `readiness.ts`, artifact ids from `ARTIFACT_CATALOG`,
 * vocab tokens from the ontology enums) — a missing entry fails, never a hand-count.
 *
 * @author andreas@siglochconsulting
 */

import { RULE_HELP } from '@sigloch/contracts/se';

/** One authored help item: the two plain-language layers (+ a copy-prompt where one applies). */
export interface HelpContentEntry {
  /** Layer 0 — no SE jargon; ends with the single plain action. */
  plain: string;
  /** Layer 1 — maps our encoding to the standard SE concept (uses the Vocabulary). */
  se: string;
  /** Layer 2 — a copy-able prompt (a real `se:*` skill or MCP call), where one applies. */
  prompt?: string;
}

/** One Vocabulary legend row: the Rosetta stone between Plain and SE for a token. */
export interface HelpVocabEntry {
  /** Plain phrase for the on-screen token. */
  plain: string;
  /** Standard SE concept the token maps to. */
  se: string;
}

/** Canonical dashboard panel ids — the five MOD-dashboard panels (no live registry). */
export const HELP_PANEL_IDS = ['readiness', 'recommendations', 'artifacts', 'impact', 'health'] as const;

/**
 * Authored Plain/SE content, keyed on `ruleId` / gateId / panelId / artifactId. Derived
 * fields (title/severity/message/owned-rules/tool-purpose) are NOT here — the data layer
 * (CR-GC-228) merges them from the live sources.
 */
export const HELP_CONTENT: Record<string, HelpContentEntry> = {
  // --- Rules -------------------------------------------------------------------------
  //
  // CR-SM-300: die 69 regel-keyed Paare (63 Katalog- + 6 Conformance-Regeln) liegen seit
  // `@sigloch/contracts` 10.1 NEBEN dem Katalog, den sie erklaeren. Sie standen hier, weil
  // CR-GC-227 aus Tempo so entschieden hat — und driftete in beide Richtungen unbemerkt:
  // 11 Eintraege zu geloeschten Regel-IDs, 8 Katalogregeln ganz ohne Eintrag, ueber vier
  // Releases. Der Test unten war die ganze Zeit rot und hat es niemandem gesagt.
  //
  // Hier bleibt, was an GRAPHCODES Oberflaeche haengt und nicht am Regelkatalog: Phasen-Gates,
  // Panels, die drei Readiness-Zahlen, die Artefakte und `METRIC_HELP`.
  ...RULE_HELP,

  // --- Phase gates (keyed on gate id; owned rules come from readiness.ts) ------------
  SRR: {
    plain:
      '**Pass:** every feature you have promised is written down clearly and each can be checked by a test. **Red:** open it to see which features are missing a test → author one.',
    se: 'System Requirements Review — the requirements baseline is complete, consistent, feasible, and verifiable before design starts.',
    prompt: 'se-review, then se:author-req',
  },
  PDR: {
    plain:
      '**Pass:** there is a high-level design — the functions, the data moving between them, and the people/systems that use it. **Red:** open it to see what is not yet connected.',
    se: 'Preliminary Design Review — the architectural design meets requirements at acceptable risk, mature enough to start detailed design.',
    prompt: 'se-view:arch',
  },
  CDR: {
    plain:
      '**Pass:** the detailed design is ready to build — no module too big, nothing depends on itself in a loop, every link is allowed, every function points to its code. **Red:** open it to see which of those is off.',
    se: 'Critical Design Review — the detailed design is complete and sound enough to start building.',
    prompt: 'se-view:rtm, se-view:arch',
  },
  TRR: {
    plain:
      '**Pass:** every test is connected to the feature it checks and can actually run. **Red:** open it to see the unwired or non-runnable tests.',
    se: 'Test Readiness Review — test cases and bindings are ready to begin formal verification.',
    prompt: 'se-view:testmatrix, then se:close-violations',
  },

  // --- Implementation gates — reuse INCOSE acronyms but mean "milestone delivered" ----
  SAR: {
    plain: 'Milestone 1 (specification) is fully delivered. Red → see the open work items for MS-1.',
    se: 'Here: MS-1 acceptance. (Standard: System Acceptance Review.)',
  },
  FCA: {
    plain: 'Milestone 2 (writing the code and checking it works) is fully delivered.',
    se: 'Here: MS-2 acceptance. (Standard: Functional Configuration Audit — as-built matches requirements.)',
  },
  SVR: {
    plain: 'Milestone 3 (MVP readiness) is fully delivered.',
    se: 'Here: MS-3 acceptance. (Standard: System Verification Review — system meets its requirements.)',
  },
  FRR: {
    plain: 'Milestone 4 (second MVP) is fully delivered.',
    se: 'Here: MS-4 acceptance. (Standard: Functional Readiness Review.)',
  },

  // --- Panels (the five MOD-dashboard panels) ---------------------------------------
  readiness: {
    plain:
      'How finished the project is: one percentage plus eight checks. A red check tells you which part still has problems — open it to see them.',
    se: 'Compliance score (error-clean elements ÷ total) + eight gates: four INCOSE design reviews + four milestone-acceptance gates.',
    prompt: 'se-status',
  },
  recommendations: {
    plain:
      'The top things to fix next, biggest impact first — fixing them is what raises the readiness number.',
    se: 'The current rule violations ranked by severity (errors first, then warnings), each with the suggested link to add.',
    prompt: 'se:close-violations',
  },
  artifacts: {
    plain:
      'Which project documents are current, out-of-date, or missing — a missing failure-analysis or an out-of-date spec is hidden risk, shown here as a traffic light.',
    se: 'INCOSE artifact freshness: 🟢 live · 🟡 stale · 🔴 absent, split into renders (re-derivable → re-export) and creations (need fresh analysis → re-analysis).',
    prompt: 'se-review',
  },
  impact: {
    plain:
      'If you change this one thing, see exactly what else is affected — so you can scope the change instead of guessing.',
    se: 'Change-impact set (dependency closure): the dependent elements of a node. Standard change-impact analysis.',
    prompt: 'Show the change-impact set of <element-id> with graph_impact.',
  },
  health: {
    plain:
      'Is the tool itself working right now — if not, every other number is meaningless, so check here first.',
    se: 'Store reachable + apply-gate functional + ontology/rules/contracts versions, proven by real queries (not a ping).',
    prompt: 'Check graphcode health: store, gate, versions.',
  },

  // --- The three Readiness numbers --------------------------------------------------
  compliance: {
    plain:
      "The share of things you've defined that have no serious problem. 100% only when all are clean. The single 'are we there yet' number; the gates show why it is below 100.",
    se: '`(totalElements − elementsWithErrors) / totalElements`; the one quantitative readiness KPI.',
  },
  totalElements: {
    plain: "How many items you've defined in total. It is the denominator behind the percentage.",
    se: 'Count of all ontology elements (`REQ`/`FUNC`/`TEST`/`MOD`/…).',
  },
  elementsWithErrors: {
    plain:
      'How many of those items have a serious problem you need to fix — each one is listed in Recommendations.',
    se: 'Elements carrying ≥1 `error`-severity violation.',
  },

  // --- Artifacts (keyed on ARTIFACT_CATALOG id; kind/names come from CR-220/222/223) --
  srs: {
    plain: "The requirements document — the features you've promised, per use case.",
    se: 'Software Requirements Specification (a render — re-derivable from the model).',
    prompt: 'se-view:rtm',
  },
  architecture: {
    plain: 'The map of modules and how functions sit in them.',
    se: 'Architecture / System Design Description (a render).',
    prompt: 'se-view:arch',
  },
  rtm: {
    plain: 'Which test covers which feature, and the gaps.',
    se: 'Requirements Traceability Matrix (a render).',
    prompt: 'se-view:rtm',
  },
  nfr: {
    plain: 'How the project is doing against its speed/quality targets.',
    se: 'Non-Functional Requirements register (a render).',
    prompt: 'se-view:nfr',
  },
  icd: {
    plain: 'The document of how the modules talk to each other.',
    se: 'Interface Control Document (a render).',
    prompt: 'se-view:icd',
  },
  testconcept: {
    plain: 'The test plan and how much it covers.',
    se: 'Test Concept — the verification pyramid with the computed E2E gap (a render).',
    prompt: 'se-view:testconcept',
  },
  testmatrix: {
    plain: 'The test plan and how much it covers, as a coverage matrix.',
    se: 'Verification Cross-Reference Matrix / Test Matrix (a render).',
    prompt: 'se-view:testmatrix',
  },
  changelog: {
    plain: 'What changed (from the audit trail).',
    se: 'Change Log — the CR history (a render).',
    prompt: 'se-view:changelog',
  },
  intplan: {
    plain: 'The milestones, work items, and their order.',
    se: 'Integration & Test Plan (a render of the MS/CR/gate structure).',
    prompt: 'se-view:intplan',
  },
  references: {
    plain: 'The cross-reference index — how every requirement links to everything else.',
    se: 'Requirements Traceability reference index (a render).',
    prompt: 'se-view:rtm',
  },
  conops: {
    plain: 'How the system is operated and who uses it.',
    se: 'Concept of Operations (a creation — needs fresh analysis; render with `se-view:conops`).',
    prompt: 'se-conops',
  },
  'assumption-review': {
    plain: 'The unproven assumptions and how risky they are.',
    se: 'Assumption Review (was IRR) — a creation, graphcode-specific; commit-pinned record promoted to CRs.',
    prompt: 'se-irr',
  },
  trade: {
    plain: 'The design options weighed and the choice made.',
    se: 'Trade Study (a creation; render with `se-view:trade`).',
    prompt: 'se-trade',
  },
  fmea: {
    plain: 'The "what can break and how it is handled" analysis.',
    se: 'Failure Mode and Effects Analysis (a creation; render with `se-view:fmea`).',
    prompt: 'se-fmea',
  },
  implplan: {
    plain: 'The work slices and milestones (a judgment, not auto-derived).',
    se: 'Implementation Plan (a creation; `se-plan` creates, `se-view:implplan` renders).',
    prompt: 'se-plan',
  },
};

/**
 * The Vocabulary legend (help-system.md §3) — the one place every element/trace token is
 * mapped. The token LIST is the ontology (`ElementType`/`TraceType` + the `depends-on`
 * relation label); the two columns are authored. `se` cells in HELP_CONTENT use these tokens.
 */
export const HELP_VOCAB: Record<string, HelpVocabEntry> = {
  // Element types (things in the model).
  SYS: { plain: 'the whole system', se: 'system (top of the hierarchy)' },
  UC: { plain: 'a thing a user wants to do', se: 'use case' },
  ACTOR: { plain: 'a person or outside system that interacts with it', se: 'actor (external entity)' },
  FCHAIN: { plain: 'the ordered steps that make a use case happen', se: 'function chain / functional thread' },
  FUNC: { plain: 'one function the software performs', se: 'function (behavioural element)' },
  FLOW: { plain: 'a piece of data moving between parts', se: 'data / control flow' },
  REQ: { plain: "a feature you've promised to build", se: 'requirement' },
  TEST: { plain: 'a check that proves a feature works', se: 'test case' },
  MOD: { plain: 'a module / code package', se: 'module (structural unit)' },
  SCHEMA: { plain: 'the shape of a piece of data', se: 'data schema' },
  CR: { plain: 'one unit of planned work', se: 'change request' },
  MS: { plain: 'a delivery milestone', se: 'milestone' },
  // Trace types (links between things).
  compose: { plain: '"is made up of"', se: 'decomposition / containment' },
  satisfy: { plain: '"this builds that" (a function → the feature it delivers)', se: 'satisfies (design → requirement traceability)' },
  verify: { plain: '"this checks that" (a test → the feature it proves)', se: 'verifies (V&V coverage)' },
  io: { plain: '"data in / out" (function or actor ↔ a data flow)', se: 'input/output interface' },
  allocate: { plain: '"runs inside" (a function → a module)', se: 'allocation (function → structural unit)' },
  relation: { plain: 'a general link (e.g. a work item → a milestone)', se: 'generic association' },
  'depends-on': { plain: '"must come after" (milestone → milestone)', se: 'dependency (a `relation` label)' },
};

/**
 * Element-states note (help-system.md §3): the state on a `FUNC`/`TEST` that decides whether
 * the binding rules (R-19/R-20) apply.
 */
export const HELP_ELEMENT_STATES =
  'A `FUNC` or `TEST` carries a state: **realized** (the default — meant to be built/written now) · ' +
  '`concept:true` (planned, not built/written yet — a stub) · `external:true` (provided by an outside library, not built here).';

/**
 * One authored metric item (CR-GC-458). The six ℝ⁶ dimensions decide every
 * `graph_suggest` recommendation, sit in the target profile, ride along in every
 * gate verdict's fit-advisory, and since CR-GC-451 leave the host as a current-state
 * vector in `graph_metrics` — and until now the help catalogue did not know a single
 * one of them. `graph_help({ token: 'coherence' })` answered `unknown token`, so any
 * consumer wanting to explain them wrote its own text: the second source that is
 * deliberately avoided for rule text.
 *
 * Three fields, not the {plain, se} pair above, because a measurement answers other
 * questions than a rule. A rule says "this is broken → do that". A number needs
 * WHAT IS COUNTED, WHAT IT IS FOR, and WHAT MOVES IT — answer only one and you have
 * not helped. Own constant rather than three optional fields on `HelpContentEntry`:
 * a rule entry carrying three empty metric fields would be a schema that does not
 * hold for the majority of its entries.
 */
export interface MetricHelpEntry {
  /** Everyday word for the dimension — what a reader recognizes, not the enum name. */
  title: string;
  /** What the number counts — the engine's formula, in words. */
  measure: string;
  /** What a high (or low) value is good for. */
  purpose: string;
  /** What actually moves it. */
  lever: string;
}

/**
 * The six `MetricVector` dimensions, keyed exactly as `METRIC_DIMENSIONS` names them.
 * `measure` is derived from `metrics.ts` in `@sigloch/se-engine` — every one of these
 * is `clamp05(5 × …)`, so the scale is 0–5 throughout, and the phrasing follows the
 * formula that stands there rather than an intuition about the name.
 */
export const METRIC_HELP: Record<string, MetricHelpEntry> = {
  modifiability: {
    title: 'Änderbarkeit',
    measure:
      'Die Modularität des Graphen: wie sauber er in Gruppen zerfällt, die innen dicht und nach außen dünn verbunden sind.',
    purpose:
      'Eine Änderung soll in ihrer Gruppe bleiben. Hoch heißt: wenig Kollateralschaden, weil wenige Kanten die Gruppengrenze kreuzen.',
    lever:
      'Funktionen so auf Module verteilen, dass zusammen Aufgerufenes zusammenliegt — der Modulschnitt, nicht die Anzahl der Module.',
  },
  faultTolerance: {
    title: 'Robustheit',
    measure: 'Die Redundanzdichte: wie viele alternative Wege es zwischen zwei Stellen gibt.',
    purpose: 'Fällt eine Stelle aus, soll ein anderer Weg bleiben. Niedrig heißt: es gibt Einzelpunkte, an denen alles hängt.',
    lever: 'Zweitwege einziehen; einzige Verbindungen zu kritischen Knoten auflösen.',
  },
  flowEfficiency: {
    title: 'Flusseffizienz',
    measure:
      'Der Kehrwert der mittleren Weglänge vom Eingang zum Ergebnis, multipliziert mit dem Anteil der überhaupt erreichbaren Knoten.',
    purpose:
      'Vom Eingang zum Ergebnis soll es kurz gehen, und nichts soll unerreichbar herumliegen. Der Wert fällt aus beiden Gründen — lange Ketten und tote Ecken zählen gleich.',
    lever: 'Ketten kürzen, Zwischenstationen entfernen, unangebundene Knoten anbinden oder löschen.',
  },
  coherence: {
    title: 'Zusammenhalt',
    measure: 'Der Anteil der Kanten, die innerhalb einer Gruppe bleiben, statt sie zu verlassen.',
    purpose: 'Die Modulgrenzen sollen dort liegen, wo der Graph ohnehin dicht ist — dann beschreibt die Struktur, was wirklich zusammengehört.',
    lever: 'Den Modulschnitt nachziehen: kreuzende Aufrufe zusammenlegen, statt neue Module aufzumachen.',
  },
  viability: {
    title: 'Tragfähigkeit',
    measure: 'Die Masse der größten zusammenhängenden Komponente, geteilt durch die Gesamtmasse.',
    purpose: 'Das Modell soll ein Ganzes sein, nicht mehrere Inseln. Niedrig heißt: ein Teil des Modells hängt an nichts.',
    lever: 'Abgehängte Teilgraphen anbinden oder entfernen — beides hebt den Wert, und nur eines davon ist meistens richtig.',
  },
  scalability: {
    title: 'Skalierbarkeit',
    measure: 'Das Gegenstück zur höchsten Betweenness: wie stark der Verkehr über eine einzelne Engstelle läuft.',
    purpose: 'Kein Nadelöhr, an dem alles vorbeimuss. Niedrig heißt: ein Knoten trägt den Großteil aller Pfade.',
    lever:
      'Den Drehscheiben-Knoten entlasten oder aufteilen. Wer eine Drehscheibe WILL (ein Kernel als bewusster Hub), setzt stattdessen den Zielwert niedriger — das ist kein Mangel, sondern eine Entscheidung.',
  },
};
