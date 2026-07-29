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
 * Anti-drift: this is an ANNOTATION over existing `ruleId`/gateId/panelId/artifactId/
 * vocab-token keys — NOT a new Rule/ElementType/TraceType/TRACE_PATTERN. The locked
 * "`V3_RULES` imported, never forked" constraint is untouched and NO `@sigloch/contracts`
 * version bump is required (CR-GC-227). Promotion of these pairs into contracts,
 * co-located with `V3_RULES`, is a later family-review decision — not this CR.
 *
 * `tests/help-content.test.ts` pins coverage against the LIVE registries (rule ids from
 * `SE_DESCRIPTOR`, gate ids from `readiness.ts`, artifact ids from `ARTIFACT_CATALOG`,
 * vocab tokens from the ontology enums) — a missing entry fails, never a hand-count.
 *
 * @author andreas@siglochconsulting
 */

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
  // --- Rules (keyed on ruleId; titles/severity come from V3_RULES) -------------------
  'R-01': {
    plain:
      "A feature you've promised has no test proving it's met, so you can't show it works → add or author a test for it.",
    se: '`REQ` with no incoming `verify` trace (test→requirement coverage, INCOSE V&V).',
    prompt: 'se:close-violations',
  },
  'R-02': {
    plain:
      "A function isn't linked to any feature it's meant to build, so it may be dead code → link it to the feature it serves, or delete it.",
    se: '`FUNC` with no `satisfy` trace to a `REQ` (design→requirement traceability).',
  },
  'R-03': {
    plain:
      'Safety-critical and ordinary features share one module — a fault could leak across → split them into separate modules.',
    se: '`MOD` mixes ASIL-D and ASIL-QM allocations (ASIL = automotive safety integrity level; ISO 26262 freedom-from-interference).',
  },
  'R-04': {
    plain: 'A module does too much or is too tangled → open it and split it.',
    se: '`MOD` with >12 `FUNC`, or 8–12 `FUNC` with >2 flows crossing the module boundary (cohesion/coupling).',
    prompt: 'se-view:arch',
  },
  'R-05': {
    plain: "A test doesn't check any feature you promised → link it to the feature it tests, or remove it.",
    se: '`TEST` with no `verify` trace (test→requirement coverage) to a `REQ`.',
  },
  'R-08': {
    plain: 'A link points at something that no longer exists → repair or remove the broken link.',
    se: 'Trace whose source or target element is missing (dangling reference).',
  },
  'R-10': {
    plain:
      'A piece of data goes nowhere — nothing produces or consumes it → connect it to a function or a person/outside system.',
    se: '`FLOW` with no `io` trace to a `FUNC` or `ACTOR`.',
  },
  'R-12': {
    plain:
      'Two items depend on each other in a loop, so neither can stand alone → remove or redirect one of the two links.',
    se: 'Direct cycle: A→B and B→A via the same trace type.',
  },
  'R-14': {
    plain:
      'A thing a user wants to do is empty — nothing says how it actually happens → add the steps or the feature under it.',
    se: '`UC` with no `compose` to an `FCHAIN` or `REQ`.',
  },
  'R-15': {
    plain: 'A sequence of steps for a use case is empty → add the functions that make it up.',
    se: '`FCHAIN` with no `compose` to any `FUNC`.',
  },
  'R-16': {
    plain: "A person or outside system isn't connected to anything → connect it to the data it sends or receives.",
    se: '`ACTOR` with no `io` trace to a `FLOW`.',
  },
  'R-17': {
    plain: 'The top level of your project is empty — nothing is inside it → add the main use cases, features, or modules.',
    se: '`SYS` with no `compose` to `UC` / `REQ` / `MOD`.',
  },
  'R-18': {
    plain:
      "You connected two items in a combination that isn't allowed → use an allowed link, or fix what's at each end.",
    se: "Trace whose (source-type, target-type) pair isn't an allowed combination in the metamodel of legal links.",
  },
  'R-19': {
    plain:
      "A test that's meant to run doesn't point to a test file → add the link to the test file, or, if it isn't written yet, mark it not-yet-written.",
    se: 'Realized `TEST` with no valid `testRef` `{file, case?, tool}`; else set `concept:true` (a stub).',
  },
  'R-20': {
    plain:
      "A function is supposed to be built but doesn't point to its code → add the link to its code; or mark it not-built-yet / from-an-outside-library.",
    se: 'Realized `FUNC` with no valid `realRef` `{file, symbol}` (graph↔code binding); else `concept:true` / `external:true`.',
  },
  'R-21': {
    plain:
      "Two functions pass data to each other but nothing tests that hand-off → add an integration test that checks the connection works.",
    se: 'FUNC↔FUNC connection (`FUNC` ─io→ `FLOW` ─io→ `FUNC`) whose endpoints share no `FCHAIN` with a verified integration test (`TEST` ─verify→ `REQ` ←satisfy─ `FCHAIN`).',
  },
  'R-22': {
    plain:
      "A function isn't assigned to any building block, so it has no home in the structure → put it on a module.",
    se: '`FUNC` with no `allocate` trace to a `MOD` (deployment assignment); every function lives on exactly one module.',
  },
  'R-23': {
    plain:
      "A building block is empty — no function is assigned to it → put a function on it, or remove the empty block.",
    se: '`MOD` with no incoming `FUNC` ─allocate→ trace; the module-side complement of R-22 (empty-container signal like R-14/R-16/R-17).',
  },
  'RC-01': {
    plain:
      "A function points to code that isn't there anymore (file moved or name changed) → repoint it to the current code.",
    se: 'FUNC `realRef` that does not resolve: file missing on disk or symbol not declared in it (CR-GC-253 conformance over CodeFacts).',
  },
  'RC-02': {
    plain:
      "A test points to a test file or test name that isn't there anymore → repoint it to the current test.",
    se: 'TEST `testRef` that does not resolve: file missing or `case` not declared as an it/test/describe (CR-GC-253).',
  },
  'R-26': {
    plain:
      "A data format in the model isn't linked to the schema code that defines it → link it to the schema (or mark it concept/outside).",
    se: 'Realized `SCHEMA` with no valid `realRef` `{file, symbol}` (graph↔Zod binding); else `concept:true` / `external:true` (CR-211/228).',
  },
  'R-27': {
    plain:
      "A physical part isn't linked to the CAD/geometry that realizes it → link it to the CAD file (or mark it concept/outside).",
    se: "Physical `MOD` (`kind:'physical'`) with no valid `realRef` (CAD/geometry artefact; `symbol` optional); else `concept:true` / `external:true` (CR-228). Logical MODs are realized via their FUNCs' code (R-20), not here.",
  },
  'RC-03': {
    plain:
      "A data format points to schema code that isn't there anymore (file moved or export renamed) → repoint it to the current schema.",
    se: 'SCHEMA `realRef` that does not resolve: file missing on disk or symbol not a declared export in it (CR-211/228 conformance over CodeFacts).',
  },
  'RC-04': {
    plain:
      "A data format is defined but the function on that interface never actually checks incoming data against it → validate with it there.",
    se: 'Bound `SCHEMA` whose symbol is not imported+parsed (`.parse`/`.safeParse`) in any realized `FUNC` io-connected to it (CR-211); warn — the parse may sit in a framework layer.',
  },
  'RC-05': {
    plain:
      "Code in one building block imports code in another, but the model never says those two are connected → draw the connection in the model, or drop the import.",
    se: 'File import crossing a `MOD` boundary with no documenting graph structure (no io/FLOW between the modules) — undocumented cross-module dependency (CR-212); warn indicator, not a blocker.',
  },
  'RD-01': {
    plain: 'A smallest-piece feature has nothing built to fulfil it → add what implements it.',
    se: 'Leaf `REQ` (no `compose`→`REQ` children) with no `satisfy` from a `FUNC`/`FCHAIN`/`MOD`/`SYS`.',
    prompt: 'se:close-violations',
  },
  'RD-02': {
    plain:
      "You split a feature into smaller features but you're also building the big one directly → build only the small pieces, not both.",
    se: 'Parent `REQ` (has `compose`→`REQ` children) carrying a direct `FUNC` `satisfy`; the satisfy belongs on the children.',
  },
  'RD-03': {
    plain:
      'You split a feature into pieces, but all the pieces are handled by the same one thing — the split may be pointless → consider merging them.',
    se: 'Parent `REQ` whose children all share one satisfier.',
  },
  'RD-04': {
    plain:
      'One thing has more than 11 parts directly under it → group them, so each level stays readable.',
    se: 'Decomposition breadth > 11 children on one level (`FUNC` `compose` `FUNC`, `FUNC` `allocate` `MOD`, `SYS`/`MOD` `compose` `MOD`) — introduce an intermediate level.',
  },
  'MT-01': {
    plain:
      'This module depends on many others but few depend on it → it will keep changing whenever they do.',
    se: 'Instability I = fan_out / (fan_in + fan_out) > 0.7 over the module\'s traces (direct MOD↔MOD plus the traces of its allocated `FUNC`s).',
  },
  'MT-02': {
    plain:
      'The parts inside this module never talk to each other → it is really several modules in one.',
    se: 'LCOM4 ≥ 4: the allocated `FUNC`s fall into that many disconnected groups (shared `io`/`satisfy` targets and shared `FLOW`s count as connected).',
  },
  'MT-03': {
    plain:
      'Most of this module\'s communication crosses its own boundary → check whether the split is in the right place.',
    se: 'Allocation cohesion < 80 %: internal / (internal + external) over FLOW-transitive connection pairs of the allocated `FUNC`s (`a` —`io`→ `FLOW` —`io`→ `b`).',
  },
  'MS-01': {
    plain: 'A milestone has no work assigned to it → assign the work items that belong to it.',
    se: '`MS` with no `CR` `relation`.',
  },
  'MS-02': {
    plain: "A milestone waits on another milestone that doesn't exist → fix or remove the dependency.",
    se: '`MS` `depends-on` relation targeting a missing `MS`.',
  },

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
    plain:
      "The requirements document — the features you've promised (`srs` = the slice, `spec` = the full dump).",
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
  SESSION: { plain: 'one recorded work session', se: 'session (audit/provenance record)' },
  CR: { plain: 'one unit of planned work', se: 'change request' },
  MS: { plain: 'a delivery milestone', se: 'milestone' },
  // Trace types (links between things).
  compose: { plain: '"is made up of"', se: 'decomposition / containment' },
  satisfy: { plain: '"this builds that" (a function → the feature it delivers)', se: 'satisfies (design → requirement traceability)' },
  verify: { plain: '"this checks that" (a test → the feature it proves)', se: 'verifies (V&V coverage)' },
  io: { plain: '"data in / out" (function or actor ↔ a data flow)', se: 'input/output interface' },
  allocate: { plain: '"runs inside" (a function → a module)', se: 'allocation (function → structural unit)' },
  relation: { plain: 'a general link (e.g. a work item → a milestone)', se: 'generic association' },
  produces: { plain: '"creates / emits" (a step → the data or record it makes)', se: 'produces (output association)' },
  'depends-on': { plain: '"must come after" (milestone → milestone)', se: 'dependency (a `relation` label)' },
};

/**
 * Element-states note (help-system.md §3): the state on a `FUNC`/`TEST` that decides whether
 * the binding rules (R-19/R-20) apply.
 */
export const HELP_ELEMENT_STATES =
  'A `FUNC` or `TEST` carries a state: **realized** (the default — meant to be built/written now) · ' +
  '`concept:true` (planned, not built/written yet — a stub) · `external:true` (provided by an outside library, not built here).';
