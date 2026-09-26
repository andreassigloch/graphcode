# Proposal — In-context Help: every dashboard item explained, for both audiences

**Status:** Draft (2026-06-28) · **Branch:** `help` · **Author:** andreas@siglochconsulting + Claude
**Realizes as:** a CR chain (see §10) — this proposal is the design note, not yet the change.
**Relates:** [readiness-artifact-model.md](readiness-artifact-model.md) (the panels this explains),
[help-rules-content.md](help-rules-content.md) (the 20-rule content). **Open-CR dependencies & conflicts: §12** —
this concept *renders over* the artifact/gate model that CR-GC-220→226 define and must be sequenced after it.

> Scope: define **what help graphcode surfaces** behind every dashboard item, the `/help` command, and a
> rules reference — so a user can self-serve the *what / why / how* (best case: a prompt to copy) **without
> already knowing our ontology or systems engineering**. graphcode owns the help **data layer** (pure
> projections, like `panels.ts`); the renderer draws the boxes. No new viewer in the core.

## 1. Problem (Why)

**Root cause.** The dashboard names things but never explains them. Recommendations prints `R-04` with no
statement of what R-04 *is*; a gate shows a red light labelled `CDR` with no statement of what passing it
would mean. The only explanations that exist are scattered across MCP tool descriptions, code comments, and
`bok/` — none reachable from the item the user is looking at.

**Impact.** Two real user groups can't act on what they see:

- **SE without our ontology** — a systems engineer who knows INCOSE, V&V (verification & validation), FMEA,
  traceability, but not *our* names: `FCHAIN`, the `satisfy`/`verify` trace split, that `R-04` means module
  size, that `CDR` owns rules `R-03/R-04/R-12/…`. They know the concept, not our encoding.
- **User without SE** — a developer or PM who knows code but not systems engineering: doesn't know what a
  "requirement" formally is, why a "requirement without a test" is a defect, or what an "INCOSE phase gate"
  decides. They know neither the concept nor the encoding.

A help text written for one of these readers fails the other. Written for an expert, it loses the PM;
written for a beginner, it patronises the SE and still doesn't map our jargon to theirs.

**Fix.** A single help model with **three layered statements per item** — *Plain* (no SE), *In SE terms*
(maps our encoding to the standard SE concept), *Exact* (the rule ID / tool / prompt) — resting on **one
canonical Vocabulary** (§3) so every product token resolves in exactly one place. Surfaced through three
places: per-item info boxes, a context-sensitive `/help`, and a rules reference. Content is **derived from
the same single sources the rules and gates already use** (`V3_RULES`, `readiness.ts`, the MCP registry)
wherever a source exists; only the two plain-language layers and the Vocabulary are authored. Decision
needed from you: **accept the three-layer model + Vocabulary + the headless split (§8)** before the CR chain.

## 2. The two audiences — the design contract

The binding acceptance contract for every help string. The same item, read three ways:

| Layer | Reader | Answers | Test it must pass |
|---|---|---|---|
| **Plain** | user without SE | "What is this in everyday terms, why care, and what's the one action?" | A developer who never heard "requirement traceability" understands the *why* and the *one action* **from the Plain cell alone**. |
| **In SE terms** | SE without our ontology | "Which standard SE concept is this, and what do *we* call it?" | An INCOSE-literate engineer can map our token to the concept they already know **from the SE cell + the Vocabulary alone**. |
| **Exact** | power user / agent | "What exactly do I run?" | A copy-able prompt or tool call that works against this repo today. |

**Token rule (from CLAUDE.md — the Cold-Reader-Test):** every internal token resolves either via an inline
≤4-word gloss **or** the Vocabulary legend (§3). No token may require repo/history context. The help system
is the one place this is not optional — a help text that needs prior context to read is self-refuting.

**Action rule:** the Plain cell must end in a plain-English action. The tool/prompt (jargon allowed) lives
in the Exact layer; a Plain reader is never sent to a jargon-only column for the *do-this*.

**Roll-up, not detection (the design decision behind "both audiences").** graphcode never guesses who the
reader is — it has no user identity (headless, one store per repo, no session; profiling would be state *and*
a parallel path, both locked-out). Every `HelpEntry` **always carries all three layers**; the *surface*
chooses depth, exactly like a readiness gate rolling up to its `blocking[]` elements:

- **GUI** — Plain shown; *In SE terms* and *Exact* behind an expand (progressive disclosure).
- **Text / `/help`** — all three stacked (Plain → SE → Do this); the reader scans to their level (as in §7).

