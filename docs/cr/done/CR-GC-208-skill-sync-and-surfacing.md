# CR-GC-208: Skill-Sync + Surfacing (Anti-Drift für scaffold'ete se-*-Skills)

**Status:** Open (2026-06-25) · **Milestone:** `MS-6-adoption` (neu) · **Max Files:** 5
**Graph (SSOT):** seedet (gate-only) `REQ-skill-sync`, `FUNC-skills-sync` (→ `src/scaffold.ts`), `TEST-skills-sync` (→ `tests/scaffold.test.ts`), `CR-GC-208`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung (graphify). Zwei verkettete Befunde:

1. **Skills wurden nicht ge­surfaced/genutzt.** 17 `se-*`-Skills liegen in `graphify/.claude/skills/` (inkl. `se-view-conops`, `se-view-implplan`, `se-view-intplan`) — frisch (MCP-Version, kein dead-path). Trotzdem baute die Session den Plan **ad-hoc**, statt die Skills aufzurufen. Der Agent „wusste" nicht, dass es sie gibt.
2. **Latente Drift.** `init` **kopiert** die Skills ins Ziel-Repo (`src/scaffold.ts`). Es gibt **keinen Update-Pfad**: ändert sich ein Skill in graphcode (wie bei CR-GC-132, dead-path→MCP), bleibt die Kopie im Consumer-Repo stehen. graphify hatte Glück (frisch ge­scaffold'et nach 132) — ein älteres Repo hätte die toten `localhost:3001`-Skills.

## Decision

- `src/scaffold.ts`: Subcommand `graphcode skills sync` — re-kopiert die ge­shippten `se-*.md` ins Ziel-`.claude/skills/`, meldet pro Datei `added|updated|unchanged` (Diff-Report), **überschreibt nur bei Versions-Mismatch**. Versions-Stamp in der Skill-Frontmatter (`version:`) als Vergleichsschlüssel.
- `GRAPHCODE.md` (aus CR-GC-207): Abschnitt „**Verfügbare se-*-Skills**" — Tabelle Name→Zweck, damit der Agent sie kennt und via Skill-Tool aufruft statt ad-hoc zu planen.
- Conformance: bestehender `tests/skills.mcp-conformance.test.ts`-Mechanismus liefert die Liste der ge­shippten Skills; `skills sync` muss diese Liste 1:1 ins Ziel bringen (kein Skill vergessen).

## Akzeptanz

- `graphcode skills sync` auf einem Repo mit veralteter Kopie → meldet `updated`, schreibt die MCP-Version; auf aktuellem Repo → alles `unchanged`.
- Jedes ge­shippte `se-*.md` trägt `version:` in der Frontmatter; `sync` vergleicht darüber.
- `GRAPHCODE.md` listet die Skills (Name + Zweck).
- Test: nach `init` + Manipulation einer Kopie stellt `sync` sie wieder her; kein dead-path-Ref in den ge­shippten Skills (vorhandene Conformance bleibt grün).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- **Warum** der Harness die Project-`.claude/skills/` nicht in die invocable-Liste der Session aufnahm (Claude-Code-Harness-Verhalten, außerhalb graphcode) — hier nur via `GRAPHCODE.md`-Liste mitigiert, nicht im Harness gelöst.
- Generatives Plan-Skill (Lücke „create implplan") → **CR-GC-209**.

## Dependencies

CR-GC-207 (erstellt `GRAPHCODE.md`, das dieser CR erweitert). `@sigloch/graphcode` scaffold (`SKILLS_DIR`).
