# graphcode — development guardrails

Read `README.md` first for what graphcode is and how to run it. This file is the binding set of
**constraints and invariants** for anyone (human or agent) working in this repo. General working
rules live in the user's global instructions; only what is specific to this repo is here.

## What graphcode is / is not

- **IS:** a governed **graph substrate** (Bridge + Store + MCP surface). Agent-agnostic, headless,
  one Kuzu store per repo. A coding agent (Claude Code, OpenCode, …) is a client.
- **IS NOT:** a generator, a learning engine, a viewer/dashboard, or a code extractor/slicer. Harness-only.

## Ask the graph, don't grep for it

The graph answers structural questions **exactly**. Grep approximates them. Measured on 2026-08-27
during this repo's own restructure: **0 calls to `graph_impact`, 174 search operations** — while
the same rebuild moved 810 model elements. That is the failure mode this section exists to prevent.

| Question | Tool — not grep |
|---|---|
| What breaks if I change X? | `graph_impact(uid)` — the exact blast radius, typed and complete |
| What else hangs off this node? | `graph_expand(uid)` — one level deeper, on demand |
| What is X, and what does it require? | `graph_context(uid)` — description, edges, refs in one slice |
| Where is this realized in code? | the `realRef` attribute — `graph_context` returns it and lists gaps under `missingRefs`; never grep the name |
| Which elements of type X exist? | `graph_elements({type, search})` |
| Which tests must I run for *this* change? | `graph_tests({changeSet})` — the minimal `vitest run <affected files>`, not the whole suite |
| Which tests cover this node? | the node's `testRefs` from `graph_context` |
| Which rules are violated, and where? | `rules_evaluate` · `rules_get_violations` |
| What should I do next? | `graph_next_step` |
| Which architecture move pays off? | `graph_suggest` (ranked against the target profile) |
| How coupled are the modules? | `graph_metrics` — cohesion per MOD |

Grep stays right for what the graph does not model: *which file contains this string*, *where does
this symbol live now*, free-text search across prose. It is wrong for anything in the table above.

**Before a broad search, ask which of these tools answers the question.** A precise query beats
compressing a large result.

## Locked constraints

- **One store = Kuzu** — embedded, single-writer, exactly one owner process per repo. Never a second
  DB handle. Persistence is on disk, never `:memory:`.
- **One transport = MCP-stdio** for the agent (+ a read-only SSE bridge for a live viewer). No
  Express/REST in the core.
- **One Apply-Gate = `mutate()`** — every edit (human *or* AI) goes through the same gate; the author
  is only logged. No hand-edit of the graph SSOT. `reseed` / `rewind` / `seedFromJson` are
  **operations**, not edits — they replace the state, kernel-internal; neither a second write path
  nor a gate bypass (CR-GC-467).
- **Dependency direction is a DAG** — `kernel ← loop ← projections ← surface ← index/cli`. The
  kernel (store · measurement · gate) knows no client; measurement (readiness, fit-advisory,
  test-selection, similarity) sits *below* the gate because the gate judges with it. Enforced by
  `tests/import-boundaries.test.ts` as a ratchet: the known debt is listed there and may only
  shrink (CR-GC-467; derivation and measurement in CR-DRAFT-GC-466).
- **Two trees** — `MOD` is the dependency tree, `FUNC` the value tree (Grounding · Führung ·
  Optimierung · Betrieb). They do **not** mirror each other; cutting modules "along the story
  blocks" is not a cleanup (CR-DRAFT-GC-461, CR-GC-467).
- **SE ontology + `V3_RULES` come from `@sigloch/contracts/se`** — imported, never forked. A new
  ElementType/TraceType/TRACE_PATTERN/rule requires a contracts version bump, not a local rule parser.

All interfaces are Zod. Harness schemas (`HarnessConfig` / `MutateCommand` / `MutateResult`) live in
`@sigloch/contracts` — do not redefine them locally (no parallel paths).

## Enforced, not documented

These invariants are **enforced** — no prose-trust, no re-documenting as a rule:

- **Gate-only writes** — every model edit goes through `mutate()`; direct edits of the graph SSOT are
  blocked by the PreToolUse hook `.claude/hooks/deny-graph-write.sh` + the Apply-Gate.
- **Structural validity** — trace-pair legality against `TRACE_PATTERNS` is engine rule **R-18**
  (`@sigloch/contracts/se`); the gate does not call a separate `codec.validate()`.
- **Binding completeness** — a runnable TEST carries `testRef` (**R-19**), a realized FUNC carries
  `codeRef` (**R-20**); both surface as warnings in `rules_evaluate` / `readiness`. Export
  materializes missing testRef stubs (`it.todo`, no phantom path).
- **Dependency direction** — `tests/import-boundaries.test.ts`: an import pointing up the layer
  order fails the suite unless it is listed as known debt, and listed debt that no longer exists
  fails it too.
- **No binary / NUL corruption in source** — PreToolUse hook `.claude/hooks/deny-binary-source.sh`.
- **Read-before-edit** — harness built-in (Edit requires a prior Read).

## Working on the model

- **Every model change goes through the tool layer** (`graph_mutate`), never raw `harness.mutate()`:
  the tool layer is where audit provenance and the trajectory feed are written. A raw mutation makes
  `graph_export` refuse its own change as a foreign clobber.
- **A temp-store harness must not point at the repo's `.graphcode`.** Source and target of the
  trajectory projection share one anchor; separating them silently overwrites the repo's feed.
- **After model changes:** re-export the SSOT (`scripts/export-graph.mjs`) and the views.
- **A running MCP host boots the code and rule catalog it started with.** After an upgrade or a
  restructure, restart it — a reseed fixes the data, not the rules it judges by.

## Test discipline

- After **every** `.ts` change: `npm run build` / `type-check`. No unchecked TypeScript commits.
- **While working, run the selected set, not the whole suite.** `graph_tests({changeSet})` walks
  `code node →satisfy/allocate→ REQ →verify→ TEST`, resolves each TEST via its `testRefs`, and emits
  the minimal `vitest run` command. The full suite is the **gate before closing a CR**, not the
  inner loop — that is where the graph pays for itself, and it went unused through the 2026-08-27
  restructure (every agent ran the full suite, repeatedly).
- **Read the `unresolved` list.** A concept-only TEST has no run artifact; a selected run that
  skips it is not coverage, and `graph_tests` reports it rather than dropping it silently.
- **Real tests, no mocks.** Persistence on disk, never `:memory:`.
- Unit (gate / rule-eval) · integration (MCP + local Kuzu) · conformance (Format-E round-trip).
- Root-cause over symptom-fix: reproduce the bug in a unit test first, then fix the root cause.
- A permanently red test file is not a parking spot — it is a blind spot. Two dead `exports`
  subpaths hid behind one for weeks.
