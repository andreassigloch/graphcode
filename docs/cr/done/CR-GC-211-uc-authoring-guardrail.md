# CR-GC-211: UC-Authoring-Guardrail (Terseness + Jargon-Budget)

**Status:** Open (2026-06-25) · **Milestone:** `MS-6-adoption` (neu) · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-uc-authoring-style`, `FUNC-author-uc` (→ `.claude/skills/se-author-uc.md`, `lang:'prompt'`), `TEST-uc-authoring-style` (→ `tests/se-author-uc.test.ts`), `CR-GC-211`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung (graphify). Befund: *„UC-Sprache nicht knapp genug, dafür trotzdem zu viele Fachausdrücke."*

- graphify-UCs (SPEC.md §3.2) sind ~60–90 Wörter, dicht an load-bearing Jargon (`SlicerInput`, `ElementType`, `determinism boundary`, `recall-first`, `V3_RULES`, `TRACE_PATTERNS`) — gleichzeitig zu lang **und** zu fachlich für einen ConOps-Einstieg.
- `se-view:conops` **rendert** UCs, **erzwingt** beim Schreiben aber keine Stil-Disziplin. Es gibt kein Authoring-Skill für UC-Knoten mit Terseness-/Jargon-Regel.

## Decision

Neues Skill `.claude/skills/se-author-uc.md` (`se:author-uc`) — analog zu `se:author-req`, aber für `UC`-Knoten, mit erzwungener Stil-Checkliste:

- **Terse:** UC-`description` ≤ 25 Wörter, Aktiv, *Actor–Verb–Objekt–Outcome* (kein Implementierungs­detail).
- **Jargon-Budget:** ≤ 2 Fachbegriffe pro UC; jeder Begriff muss als `SCHEMA`/`REQ`-Knoten existieren (sonst undefiniert → nicht verwenden). Begriff 1× definieren, nicht wiederholen.
- Gate-mutiert den UC + `compose`-Trace zu FUNC/FCHAIN via `graph_mutate`.

`tests/se-author-uc.test.ts`: prüft die Stil-Regel als ausführbaren Linter über UC-`description` (Wortzahl ≤25; Jargon-Begriffe gegen die `SCHEMA`/`REQ`-Knoten des Graphen abgleichen) — gegen den committeten Graphen, plus ein bewusst zu langer/fachlicher UC, der gefangen wird (nicht vacuous).

## Akzeptanz

- `se-author-uc` erzeugt UCs ≤25 Wörter, ≤2 ungebundene Fachbegriffe.
- Linter-Test fängt einen UC, der die Regel verletzt; der committete Graph ist clean **oder** die Verstöße sind als Warning sichtbar (nicht hart blockend — Stil ist warning, kein Error).
- `se-author-uc` ist von `se-view:conops` abgegrenzt (View rendert, author erzeugt — keine Parallelpfade).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Eine Engine-**Regel** (R-2x) für UC-Stil gehört nach `@sigloch/contracts/se` — **nicht lokal forken** (Drift-Lock). Falls gewünscht: Familie-Review + Version-Bump als separater CR; hier bewusst nur Skill + lokaler Linter-Test.

## Dependencies

`@sigloch/contracts/se` (`UC` ElementType, `compose` TraceType). Unabhängig von 207–210.
