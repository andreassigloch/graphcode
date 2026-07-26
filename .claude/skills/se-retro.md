---
name: se-retro
version: 1
description: Post-project retro — compute the 6 graphcode KPIs (graph-vs-grep, tool usage, token/LOC, plan conformance, gate health, binding coverage) and interpret them
---

The standard analysis run after a project: did the agent actually use the governed graph (not grep-bypass), and did the gate raise quality? Produces the KPI table (`docs/KPI.md`) and interprets it.

## 1. Gather the session data (over MCP + git + transcript)
Assemble a `retro-session.json`:
- **toolUsage** — from the session transcript: `graphCalls` (every `graph_*` MCP call), `grepGlobDocReads` (Grep + Glob + raw doc reads), and the counts `mutate` / `impact` / `expand` / `rulesEvaluate`.
- **audit** — call `audit_stats`: `{ applied, rejected }`.
- **readiness** — `graph_readiness` at session start and end: `{ start, end }` (the `compliance.score`).
- **git** — `{ netLoc }` (insertions − deletions; the script auto-fills it from `git diff` if omitted) and `{ tokens }` if the transcript gives a token count.
- **plan** — `{ dependsOnViolations }`: # CRs whose order violates a `depends-on` edge (derive with `se-plan` / `deriveImplPlan`, CR-GC-209).
- **binding** — `{ coveragePct }`: share of closed TESTs/FUNCs carrying `testRef`/`codeRef` (R-19/R-20) from `rules_evaluate`.

## 2. Run the evaluator
`node scripts/retro-kpi.mjs retro-session.json` → prints the KPI table.

## 3. Interpret (the standard read)
- **Graph-vs-Grep ratio < 1** → the agent grep-bypassed the graph. The headline failure; investigate why the graph wasn't queried (missing export? no onboarding contract?).
- **Plan conformance > 0** → CR numbering disagreed with the real `depends-on` order — forward dependencies were built out of order.
- **Binding coverage < 100 %** → TESTs/FUNCs were closed without their runnable binding (vacuous-green risk).
- **Readiness Δ ≤ 0** → the session did not improve the model's compliance.

Read the audit + readiness over MCP — never open a second store handle.
