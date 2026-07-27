# CR-GC-228 — Help-Data-Layer: reine Projektion zu HelpEntry[] (help.ts)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-help-rollup`, `FUNC-help-entry`, `FUNC-contextual-help`
(→ `src/viewer/help.ts`), `TEST-help-projection` (→ `tests/help.test.ts`), `CR-GC-228`; unter `MS-6-adoption`.
Pointer, nicht autoritativ.
**Proposal:** [help-system.md §4, §7, §9](../../proposals/help-system.md)

## Problem (Why)

Es gibt keine reine Funktion, die `HELP_CONTENT` + `V3_RULES` + `readiness.ts` + die Panel-View-Models zu
`HelpEntry[]` formt — analog `panels.ts`, das die Read-only-Datenschicht hinter den Panels ist. Ohne sie
muss jede Oberfläche (MCP-Tool, Renderer) die Schichten selbst zusammenbauen → Parallelpfad-Risiko.

## Decision

- `src/viewer/help.ts` als **reine Projektion** (kein DOM, kein HTTP, keine Mutation — wie `panels.ts`):
  - `helpEntry(id)` → ein `HelpEntry` (alle drei Schichten: plain / se / exact-prompt) für Panel/Gate/Rule/Artifact/Token.
  - `helpForRules()` → der volle Rule-Katalog, gruppiert nach besitzendem Gate (aus `readiness.ts`).
  - `contextualHelp(readiness, violations)` → rangierte, erklärte Maßnahmen (das erklärte Geschwister von Recommendations).
- **Roll-up, keine Erkennung:** jeder `HelpEntry` trägt IMMER alle drei Schichten; die Oberfläche wählt die Tiefe.
- **Zwei Blocker-Arten (CR-GC-221):** `contextualHelp` behandelt Rule-Violations (keyed `ruleId`) UND
  Creation-not-done-Blocker aus `ReadinessGate.blocking[]` (keyed Artifact-Id, kein `ruleId`).

## Akzeptanz

- `tests/help.test.ts` (Disk, kein `:memory:`): `helpEntry` liefert für je ein Panel/Gate/Rule/Artifact
  alle drei Schichten; `contextualHelp` rangiert Rule- UND Creation-Blocker; `helpForRules` deckt die live
  `V3_RULES` ab (eine neue Rule darf den Test nicht durch fixe Zahl brechen).
- `npm test` + `build` grün.

## Dependencies

**CR-GC-227** (HELP_CONTENT), **CR-GC-221** (`creationArtifacts` / `blocking[]`), **CR-GC-222**
(`ArtifactStatus.kind`), **CR-GC-220** (View-Enum). → strikt **nach Kette 1**.