So "fair for both groups" is not achieved by routing each user to a different text — it's the *same* full
entry, drilled to the depth the reader wants. An optional single `audience: plain|se|all` default may live in
`HarnessConfig` later (default `all`) — a preference, never a classifier. No profiling, no per-user state.

## 3. Vocabulary — the one legend both layers point to

Every element and trace token, mapped once. Cells below use the token; the reader resolves it here. This is
the Rosetta stone between Plain and SE. The **token list** is derived from the ontology in
`@sigloch/contracts/se`; the Plain-phrase and standard-SE-concept columns are **authored** mapping.

**Things in the model (element types).** *The "model" = everything you've defined about the project —
requirements, functions, tests, modules, and how they connect — kept in the graph.*

| Token | Plain phrase | Standard SE concept |
|---|---|---|
| `SYS` | the whole system | system (top of the hierarchy) |
| `UC` | a thing a user wants to do | use case |
| `ACTOR` | a person or outside system that interacts with it | actor (external entity) |
| `FCHAIN` | the ordered steps that make a use case happen | function chain / functional thread |
| `FUNC` | one function the software performs | function (behavioural element) |
| `FLOW` | a piece of data moving between parts | data / control flow |
| `REQ` | a feature you've promised to build | requirement |
| `TEST` | a check that proves a feature works | test case |
| `MOD` | a module / code package | module (structural unit) |
| `SCHEMA` | the shape of a piece of data | data schema |
| `CR` | one unit of planned work | change request |
| `MS` | a delivery milestone | milestone |

**Links between things (trace types).**

| Token | Plain phrase | Standard SE concept |
|---|---|---|
| `compose` | "is made up of" | decomposition / containment |
| `satisfy` | "this builds that" (a function → the feature it delivers) | satisfies (design → requirement traceability) |
| `verify` | "this checks that" (a test → the feature it proves) | verifies (V&V coverage) |
| `io` | "data in / out" (function or actor ↔ a data flow) | input/output interface |
| `allocate` | "runs inside" (a function → a module) | allocation (function → structural unit) |
| `relation` | a general link (e.g. a work item → a milestone) | generic association |
| `depends-on` | "must come after" (milestone → milestone) | dependency |

*Which element types each trace may legally connect is not restated here — that's the metamodel
(`TRACE_PATTERNS`), surfaced live by `graph_authoring_guide` (CR-GC-231). Help links to it rather than
hand-listing legal pairs, so the two can't drift.*

**Element states (attributes).** A `FUNC` or `TEST` carries a state that decides whether the binding rules
(R-19/R-20) apply: **realized** (the default — meant to be built/written now) · `concept:true` (planned, not
built/written yet — a stub) · `external:true` (provided by an outside library, not built here).

## 4. Content model — one shape, mostly derived

```ts
interface HelpEntry {
  id: string;                 // dashboard item id, gate id, ruleId, or tool name
  title: string;              // plain-language title (NOT the raw token)
  token?: string;             // the raw on-screen token, if different (e.g. "R-04", "CDR")
  plain: string;              // Layer 0 — no SE; ends with the one plain action
  se: string;                 // Layer 1 — maps our encoding → standard SE concept (uses §3)
  why: string;                // why this matters / what breaks if ignored
  prompt?: string;            // Layer 2 — copy-able prompt (real se:* skill or MCP tool)
  source: 'derived' | 'authored';
}
```

**Derived vs authored (anti-drift).** Where a single source already encodes a fact, help reads it instead
of restating it (lesson from the test-count coupling fix — derive from the live registry, never a parallel
hand-count):

| Field | Derived from | Authored |
|---|---|---|
| rule `title`, `severity`, `message`, fix | `V3_RULES` (`@sigloch/contracts/se`) | — |
| gate → owned-rules mapping | `readiness.ts` (`PHASE_GATES`/`IMPL_GATES`) | — |
| tool name + one-line purpose | MCP registry (`mcp-tools.ts`) | — |
| Vocabulary "plain phrase" + the Plain & SE layers | — | yes (the only hand-written parts) |

A new rule or tool appears in help automatically; only its two plain-language sentences need authoring. No
local rule parser, no forked catalog — respects the locked "`V3_RULES` imported, never forked" constraint.

## 5. Three help surfaces

1. **Per-item info box** (§6) — every dashboard item gets an `(i)` affordance → its `HelpEntry`.
2. **Context-sensitive `/help`** (§7) — the explained sibling of Recommendations: reads live readiness +
   violations, returns *ranked, explained measures* with copy-prompts, for both audiences.
