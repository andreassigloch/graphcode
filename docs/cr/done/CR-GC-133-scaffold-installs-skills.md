# CR-GC-133: scaffold installs the SE skills into the target repo

**Status:** Done · **Milestone:** `MS-3-mvp-readiness` (skills completion) · **Datum:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** refines `FUNC-harness-cli` (`MOD-cli`) to manage `.claude/skills/` per `MOD-skills` / CR-GC-104; adds `TEST-scaffold-skills`. Pointer — derive acceptance from the graph.

## Problem (Why)
`graphcode init` scaffolds `.mcp.json` + `.graphcode/` + `GRAPHCODE.md` + the dependency, but **not** the SE skills (`.claude/skills/se-*.md`). A freshly-initialised member repo gets the governed substrate with **zero** SE skills — the `se-view-*` / `se-fmea` / `se-review` / `se-status` workflows (now MCP-driven, CR-GC-130/131/132) are unreachable. This contradicts the model: `MOD-skills` / CR-GC-104 state `FUNC-harness-cli` manages `.claude/skills/` — a model↔code drift.

## Scope (≤5 files)
- `src/scaffold.ts`: `init`/`update` copy the package's shipped `.claude/skills/se-*.md` into the target repo (idempotent — byte-identical re-runs = `preserved`); `remove` deletes them restlos (only graphcode-shipped files; prune `.claude/skills` / `.claude` only when emptied). Skills resolved relative to the module → works in dev (`src/`) and bundled (`dist/`).
- `package.json`: add `.claude/skills` to `files` so the skills ship in the npm tarball.
- `tests/cli.scaffold.test.ts`: `init` installs the 9 skills, idempotent on re-run, `remove` deletes them.
- `tests/distribution.test.ts`: assert a skill (`se-fmea.md`) lands in the foreign repo via the packed-tarball `init` (self-contained, end-to-end).
- `docs/graph/graphcode.graph.json`: add `TEST-scaffold-skills` (`verify` → `REQ-repo-install`).

## Acceptance
`graphcode init` writes all 9 `se-*.md`; `remove` deletes them restlos; `npm run build` + `npm run bundle` + `npm test` green (incl. the real foreign-install distribution test); realized graph node → done.

## Dependencies
CR-GC-112 (scaffold lifecycle), CR-GC-121 (self-contained dist), CR-GC-130/131/132 (the skills to ship)
