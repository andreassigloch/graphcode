# CR-GC-128: repo-derived member name + README setup instructions

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (Phase 1) · **Datum:** 2026-06-18 · **Closed:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** Refinement von CR-GC-127 (`graph_export`) — verbessert die New-Repo-Experience (`REQ-doc-export` / `REQ-repo-install`); neuer `TEST-member-name`. Siehe `docs/graph/graphcode.graph.json`.

## Problem / Scope
Beim Live-MVP-1-Durchlauf landete der Re-Export in einem Fremd-Repo als `graphcode.graph.json`, weil `serveStdio` die Harness-Scope hart auf `graphcode` setzte. Außerdem beschrieb die README noch den Carve-Out-PLAN (TBD-Struktur, „copy aimprove code") statt das ausgelieferte MVP-1.

## Lösung
- `src/mcp-server.ts`: `deriveMemberName(repoRoot)` — unscoped `package.json` name (z. B. `@acme/auth-service` → `auth-service`), Fallback Repo-Verzeichnisname, dann `graphcode`. `serveStdio` nutzt das als Scope-Default → `graph_export` schreibt `docs/graph/<member>.graph.json`. Live verifiziert: `@acme/notify-core` → `notify-core.graph.json`.
- `README.md`: neu geschrieben auf den ausgelieferten Stand + **„Quick start — set up GraphCode in a new repo"** (init/update/remove, commit/gitignore-Tabelle, Agent-Loop, MCP-Tool-Tabelle, Constraints). Governance-SSOT-Abschnitt erhalten.
- `tests/mcp.member-name.test.ts`: 6 Fälle (scoped/plain name, Sanitizing, fehlende/invalide package.json, blank → Dir-Name).

## Akzeptanz
`npm run build` + `npm test` grün. `TEST-member-name` → done.

## Dependencies
CR-GC-127 (graph_export)