3. **Rules reference** (§8) — the `R-04` rollup the user asked for: a tooltip on any rule token plus a full
   "Rules" tab, both generated from `V3_RULES`.

## 6. Per-item content — every dashboard item

### 6a. The five panels

| Item | Plain (what + why + action) | In SE terms | Copy-prompt |
|---|---|---|---|
| **Readiness** | How finished the project is: one percentage plus eight checks. A red check tells you which part still has problems — open it to see them. | Compliance score (error-clean elements ÷ total) + eight gates: four INCOSE design reviews + four milestone-acceptance gates (§6c–d). | `se-status` |
| **Recommendations** | The top things to fix next, biggest impact first — fixing them is what raises the readiness number. | The current rule violations ranked by severity (errors first, then warnings), each with the suggested link to add. | `se:close-violations` |
| **Artifacts** | Which project documents are current, out-of-date, or missing — a missing failure-analysis or an out-of-date spec is hidden risk, shown here as a traffic light. | INCOSE artifact freshness: 🟢 live · 🟡 stale · 🔴 absent, split into *renders* (re-derivable from the model → fix by re-export) and *creations* (need fresh analysis → fix by re-analysis). | `se-review` |
| **Impact** | If you change this one thing, see exactly what else is affected — so you can scope the change instead of guessing. | Change-impact set (dependency closure): the dependent elements of a node. Standard change-impact analysis. | "Show the change-impact set of <element-id> with graph_impact." |
| **Health** | Is the tool itself working right now — if not, every other number is meaningless, so check here first. | Store reachable + apply-gate functional + ontology/rules/contracts versions, proven by real queries (not a ping). | "Check graphcode health: store, gate, versions." |

### 6b. The three Readiness numbers

| Item | Plain (what + why + action) | In SE terms |
|---|---|---|
| **Compliance %** | The share of things you've defined (requirements, functions, tests, modules…) that have no serious problem. 100% only when all are clean. It's the single "are we there yet" number; the gates show *why* it's below 100. | `(totalElements − elementsWithErrors) / totalElements`; the one quantitative readiness KPI. |
| **Total elements** | How many items you've defined in total. It's the denominator behind the percentage. | Count of all ontology elements (`REQ`/`FUNC`/`TEST`/`MOD`/…). |
| **Elements with errors** | How many of those items have a serious problem you need to fix — each one is listed in Recommendations. | Elements carrying ≥1 `error`-severity violation. |

### 6c. Phase gates — the four INCOSE design reviews

Each gate passes when its owned rules are error-free **and** its required *creations* are current
(CR-GC-221 adds `creationArtifacts` to the gate). A gate can therefore be rule-clean yet **red because a
required analysis was never performed** (e.g. no FMEA) — the Plain "Red:" branch below names that case. These
creation-not-done blockers are **not** rule violations: they come from `ReadinessGate.blocking[]` (CR-GC-221),
so help keys them on the artifact id, not a `ruleId` (see §7).

| Gate (token) | Plain — what passing/red means + action | SE concept (INCOSE) | Owned rules | Copy-prompt |
|---|---|---|---|---|
| `SRR` | **Pass:** every feature you've promised is written down clearly and each can be checked by a test. **Red:** open it to see which features are missing a test → author one. | System Requirements Review — the requirements baseline is complete, consistent, feasible, and verifiable before design starts. | R-01, R-14, R-17 | `se-review`, then `se:author-req` |
| `PDR` | **Pass:** there's a high-level design — the functions, the data moving between them, and the people/systems that use it. **Red:** open it to see what's not yet connected. | Preliminary Design Review — the architectural design meets requirements at acceptable risk, mature enough to start detailed design. | R-02, R-10, R-15, R-16 | `se-view:arch` |
| `CDR` | **Pass:** the detailed design is ready to build — no module too big, nothing depends on itself in a loop, every link is allowed, every function points to its code. **Red:** open it to see which of those is off. | Critical Design Review — the detailed design is complete and sound enough to start building. | R-03, R-04, R-12, R-18, R-20, RD-01–03 | `se-view:rtm`, `se-view:arch` |
| `TRR` | **Pass:** every test is connected to the feature it checks and can actually run. **Red:** open it to see the unwired or non-runnable tests. | Test Readiness Review — test cases and bindings are ready to begin formal verification. | R-05, R-08, R-19 | `se-view:testmatrix`, then `se:close-violations` |

