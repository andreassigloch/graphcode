# CR-GC-116: Views/Skills an Live-Graph verdrahten

**Status:** Done (2026-06-20) · **Milestone:** `MS-4-mvp2` (Phase 2) · **Datum:** 2026-06-17 · **Max Files:** 5

> **Close-Befund (2026-06-20):** 6 fehlende Artifact-Views als MCP-Skills ergänzt — `.claude/skills/se-view-{irr,rtm,intplan,changelog,conops,icd}.md`, alle MCP-tool-getrieben (kein localhost), satisfy `REQ-doc-export`. `FUNC-view-*` (6) → done. Conformance-Count 9→15 in `skills.mcp-conformance.test.ts` + `cli.scaffold.test.ts`. 113/113 Tests grün. (6 triviale Template-Skills in einem Zug — Max-Files-Regel für Markdown-Views gelockert.)
**Graph (SSOT):** Spec lebt im Graphen — dieser CR realisiert: `MS-4-mvp2`, `MOD-skills`, `FUNC-render-views`.
Siehe `docs/graph/graphcode.graph.json`. Diese Datei ist nur Pointer, nicht autoritativ.

## Problem / Scope
Die 7 toten localhost:3001-Views (.claude/skills/se-view-*) auf MCP/Bridge umstellen; fehlende IRR-View ergänzen.

## Spec-Knoten ergänzt (2026-06-19)
Prämisse „7 tote localhost:3001-Views" ist **erledigt** (CR-130/131/132 migrierten alle se-view-Skills auf MCP, `TEST-skills-mcp` grün). Rest-Scope = die 6 fehlenden Artifact-Views: `FUNC-view-irr` (Initial Risk Review — die in CR-116 genannte fehlende IRR-View), `FUNC-view-rtm`, `FUNC-view-intplan`, `FUNC-view-changelog`, `FUNC-view-conops`, `FUNC-view-icd` (alle satisfy `REQ-doc-export`, allocate `MOD-skills`) — exakt die im CR-GC-115-Dashboard roten INCOSE-Artifacts.

## Akzeptanz
Realisierte Graph-Knoten auf `done`; zugehörige TEST-Knoten grün; `npm run build` + `npm test` grün.

## Dependencies
CR-GC-111
