# CR-GC-121: Distribution: npx-Paket, self-contained, agent-agnostic

**Status:** Done · **Closed:** 2026-06-18 · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-17 · **Max Files:** 5
**Graph (SSOT):** realisiert `MOD-cli`, `REQ-npx-distribution`, `REQ-self-contained-dist`, `REQ-repo-install`. Spec lebt im Graphen (`docs/graph/graphcode.graph.json`); diese Datei = Pointer.

## Problem / Scope
graphcode als npm-Paket mit bin `npx @sigloch/graphcode init|update|remove`; versionierte (nicht file:) Deps fürs Publish; in beliebigem Fremd-Repo lauffähig. Voraussetzung fürs „neues Repo anlegen".

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-111, CR-112