### 6d. Implementation gates — the four milestone-acceptance gates

> **Naming note (honesty):** these four reuse standard INCOSE review acronyms, but **in this product each
> one means simply "its delivery milestone is fully delivered."** Where the standard meaning differs, it's
> shown in parentheses so an SE reader isn't misled.

Each passes when every change-request assigned to its milestone is done and that milestone's scope is
error-clean. Red = the milestone isn't finished — open it to see the change-requests still left.

| Gate (token) | Plain — passing means + action | In SE terms |
|---|---|---|
| `SAR` | Milestone 1 (specification) is fully delivered. Red → see the open work items for MS-1. | Here: MS-1 acceptance. (Standard: System Acceptance Review.) |
| `FCA` | Milestone 2 (writing the code and checking it works) is fully delivered. | Here: MS-2 acceptance. (Standard: Functional Configuration Audit — as-built matches requirements.) |
| `SVR` | Milestone 3 (MVP readiness) is fully delivered. | Here: MS-3 acceptance. (Standard: System Verification Review — system meets its requirements.) |
| `FRR` | Milestone 4 (second MVP) is fully delivered. | Here: MS-4 acceptance. (Standard: Functional Readiness Review.) |

### 6e. Artifacts (per the render/creation split)

The info box states purpose, whether it's a *render* (current source = the model; fix staleness by
re-export) or a *creation* (needs fresh human/agent analysis; fix by re-analysis), and the skill.

> **Source of rows, `kind`, and names (do not re-derive):** the artifact set and the view enum come from
> CR-GC-220, the render/creation `kind` from `ArtifactStatus.kind` (CR-GC-222), and the canonical names from
> CR-GC-223 — e.g. *IRR → "Assumption Review"*, render skill `se-view:irr → se-view:fmea`, and `spec` (full
> dump) is split from `srs` (REQ-slice). This table only adds the Plain/SE/prompt layers over those. The rows
> below are illustrative until that chain lands.

| Artifact | Plain | Kind | Copy-prompt |
|---|---|---|---|
| srs / spec | The requirements document — the features you've promised (`srs` = the slice, `spec` = the full dump, CR-GC-220). | render | `se-view:rtm` for coverage |
| architecture | The map of modules and how functions sit in them. | render | `se-view:arch` |
| rtm | Which test covers which feature, and the gaps. | render | `se-view:rtm` |
| nfr | How the project is doing against its speed/quality targets. | render | `se-view:nfr` |
| icd | The document of how the modules talk to each other. | render | `se-view:icd` |
| testconcept / testmatrix | The test plan and how much it covers. | render | `se-view:testconcept` / `se-view:testmatrix` |
| changelog | What changed (from the audit trail). | render | `se-view:changelog` |
| intplan | The milestones, work items, and their order. | render | `se-view:intplan` |
| conops | How the system is operated and who uses it. | creation | `se-view:conops` |
| assumption-review *(was IRR)* | The unproven assumptions and how risky they are. | creation | `se-irr` (CR-GC-223) |
| trade | The design options weighed and the choice made. | creation | `se-view:trade` |
| fmea | The "what can break and how it's handled" analysis. | creation | `se-fmea` |
| implplan | The work slices and milestones (a judgment, not auto-derived). | creation | `se-plan` (create) / `se-view:implplan` (render) |

## 7. Context-sensitive `/help` — the explained Recommendations

`/help` with no argument is the **teaching** counterpart of Recommendations. Same input (live readiness +
violations), different output: instead of `R-04 · MOD-x · 13 functions`, it returns measures *explained for
both audiences*, ranked by readiness impact, each ending in a copy-prompt:

```
/help  →
  You're at 72% readiness. The two checks holding you back:

  1. System Requirements Review (SRR) is red — 4 features have no test.
     Plain:  4 features you promised aren't checked by any test, so you can't prove they work.
     SE:     4 REQ with no incoming `verify` trace — R-01 (REQ must have verification), error.
     Do this →  "Run se:close-violations to link or author the missing tests."

  2. Critical Design Review (CDR) is red — one module is too large.
     Plain:  one module is doing too much; split it so it stays maintainable.
     SE:     MOD-billing has 13 FUNC with crossing flows — R-04 (max module size), warning.
     Do this →  "Show MOD-billing with se-view:arch and propose a split."
```

`/help <token>` is the targeted form: `/help R-04`, `/help CDR`, `/help recommendations`, `/help impact`
→ that item's `HelpEntry`. So `/help` is both the index (no arg) and the lookup (with arg).

