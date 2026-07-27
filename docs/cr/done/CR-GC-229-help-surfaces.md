# CR-GC-229 — Help-Surfaces: graph_help MCP-Tool + se:help Skill

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 4
**Graph (SSOT):** seedet (gate-only) `REQ-help-reachable`, `FUNC-graph-help-tool` (→ `src/mcp-tools.ts`),
`FUNC-se-help-skill` (→ `.claude/skills/se-help.md`), `TEST-help-tool` (→ `tests/mcp.help.test.ts`),
`CR-GC-229`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [help-system.md §5, §7, §9](../../proposals/help-system.md)

## Problem (Why)

`help.ts` ist eine reine Datenschicht — ohne Surface nicht erreichbar. Beide Zielgruppen sollen Help
**heute** in Claude Code (= ein Client) bekommen, bevor der externe Renderer (graph-view-edit) existiert.

## Decision

- **`graph_help` MCP-Tool** in `src/mcp-tools.ts` (read-only, wie die übrigen Query-Tools):
  - ohne Argument → `contextualHelp(readiness, violations)` (der erklärte Recommendations-Zwilling).
  - `{ token }` → `helpEntry(token)` (Lookup: `R-04`, `CDR`, `recommendations`, `impact`, …).
- **`se:help` Skill** (`.claude/skills/se-help.md`): ohne Arg = kontextuell, `<token>` = Lookup.
  Trägt `version:`-Frontmatter und ist in der **Skills-Conformance-Liste** registriert (CR-GC-208),
  sonst brechen `graphcode skills sync` + die Skill-Count-Tests.
- Renderer-seitige Info-Box / Rules-Tab bleiben **out of scope** (graph-view-edit).

## Akzeptanz

- `tests/mcp.help.test.ts` (MCP + lokaler Kuzu, Disk): `graph_help` ohne Arg liefert kontextuelle
  Maßnahmen; mit `token` den `HelpEntry`; unbekannter Token → sauberer Fehler, kein Crash.
- `se:help` erscheint in der Conformance-Liste; Skill-Count-Test bleibt grün (aus Registry abgeleitet).
- `npm test` + `build` + Smoke (Server startet, Tool registriert) grün.

## Dependencies

**CR-GC-228** (`help.ts`), **CR-GC-208** (Skill-Conformance + `version:`-Frontmatter).
