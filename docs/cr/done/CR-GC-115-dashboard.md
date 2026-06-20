# CR-GC-115: Dashboard-Viewer-App (Hybrid)

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** Scope = **headless Daten-Schicht** (Andreas bestätigt 2026-06-20): der Cytoscape-Renderer bleibt extern (graph-view-edit, Family-Carve-Out „graphcode ist NICHT Viewer"). graphcode liefert `src/panels.ts` — reine, read-only Shaper über die MCP-Tools: `readinessPanel`/`implGates` mit Blocking-Drilldown (`REQ-readiness-transparent`), `recommendationsPanel` severity-sortiert mit `fixHint` + Top-Kandidat (nutzt CR-GC-203 item 1+3), `artifactsPanel`/`artifactFreshness` Ampel grün=live/gelb=stale/rot=absent (`REQ-artifact-freshness`), `impactPanel`/`healthPanel`, und `panelsForEvent` (`FUNC-subscribe-updates` → CR-GC-114 SSE). `REQ-dashboard-readonly` strukturell (pure functions). Die 8 `FUNC-render-*` = headless Shaper + Mount-Slot (`FUNC-render-graph`), Pixel-Rendering extern. Neuer `tests/panels.test.ts` (5 Cases). 16 Knoten → done (8 FUNC, MOD-dashboard, UC-live-graph-view, 3 REQ, 3 TEST mit testRef). **FRR = 1.0 (passed) — alle 12 MS-4-CRs done.** (R-04-Warnung MOD-dashboard 13 FUNC = Renderer-Slot/Panels-Split, bewusst auf graph-view-edit vertagt; Warnung, kein Blocker.) 142/142 Tests grün.
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `MOD-dashboard`, `UC-live-graph-view`, `REQ-dashboard-ontology-sync`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
graphcode-owned Dashboard: @sigloch/graph-renderer (Cytoscape) + dashboard-shell, konsumiert die Host-Bridge; Readiness/INCOSE-Panels gegen V3_RULES (CR-GC-107-Scorer). aimprove-Komponenten (~1.7k LoC) repointen.

## Feld-Audit aimprove-Dashboard → graphcode-servierbar (2026-06-19)
Jede aimprove-Dashboard-View gegen den governten Graphen (elements/traces/violations/readiness/impact/audit) klassifiziert. Quelle: `aimpro/src/dashboard/{App,api,components}`.

**A — graphcode-servierbar** (Spec-Knoten unten):
- `OntologyView` + `GraphOverview` → Live-Graph (graph_elements + graph_get_edges + rules_get_violations). **Befund beim Öffnen:** aimproves OntologyView rendert KEINEN Node-Link-Graph (nur Typ-/Trace-Histogramme + Deficit-Report) — der Cytoscape-Live-Graph via @sigloch/graph-renderer ist NEU. **Entscheidung Andreas:** `FUNC-render-graph` ist nur der pluggbare Mount-Slot; der Renderer selbst ist das **nächste aise-family-Projekt (graph-view-edit)**, nicht in graphcode gebaut.
- `ActionsSection` (TOP-Empfehlungen) → **behalten** (Entscheidung Andreas): die höchstbewerteten Verbesserungsmassnahmen, graph-deduziert aus Defiziten (R-01 fehlende verify, RD-01 Orphans, graph_impact), nach Severity/Impact sortiert — kein Generator. → `FUNC-render-recommendations`.
- Health-Line → **behalten + echter Funktionscheck** (Entscheidung Andreas): LLM/BYOK-Readiness (für später) + Ontology/Rules/Contracts-Versionen + Store/Gate-Funktion; aimprove-spezifisches (Sessions/Patterns) raus. „Nicht nur Licht im Serverraum an." → `FUNC-render-health` + `REQ-real-health-check`.
- `StatusSection`-Readiness-Bars + `GateView` → graph_readiness (Compliance + Phase-Gates SRR/PDR/CDR/TRR). **Befund:** angezeigte 82% sind BQ-gemessen (301 Violations, 61 error) — exakt das Fremd-Mess-Problem von REQ-dashboard-ontology-sync/CR-107.
- `ImplGates` + `CrBurndown` → graph_readiness.implGates (SAR/FCA/SVR/FRR) + MS/CR-Knoten. **Entscheidung Andreas:** in aimprove nie verdrahtet → Query **transparent** machen (jedes Gate zeigt seine Blocking-Elemente als Drill-down). → `REQ-readiness-transparent`.
- `ArtifactReadiness` (INCOSE-Artifacts-Panel, 10 Dokumente) → Query-Layer (graph_query views) + graph_readiness. **Beim Öffnen sichtbar**, vorher unterspezifiziert → `FUNC-render-artifacts`. Brücke zu CR-GC-116 (die Views/Skills hinter den Artifacts). **Ampel-Semantik (Andreas):** grün = live aus aktuellem Graph abgeleitet, gelb = materialisiertes Doc existiert aber Graph hat sich geändert (stale), rot = noch nicht existent → `REQ-artifact-freshness`.
- `ImpactView` → **repoint** auf graph_impact (live Blast-Radius statt gespeicherter E6-Assessments). **Befund:** rendert bereits ein Teilgraph-SVG (trace-graph-svg) — die Render-Mechanik ist da, nur an Sessions statt graph_impact gebunden.
- `RulesView` → **repoint**: V3_RULES-Katalog + Live-Violations behalten, rule-discover/profiles (UC-8/CR-074) + Trend droppen. **Befund:** Profil-Filter „SE (R-*)" isoliert bereits exakt die Familie-Regeln.
- `TestStatusBar` → TEST-Knoten-Status (in aimprove **Waise**, nirgends importiert)

**B — aimprove-Learning, nicht graphcode** (Generator/Optimizer/Learning-Engine):
`LernstandView` (Wissensbestände/SONA), `PredictionView`, `ProcessFlowView` (Session-Mining), `PromptProposal`+`SuggestionFeed` (Vorschlags-Prompts), `ParetoView` (Optimizer), `EffectivenessView` (Nightly), `SessionsView`+`Timeline` (Eval-Metriken; Audit-Variante via audit_trail wäre denkbar, aber andere Quelle). *(`ActionsSection`/TOP-Empfehlungen nach A verschoben — siehe Entscheidung Andreas.)*

**C — falsch/nicht verdrahtet für graphcode:**
- `ProjectStatusBar` + Analyze-Button + Projekt-Switching → Single-Repo-Owner (CR-195e deprecatete Runtime-Switching) ⇒ droppen
- `triggerAnalysis`/`triggerNightly`/`fetchOptimize` → Write-Trigger, unvereinbar mit read-only Viewer
- `TestStatusBar` → definiert, aber in keiner View importiert (Waise)

## Spec-Knoten (Graph, via Gate — gefolded in diesen CR)
FUNC (satisfy→`UC-live-graph-view`, allocate→`MOD-dashboard`): `FUNC-render-graph` (Mount-Slot), `FUNC-render-readiness`, `FUNC-render-impl-gates`, `FUNC-render-artifacts`, `FUNC-render-impact`, `FUNC-render-recommendations`, `FUNC-render-health`, `FUNC-subscribe-updates` (FLOW-live-event→io).
REQ (UC→compose, TEST→verify): `REQ-dashboard-readonly`, `REQ-real-health-check` (allocate→`MOD-host-bridge`), `REQ-readiness-transparent`, `REQ-artifact-freshness`.
Begleitend: fehlende Trace `CR-GC-200→MOD-harness` (Live-Drift) wiederhergestellt.
**Hinweis (R-04):** MOD-dashboard hat jetzt 13 FUNC → „split recommended". Renderer ist ohnehin extern (graph-view-edit); spätere Trennung Renderer-Slot vs Panels denkbar.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-GC-114, CR-GC-110
