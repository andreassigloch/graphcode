# CR-GC-104: Skills/Prompts als Modul — `MOD-skills`

**Status:** Done · **Datum:** 2026-06-17 · **Abschluss:** 2026-06-18 · **Modul:** `.claude/skills/` (Graph: `MOD-skills`)
**Refs:** ADR-001 §4 AD-6 (app-spezifische Module) · Diskussion „Skills = Funktionen" (2026-06-17)
**Graph:** `CR-GC-104 -relation→ MOD-skills` · **Max Files:** 5

## Problem (Why)
Skills/Prompts (`.claude/skills/se-view-*`, künftig Prompts) sind **reale Dateien/Verzeichnisse**, die wir
managen (scaffold/update/remove via `FUNC-harness-cli`) — also ein **Modul**, genau wie `src/harness.ts`.
Sie als bloßes FUNC-Attribut zu führen wäre inkonsistent: ein MOD *ist* „eine gemanagte Einheit von
Dateien". Zugleich beweist das die These **Skills = Funktionen**: eine prompt-realisierte FUNC bekommt
Modul, Allokation und UC-Bezug wie jede Code-Funktion.

## Entscheidung
**`MOD-skills`** (app-spezifisch → keine Familie-Review, ADR-001 AD-6) modelliert `.claude/skills/` (+ Prompts).
**Allokation nach `MOD-skills` = prompt-realisiert** (vs. code-realisiert in den anderen MODs) — kein separates
`realization`-Attribut nötig, der MOD *ist* das Medium. Erste prompt-realisierte FUNC: `FUNC-render-views`
(Graph→Markdown via `se-view-*`), Interim-Realisierung bis `FUNC-export-markdown` (code, `MOD-docs`) gebaut ist.

## Scope (Graph-Knoten)
Neu: `MOD-skills` (SYS→compose), `FUNC-render-views` (→satisfy `UC-code-quality`/`REQ-doc-export`, →allocate `MOD-skills`),
FLOW `view-request`/`rendered-view`. Lifecycle: `FUNC-harness-cli` scaffolded/aktualisiert/entfernt `.claude/skills/`.

## Akzeptanzkriterien
- `MOD-skills` im Graph, `SYS -compose→ MOD-skills`, ontologie-konform (TRACE_PATTERNS).
- `FUNC-render-views -allocate→ MOD-skills` + `-satisfy→ REQ-doc-export` (prompt-realisiert).
- Regenerate grün: keine dangling/invalid Traces; `node scripts/seed-graph.mjs` HTTP 200.

## Dependencies
Keine (additive Modell-Verfeinerung, innerhalb des Frames / vordefinierter Boxen).

## Abschluss (2026-06-18)
Modellierung war längst im Graph (`MOD-skills`, `FUNC-render-views` + `compose`/`allocate`/`satisfy`-Traces).
Offen blieb nur der Funktionsnachweis „Skills = Funktionen" — erbracht durch CR-GC-130/131/132: alle 9
`se-*`-Skills laufen jetzt über die MCP-Surface (nicht die abgeschaltete `localhost:3001`-API), verifiziert
durch `tests/skills.mcp-conformance.test.ts` (`TEST-skills-mcp`). `MOD-skills` → `done` (CR-GC-132).
Das veraltete Akzeptanzkriterium „`node scripts/seed-graph.mjs` HTTP 200" ist obsolet (Skript gelöscht);
abgelöst durch `tests/graph-integrity.test.ts` (keine dangling/invalid Traces, kanonische Serialisierung).
