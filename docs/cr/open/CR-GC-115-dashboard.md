# CR-GC-115: Dashboard-Viewer-App (Hybrid)

**Status:** Open · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `MOD-dashboard`, `UC-live-graph-view`, `REQ-dashboard-ontology-sync`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
graphcode-owned Dashboard: @sigloch/graph-renderer (Cytoscape) + dashboard-shell, konsumiert die Host-Bridge; Readiness/INCOSE-Panels gegen V3_RULES (CR-GC-107-Scorer). aimprove-Komponenten (~1.7k LoC) repointen.

## Feld-Audit aimprove-Dashboard → graphcode-servierbar (2026-06-19)
Jede aimprove-Dashboard-View gegen den governten Graphen (elements/traces/violations/readiness/impact/audit) klassifiziert. Quelle: `aimpro/src/dashboard/{App,api,components}`.

**A — graphcode-servierbar** (Spec-Knoten unten):
- `OntologyView` + `GraphOverview` → Live-Graph (graph_elements + graph_get_edges + rules_get_violations)
- `StatusSection`-Readiness-Bars + `GateView` → graph_readiness (Compliance + Phase-Gates SRR/PDR/CDR/TRR)
- `ImplGates` + `CrBurndown` → graph_readiness.implGates (SAR/FCA/SVR/FRR) + MS/CR-Knoten
- `ImpactView` → **repoint** auf graph_impact (live Blast-Radius statt gespeicherter E6-Assessments)
- `RulesView` → **repoint**: V3_RULES-Katalog + Live-Violations behalten, rule-discover/profiles (UC-8/CR-074) droppen
- `TestStatusBar` → TEST-Knoten-Status (in aimprove **Waise**, nirgends importiert)

**B — aimprove-Learning, nicht graphcode** (Generator/Optimizer/Learning-Engine):
`LernstandView` (Wissensbestände/SONA), `PredictionView`, `ProcessFlowView` (Session-Mining), `PromptProposal`+`SuggestionFeed`+`ActionsSection` (Vorschläge), `ParetoView` (Optimizer), `EffectivenessView` (Nightly), `SessionsView`+`Timeline` (Eval-Metriken; Audit-Variante via audit_trail wäre denkbar, aber andere Quelle).

**C — falsch/nicht verdrahtet für graphcode:**
- `ProjectStatusBar` + Analyze-Button + Projekt-Switching → Single-Repo-Owner (CR-195e deprecatete Runtime-Switching) ⇒ droppen
- `triggerAnalysis`/`triggerNightly`/`fetchOptimize` → Write-Trigger, unvereinbar mit read-only Viewer
- `TestStatusBar` → definiert, aber in keiner View importiert (Waise)

## Spec-Knoten (Graph, via Gate — gefolded in diesen CR)
FUNC (satisfy→`UC-live-graph-view`, allocate→`MOD-dashboard`): `FUNC-render-graph`, `FUNC-render-readiness`, `FUNC-render-impl-gates`, `FUNC-render-impact`, `FUNC-subscribe-updates` (FLOW-live-event→io). REQ: `REQ-dashboard-readonly` (+`TEST-dashboard-readonly` verify). Begleitend: fehlende Trace `CR-GC-200→MOD-harness` (Live-Drift) wiederhergestellt.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-GC-114, CR-GC-110
