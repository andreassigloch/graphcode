# graphcode KPIs — post-project success standard (CR-GC-212)

The standard analysis run after every project that uses graphcode, to measure whether the
governed graph was actually used (not grep-bypassed) and whether the gate raised quality.
Computed by `scripts/retro-kpi.mjs` (logic unit-tested in `tests/retro-kpi.test.ts`); run via
the `se-retro` skill. Sources are read over MCP (audit + readiness tools) + git + the session
transcript — never a second DB handle.

| KPI | Definition | Source | Target |
|---|---|---|---|
| **Graph-vs-Grep ratio** | `graph_*` calls ÷ (Grep + Glob + doc-read) | session transcript | **> 1** |
| **Tool usage** | counts of `graph_mutate` / `graph_impact` / `graph_expand` / `rules_evaluate` | `audit_trail`, transcript | — (profile) |
| **Tokens per net-LOC** | tokens ÷ net LOC (insertions − deletions) | transcript + `git diff` | ↓ |
| **Plan conformance** | # CRs violating their `depends-on` order | graph + CR data (`deriveImplPlan`, CR-GC-209) | **0** |
| **Gate health** | applied ÷ rejected, plus readiness Δ start→end | `audit_stats`, `graph_readiness` | — / ↑ |
| **Binding coverage (nodes)** | R-19 / R-20 (`testRefs` / `realRef`) coverage at close | `rules_evaluate` | **100 %** |
| **Binding coverage (reality)** | modelled test files ÷ test files on disk, modelled source files ÷ source files on disk | `scripts/test-selection-audit.mjs` | **100 %** |

**Why these.** The first real application (graphify) left indicators of a graph bypass — a 231 KB
`kuzu.wal` never exported, no committed `graph.json`, CR order living as prose in `CLAUDE.md` — but
it was unmeasurable because no KPI existed. Graph-vs-Grep ratio < 1 is the headline bypass signal;
plan conformance > 0 means the CR numbering disagreed with the real dependency order; binding
coverage < 100 % means TESTs/FUNCs were closed without their runnable binding.

**Why binding coverage is measured twice** (SPIKE-GC-selective-tests, 2026-08-21). R-19/R-20 are
per-element rules: they check the nodes that exist and cannot see what was never modelled. Measured
on this repo they read 0 findings — KPI **100 %** — while only 48 of 106 test files and 19 of 63
source files carry a node at all. The node-side number says *the model is internally complete*, the
reality-side number says *the model covers the repo*; a selective test run needs the second one.

**Notes / follow-ups.** Tokens per net-LOC needs the session transcript; if not machine-accessible it
is filled manually (auto-capture is a follow-up). Cross-project trend (KPIs across repos) is a separate CR.
