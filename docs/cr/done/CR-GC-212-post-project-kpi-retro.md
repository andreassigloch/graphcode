# CR-GC-212: Post-Project-KPI-Retro (`se-retro` + KPI-Standard)

**Status:** Open (2026-06-25) · **Milestone:** `MS-6-adoption` (neu) · **Max Files:** 4
**Graph (SSOT):** seedet (gate-only) `REQ-project-kpi`, `FUNC-retro-kpi` (→ `.claude/skills/se-retro.md` + `scripts/retro-kpi.mjs`), `TEST-retro-kpi` (→ `tests/retro-kpi.test.ts`), `CR-GC-212`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung (graphify). Befund: *„lass uns KPI definieren, wie wir den Erfolg von graphcode messen können, als Standard-Analyse nach jedem Projekt."* — plus die offene Review-Frage *„hat Claude die Graph-Info genutzt oder nur grep?"*.

- Es gibt **keinen** Messstandard. graphify-Indizien (kuzu.wal 231 KB nie exportiert, kein committed `graph.json`, CR-Reihenfolge als Prosa) deuten auf **graph-Bypass** hin — aber unmessbar, weil keine KPI definiert ist.

## Decision

**KPI-Set** (`docs/KPI.md`) + Skill `.claude/skills/se-retro.md` + Auswerter `scripts/retro-kpi.mjs`:

| KPI | Definition | Quelle | Ziel |
|---|---|---|---|
| Graph-vs-Grep-Ratio | `graph_*`-Calls ÷ (Grep+Glob+Doc-Read) | Session-Transcript | > 1 |
| Tool-Nutzung | Counts `graph_mutate / impact / expand / rules_evaluate` | `audit_trail`, Transcript | — |
| Token/LOC | Tokens ÷ Netto-LOC | Transcript + git diff | ↓ |
| Plan-Konformanz | # CRs gegen `depends-on`-Reihenfolge verletzt | Graph + CR-Daten | 0 |
| Gate-Health | applied ÷ rejected, Readiness-Δ Start→Ende | `audit_stats`, `graph_readiness` | — |
| Bindungs-Coverage | R-19/R-20 (testRef/codeRef) bei Close | `rules_evaluate` | 100 % |

`scripts/retro-kpi.mjs`: liest `audit_stats`/`audit_trail`/`graph_readiness` (über die Harness-API, kein 2. DB-Handle) + git, gibt die KPI-Tabelle aus. `se-retro.md`: ruft den Auswerter + interpretiert. `tests/retro-kpi.test.ts`: gegen einen Fixture-Audit-Trail → erwartete KPI-Werte (real, nicht gemockt).

## Akzeptanz

- `docs/KPI.md` definiert die 6 KPIs (Definition + Quelle + Zielwert).
- `scripts/retro-kpi.mjs` produziert die KPI-Tabelle aus `audit_*`/`readiness` + git auf einem realen Repo (Disk-Persistenz, kein `:memory:`).
- `se-retro` ruft den Auswerter und liefert die Standard-Analyse.
- Test: Fixture-Trail → deterministische KPI-Werte; ein bewusst graph-loser Trail ergibt Graph-vs-Grep-Ratio < 1.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Token/LOC braucht das Session-Transcript — falls nicht maschinen-zugänglich, manuell befüllt; Auto-Capture ist Follow-up.
- Cross-Projekt-Trend (KPI über mehrere Repos) — separater CR.

## Dependencies

`audit_stats`/`audit_trail`/`graph_readiness` (vorhanden). Unabhängig von 207–211; profitiert von CR-GC-209 (Plan-Konformanz messbar).
