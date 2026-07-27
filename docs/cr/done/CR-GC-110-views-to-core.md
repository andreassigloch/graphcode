# CR-GC-110: views.ts → graph-api-core; BQ-Regel-Fork retiren

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 0) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** Scope **graphcode-intern**. graphcode bezieht Regelbasis + Ontologie ausschließlich aus `@sigloch/graph-api-core` (`SE_DESCRIPTOR`/`DefaultRuleEngine` → `@sigloch/contracts/se`) — **kein lokaler Fork, keine BQ-Regeln** (nur Kommentare erwähnen den retireten BQ-Pfad). Neuer Static-Scan `tests/views.no-fork.test.ts` (`TEST-shared-views-no-fork`, 3 Cases) verriegelt das: kein src-Import eines geforkten rules/view-computation-Moduls, Engine aus der Family. `REQ-shared-views-no-fork`/`TEST-shared-views-no-fork` → done. **Annahme/Flag:** Die Migration der *aimprove-eigenen* `view-rules`/`learning-engine/graph/views` nach graph-api-core + Löschung des aimpro-Forks ist Sibling-Repo-Arbeit (aimpro/sigloch-modules), **nicht** graphcode-MS-4 — hier nur die graphcode-Seite (no-fork) geschlossen. Bei Bedarf separat als cross-repo-CR öffnen.
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `REQ-shared-views-no-fork`, `FUNC-render-views`, `MOD-docs`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
View-Berechnung (testmatrix/FMEA/RTM/IRR/NFR/arch…) aus aimprove/learning-engine/graph nach @sigloch/graph-api-core; lokalen BQ-Fork (aimpro/src/contracts/se) auflösen/migrieren — Familie-Review (Drift-Lock L1/L2).

## Spec-Knoten ergänzt (2026-06-19)
`REQ-shared-views-no-fork` draft→open + `TEST-shared-views-no-fork` (verify, R-01 geschlossen).

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
—