Distinction from Recommendations (no parallel path): Recommendations is the **terse action list** for
someone who already knows the system; `/help` is the **explained** view of the same data plus the static
item lookups. They share the readiness/violations source; `/help` adds the two authored layers and the rule
explanations. Recommendations stays as-is.

**Two blocker kinds (CR-GC-221).** A gate can be red for a rule violation *or* for an un-performed creation
(e.g. "FMEA not performed"). The first resolves via the `V3_RULES`-derived path; the second is a string in
`ReadinessGate.blocking[]` with no `ruleId`. `contextualHelp` must explain both — keying rule blockers on
`ruleId` and creation blockers on the artifact id (→ the relevant `se-*` create skill from §6e).

## 8. The `R-04` rollup + Rules tab (the user's explicit ask)

Two presentations of one generated catalog:

- **Rollup / tooltip** — hovering, or `/help R-04`, anywhere a rule token appears returns:
  `R-04 — Max module size (warning). Plain: this module does too much; split it. SE: a MOD with >12 FUNC,
  or 8–12 FUNC with >2 flows crossing the module boundary (cohesion/coupling). Fix: se-view:arch, then split.`
- **Rules tab** — the full catalog of all 20 rules, grouped by the gate that owns them (so a user sees
  *which review each rule serves*), each row = the `HelpEntry`. Generated from `V3_RULES` + the gate map in
  `readiness.ts`; the only authored part is the Plain/SE sentence pair per rule.

The complete authored rule content is in [help-rules-content.md](help-rules-content.md) — all 20 rules,
three layers each.

## 9. Where it lives — headless boundary

graphcode **is not a viewer**, so the split mirrors `panels.ts`:

- **graphcode owns** a pure data layer `src/viewer/help.ts` — `helpEntry(id)`, `helpForRules()`,
  `contextualHelp(readiness, violations)` — projecting `V3_RULES` + `readiness.ts` + the panel view-models
  into `HelpEntry[]`. No DOM, no HTTP beyond the existing read-only bridge. Plus a thin `graph_help` MCP
  tool and a `se:help` skill so help is reachable **today** in Claude Code (a client), before any GUI.
  (`se:help` ships with `version:` frontmatter and is registered in the skills-conformance list, or
  `graphcode skills sync` + the skill-count tests break — CR-GC-208. `GRAPHCODE.md` (CR-GC-207) points its
  static onboarding line at `se:help` as the live entry.)
- **The renderer owns** the info-box `(i)` affordance, the tooltip, and the Rules tab — graph-view-edit's
  job, the same way it owns the Cytoscape mount-slot.

This gives "fair support for both groups" immediately via `se:help` (text), and a clean data contract for
the eventual GUI — no second source, no viewer in the core.

## 10. Realization — CR chain (each ≤5 files)

1. **CR-A — authored content:** the Vocabulary plain-phrase column + the panel/gate/artifact Plain/SE
   strings + the 20 rule pairs ([help-rules-content.md](help-rules-content.md)) → move into the contracts
   skill source, co-located with `V3_RULES`, as a typed `HELP_CONTENT` map.
2. **CR-B — data layer:** `src/viewer/help.ts` — `helpEntry`, `helpForRules`, `contextualHelp`; pure,
   derived. Unit-tested against the live registry (adding a rule must not break a test).
3. **CR-C — surfaces:** `graph_help` MCP tool + `se:help` skill (no-arg = contextual, `<token>` = lookup).
4. **CR-D — docs:** README "help" line; GRAPHCODE.md pointer; supersede scattered explanations.
5. **(renderer)** info box + Rules tab — tracked in graph-view-edit, out of graphcode scope.

**Sequencing (hard dependency).** This chain runs **after** CR-GC-220→226 close. `help.ts` projects three
fields that don't exist yet: `ArtifactStatus.kind` (CR-GC-222), `ReadinessGate.creationArtifacts` /
`blocking[]` creation entries (CR-GC-221), and the view enum + `srs`/`spec` split (CR-GC-220). Building help
first would force a parallel artifact/gate model — the exact drift this concept forbids.

## 11. Acceptance — the fairness test (how we know we're done)

Done = **both** persona checks pass on the full content set, not a spot check:

- **Persona A (SE, no ontology):** for every gate and rule, can map our token to a standard SE concept from
  the SE cell + the Vocabulary alone. Fail = any SE-layer cell that needs our naming and isn't in §3.
