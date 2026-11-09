---
name: se-retro
version: 5
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
- **Entry** (CR-GC-897) — turns, context and tokens until the first change (a file edit or a model write), and the average context per turn. Target: under 10 turns and under 100 k context at the first change.
- **Single calls** (CR-GC-898) — share of turns with exactly one tool call and their context, and the runs of 3+ equal single calls (same tool; for a shell call the same first command). Every turn re-reads the whole context, so a run costs its turns times the context.
- **Model asked** (CR-GC-899) — questions to the model (test selection, context slice, blast radius, expansion) against model writes, and the share of test runs preceded by a test selection from the graph since the previous run. A selected run through the code lane counts as preceded.

## 3. Interpret (the standard read)
- **Graph-vs-Grep ratio** has no threshold (Leitlinie T-E1). Every search the graph could have answered is potential: list them and ask why the graph wasn't queried (missing export? no onboarding contract?). The graph's gain is precision, not speed.
- **Plan conformance > 0** → CR numbering disagreed with the real `depends-on` order — forward dependencies were built out of order.
- **Binding coverage < 100 %** → TESTs/FUNCs were closed without their runnable binding (vacuous-green risk).
- **Entry above target** → the session read the model instead of entering through the CR and the context slice of its carriers (GRAPHCODE.md, *Sessions and turns*). A high context per turn says the session ran too long: split at the milestone.
- **Runs of equal single calls > 0** → independent reads were not put into one turn, or a repeated check ran by hand instead of as one script (GRAPHCODE.md, *Sessions and turns*).
- **Test runs without a selection** → the session chose its tests itself; the graph names the minimal set for the change (GRAPHCODE.md, *Which tests to run*). Few questions against many writes says the model was written, not used.
- **Findings Δ ≥ 0** → the session left no fewer open findings than it found. Read it with the marks: building adds elements and each new element first brings findings of its own, so a rising count during construction is expected — a mark that moved back is not.

Read the audit + readiness over MCP — never open a second store handle.
