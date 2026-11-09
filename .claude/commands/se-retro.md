---
name: se-retro
version: 3
description: Post-project retro — compute the 6 graphcode KPIs (graph-vs-grep, tool usage, token/LOC, plan conformance, gate health, binding coverage) and interpret them
---

The standard analysis run after a project: did the agent actually use the governed graph (not grep-bypass), and did the gate raise quality? Produces the KPI table (`docs/messung/kennzahlen.md`) and interprets it.

## 1. Gather the session data (over MCP + git + transcript)
Assemble a `retro-session.json`:
- **toolUsage** — from the session transcript: `graphCalls` (every `graph_*` MCP call), `grepGlobDocReads` (Grep + Glob + raw doc reads), and the counts `mutate` / `impact` / `expand` / `rulesEvaluate`.
- **audit** — call `audit_stats` and read `totals`: `{ applied, rejected }` (CR-GC-347 moved the counts under `totals`; `byRule` / `byModel` / `byConsumer` sit beside them and answer which rule blocked whom).
- **findings** — `graph_readiness` at session start and end: `{ start, end }`, each the sum of `stages[].findings` (the count of open findings; there is no percentage).
- **git** — `{ netLoc }` (insertions − deletions; the script auto-fills it from `git diff` if omitted) and `{ tokens }` if the transcript gives a token count.
- **plan** — `{ dependsOnViolations }`: # CRs whose order violates a `depends-on` edge (derive with `se-plan` / `deriveImplPlan`, CR-GC-209).
- **binding** — `{ coveragePct }`: share of closed TESTs/FUNCs carrying `testRef`/`codeRef` (R-19/R-20) from `rules_evaluate`.

## 2. Run the evaluator
`node scripts/retro-kpi.mjs retro-session.json` → prints the KPI table.

`node scripts/retro-kpi.mjs --protokoll <session.jsonl> [...]` → the per-session table, counted from the transcript itself (one turn = one model answer, its context = input + cache read + cache write):
- **Entry** (CR-GC-897) — turns, context and tokens until the first change (Edit/Write or `graph_mutate`), and the average context per turn. Target: under 10 turns and under 100 k context at the first change.

## 3. Interpret (the standard read)
- **Graph-vs-Grep ratio** has no threshold (Leitlinie T-E1). Every search the graph could have answered is potential: list them and ask why the graph wasn't queried (missing export? no onboarding contract?). The graph's gain is precision, not speed.
- **Plan conformance > 0** → CR numbering disagreed with the real `depends-on` order — forward dependencies were built out of order.
- **Binding coverage < 100 %** → TESTs/FUNCs were closed without their runnable binding (vacuous-green risk).
- **Entry above target** → the session read the model instead of entering through the CR and the `graph_context` of its carriers (GRAPHCODE.md, *Starting a session*). A high context per turn says the session ran too long: split at the milestone.
- **Findings Δ ≥ 0** → the session left no fewer open findings than it found. Read it with the marks: building adds elements and each new element first brings findings of its own, so a rising count during construction is expected — a mark that moved back is not.

Read the audit + readiness over MCP — never open a second store handle.