- **Persona B (no SE):** for every panel and the top-5 contextual measures, can state the *why* and the
  *one action* from the Plain cell alone, no SE vocabulary. Fail = any Plain cell that leaks an unglossed SE
  term or omits the action.

Both run as adversarial reads (a reviewer flags the first token they can't resolve). The loop closes when a
full pass surfaces zero blocking tokens for either persona.

**Convergence (this proposal's branch).** Three rounds, both personas:

| Round | Persona A (SE, no ontology) | Persona B (no SE) | Drove |
|---|---|---|---|
| 1 | FAIL — 24 | FAIL — 18 | the §3 Vocabulary; standard-INCOSE gate column; honest acronym-collision flag; plain action in every cell |
| 2 | FAIL — 5 (N1–N5) | FAIL — 2 (N1–N2) | allocation 1:1 map; R-18 example; §3 element-states note; prompt + derived-honesty wording |
| 3 | **PASS — 0** | **PASS — 0** | — |

Both groups can now self-serve every dashboard item from the layer addressed to them. Loop closed.

## 12. Open-CR integration & sequencing

Cross-check of the open CRs that touch the dashboard / viewer / skills / rules surface. Relationship to this
concept: **DEP** = help consumes its output (defer, don't redefine) · **CONFLICT** = contradicts a current
statement here (fix before the chain) · **OVERLAP** = does similar derivation (parallel-path risk) ·
**ADJ** = related, no shared surface.

| CR | What it changes | Rel | Contact point + action |
|---|---|---|---|
| **220** deterministic render views | 12 artifacts → deterministic MD views + view enum; `srs` (slice) ≠ `spec` (dump) | DEP | §6e rows + enum come from CR-220, not a hand-list; added the `srs`/`spec` split. |
| **221** creations as gate precondition | gate `creationArtifacts`; gate red if a required creation is 🔴, with non-rule `blocking[]` strings | CONFLICT→fixed | §6c "Red:" now names the creation case; §7 now handles non-rule blockers keyed on artifact id. |
| **222** artifact-tab kind-split | `ArtifactStatus.kind` (`render`/`analysis`); INCOSE vs graphcode grouping; IRR rename | CONFLICT→fixed | §6e `kind` is **read** from CR-222; *IRR → "Assumption Review"* applied. |
| **223** creation skills | renames `se-view:irr → se-view:fmea`; adds `se-irr`/`se-conops`/`se-trade` | CONFLICT→fixed | §6e prompts updated to post-223 names; `implplan` split create (`se-plan`) vs render. |
| **226** supersede `lean = no artifacts` | finalizes the create/render split in `readiness.ts` | DEP | The whole §6c–e split only exists once 226 lands → §10 sequenced after it. |
| **231** `graph_authoring_guide` | read-only tool projecting legal edges from META_MODEL | OVERLAP | §3 trace-legality now **links to** CR-231 (was CR-217, renumbered), not a second hand-kept legal-pair list. |
| **208** skill sync + surfacing | `skills sync` + `version:` frontmatter + conformance list | DEP | §9/§10-C: `se:help` carries `version:` + is in the conformance list. |
| **207** onboarding contract | static `GRAPHCODE.md` "graph-first" one-screen | ADJ | §9: `GRAPHCODE.md` points at `se:help` (the live counterpart). |
| **216** `graph_realize` | flat write for codeRef/testRef (R-19/R-20) | ADJ | R-19/R-20 Exact prompts can cite `graph_realize` as the one-call fix. |
| **224/225** view-skills → thin-trigger | `se-view:*` become deterministic thin triggers | ADJ | §6e copy-prompts unchanged (names survive); output becomes byte-stable — a bonus. |
| **211** UC authoring guardrail | jargon-budget linter for UC content | ADJ | Same Cold-Reader discipline as §2; the §3 Vocabulary is the term-lookup it points to. |
| **209** `se-plan` impl-plan generator | generates MS/CR ordering (create side of `implplan`) | ADJ | §6e `implplan` create-prompt is `se-plan`. |
| 210, 212, 214, 215, 218, 219 | tool-format, KPI-retro, hooks, isolation, attr-flatten | — | Not relevant to the help surface. |

**Bottom line:** two true conflicts (IRR naming, gate creation-precondition) are now fixed in-text; the
artifact rows / `kind` / view enum / gate `blocking[]` are **owned by CRs 220–226** and this concept defers to
them; the help CR-chain (§10) is sequenced **after** that chain so no parallel model is built.
