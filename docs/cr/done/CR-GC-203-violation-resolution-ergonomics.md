# CR-GC-203: Violation-resolution ergonomics & SSOT tooling

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` · **Datum:** 2026-06-20 · **Max Files:** 5 (split per item)

> **Close-Befund (2026-06-20):** Alle 6 Items implementiert + getestet, je als eigener Commit:
> - **Item 1 (fix-context):** `fixHint` + `context` (candidate_targets/existing_traces) durch graph-api-core `RuleViolation` (0.3.0) + contracts harness `RuleViolationSchema` (0.4.0) + harness.runRules → `rules_get_violations`/`rules_evaluate`. `tests/mcp.violation-context.test.ts`.
> - **Item 2 (summary mode):** `graph_readiness` `detail?:boolean` (default summary) via `summarizeReadiness()` — bleibt unter MCP-Limit auf rotem Graph.
> - **Item 3 (ranked):** `toCandidates(elements, ref)` rankt nach Token-Overlap (R-01/R-02/RD-01; RD-01 emittiert jetzt Kandidaten). RULES 2.0.0→2.1.0.
> - **Item 4 (graph_reseed):** `harness.reseed()` clear+reimport in-process (DETACH DELETE durchs offene Handle) → ersetzt den korruptions-anfälligen `rm .graphcode/kuzu`-Tanz. `tests/mcp.reseed.test.ts` (Store-Level no-corruption proof). 14. Tool.
> - **Item 5:** `.claude/skills/se-close-violations.md` (Resolutions-Loop über die gerankten Kandidaten).
> - **Item 6:** (a) `.claude/skills/se-author-req.md` (REQ+TEST+verify in einem Gate-Batch); (b) `importGraph` surfaced unverifizierte REQs (`unverifiedReqs`) + opt-in `rejectUnverifiedReqs` — Bypass nie mehr still; Self-Seed flaggt statt zu refusen (kein Bootstrap-Deadlock). `tests/harness.import-invariant.test.ts`.
>
> Skill-Count 15→17, Tool-Count 12→14 (graph_tests+graph_reseed). 137/137 Tests grün. **FRR 0.833→0.917** (nur noch CR-GC-115 offen).
**Graph (SSOT):** new `CR-GC-203` node, `relation`→`MS-4-mvp2`. Touches `MOD-harness` (runRules mapping), `MOD-mcp-tools` (tool surface), `MOD-skills`.

## Problem (Why)
Bringing the governed graph to zero error-violations took ~73 hand-authored mutations (49 `verify` + 20 `satisfy` traces + 1 RD-02 move + 3 deduced TESTs). The mapping work was mechanical, yet the agent had to re-derive it by querying every TEST/FUNC/MOD and pattern-matching by name — because **the data that would make it automatic is computed and then discarded.** Observed during the 2026-06-20 spec-green run (after the CR-GC-201 SSOT fix).

Root inefficiencies, code-grounded:
- **Fix-context is dropped.** `@sigloch/contracts/se/rules.ts` builds `fix_hint` + `context.candidate_targets` (+ `existing_traces`) for every violation. `GraphCodeHarness.runRules()` (harness.ts) maps each violation to `{ruleId,severity,message,elementId}` only → `rules_get_violations`/`rules_evaluate` hand the agent a problem with **no candidates and no hint**.
- **`graph_readiness` overflows.** It inlines every blocking element; on a red graph it returned **86 677 chars**, past the MCP tool result limit → forced file-spill + extra round-trips.
- **No in-process reseed.** Adopting a newer committed JSON requires stop-server → `rm .graphcode/kuzu*` → restart; deleting while the server runs **corrupts the store** (0 edges). A foot-gun with no guard rail.
- **Candidate set too broad.** R-01's `candidate_targets` is *all* TESTs — no ranking, so the agent still hand-picks.

## Decision (proposals, prioritized)
1. **Surface fix-context through the harness + MCP (highest leverage).** Stop flattening in `runRules()`; carry `fix_hint` + `context.candidate_targets` + `existing_traces` into `RuleViolation` and return them from `rules_get_violations`/`rules_evaluate`. Verify the graph-api-core engine preserves them (or evaluate via the contracts `evaluateRules` directly). → an agent resolves R-01/RD-01 from the violation itself.
2. **`graph_readiness` summary mode.** Add `detail?: boolean` (default false): return scores + counts + `violationsByRule` only; full blocking lists on `detail:true`.
3. **Ranked candidates.** In `reqMustHaveVerification` / `unresolvedRequirement`, rank `candidate_targets` by name/description token overlap so the top hit is usually correct (`REQ-pre-import → TEST-bootstrap`). Ranking ≠ auto-link — semantic confirmation stays with the caller.
4. **`graph_reseed` MCP tool (in-process).** Owner-process clears + re-imports the committed JSON behind the single-writer; removes the restart dance and the delete-while-running corruption path. Pairs with the CR-GC-201 drift warning.
5. **`se-close-violations` skill.** Loop: `rules_get_violations` (with candidates) → propose `verify`/`satisfy` edges ranked by overlap → caller confirms fit → batch `graph_mutate` → re-eval → repeat until green or genuinely ambiguous (then ask). Codifies the manual run; keeps the human on the semantic judgment.

6. **REQ-with-test as an authoring invariant ("intrinsic proof") — the preventive item.** A REQ you cannot state a verification for is not well-formed: the test *concept* (target + tool + constraint, **not** code) is the intrinsic proof the REQ is meaningful and falsifiable. Items 1–5 are *remedial* (clear accrued unverified REQs); this one **stops the debt accruing**. Two parts:
   - **Author REQ + TEST together.** The capture/authoring skill emits every new REQ in the same gated batch as a concept-level TEST node + `verify` trace. The gate already enforces this for interactive mutations — a lone REQ introduces an R-01 error and is **blocked under delta-semantics** — so this is mostly making the workflow lean into the gate instead of working around it.
   - **Close the bypass.** `seedFromJson`/`importGraph` call `storage.saveNodes/saveEdges` **directly, not through `mutate()`**, so bulk-imported REQs skip the R-01 check (this is how the 49 unverified REQs entered). Route import through the gate, or add a post-import validation pass that **refuses/flags** any REQ without a `verify` trace — so "no REQ without a test concept" holds on *every* write path, not just interactive ones.

## Scope note: quality vs. documentation
These improve the **speed and ergonomics of reaching spec-green**, which is governance/traceability — **not code generation.** The traces they help author pay off in code only later, via `graph_impact` → impact-based test selection, and **only once the referenced TESTs/FUNCs are implemented** (today many are `open`). The genuine code-quality lever remains *implementing the deduced TEST/FUNC nodes* (what SVR/FRR flag), not faster trace authoring. This CR is explicitly tooling/DX, not a code-quality claim.

## Akzeptanz
`rules_get_violations` returns `candidate_targets` + `fix_hint`; `graph_readiness` summary mode stays within the tool limit on a fully-red graph; `graph_reseed` re-syncs the store with no manual file deletion; `se-close-violations` drives a red graph to green with caller confirmation and zero fake traces; **adding a REQ without a `verify`-traced TEST is rejected on every write path (interactive gate + import)**. Each item lands as its own ≤5-file sub-CR.

## Dependencies
CR-GC-201 (gate-only writes / lossless SSOT — done), CR-GC-101 (MCP registry). Independent of CR-GC-200/202.
