# graphcode — development guardrails

Read `README.md` first for what graphcode is and how to run it. This file is the binding set of
**constraints and invariants** for anyone (human or agent) working in this repo.

## What graphcode is / is not

- **IS:** a governed **graph substrate** (Bridge + Store + MCP surface). Agent-agnostic, headless,
  one Kuzu store per repo. A coding agent (Claude Code, OpenCode, …) is a client.
- **IS NOT:** a generator, a learning engine, a viewer/dashboard, or a code extractor/slicer. Harness-only.

## Locked constraints

- **One store = Kuzu** — embedded, single-writer, exactly one owner process per repo. Never a second
  DB handle. Persistence is on disk, never `:memory:`.
- **One transport = MCP-stdio** for the agent (+ a read-only SSE bridge for a live viewer). No
  Express/REST in the core.
- **One Apply-Gate = `mutate()`** — every edit (human *or* AI) goes through the same gate; the author
  is only logged. No hand-edit of the graph SSOT.
- **SE ontology + `V3_RULES` come from `@sigloch/contracts/se`** — imported, never forked. A new
  ElementType/TraceType/TRACE_PATTERN/rule requires a contracts version bump, not a local rule parser.

## Schema-first

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
- **No binary / NUL corruption in source** — PreToolUse hook `.claude/hooks/deny-binary-source.sh`.
- **Read-before-edit** — harness built-in (Edit requires a prior Read).

## Test discipline

- After **every** `.ts` change: `npm run build` / `type-check`. No unchecked TypeScript commits.
- **Real tests, no mocks.** Persistence on disk, never `:memory:`.
- Unit (gate / rule-eval) · integration (MCP + local Kuzu) · conformance (Format-E round-trip).
- Root-cause over symptom-fix: reproduce the bug in a unit test first, then fix the root cause.

## Efficiency (query precision)

Prefer a precise query over result compression: `graph_impact()` returns the exact blast-radius;
`graph_expand()` deepens one branch on demand. Don't grep for what a typed graph query answers exactly.
