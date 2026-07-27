# CR-GC-227 — Help-Content-Layer: autorierte Plain/SE-Annotation (HELP_CONTENT)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-help-two-audience`, `FUNC-help-content-map` (→ `src/viewer/help-content.ts`),
`TEST-help-content-coverage` (→ `tests/help-content.test.ts`), `CR-GC-227`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [help-system.md §3–§4, §6, §8](../../proposals/help-system.md) · [help-rules-content.md](../../proposals/help-rules-content.md)

## Problem (Why)

Das Dashboard nennt Tokens (`R-04`, `CDR`, `verify`) ohne Erklärung. Zwei Zielgruppen — SE ohne unsere
Ontologie, User ohne SE-Wissen — können nicht handeln. Die *abgeleiteten* Felder (title/severity/message)
liegen in `V3_RULES`; was fehlt, ist die **autorierte** Plain- und SE-Schicht plus die Vocabulary-Legende.

## Decision

- Eine typisierte **`HELP_CONTENT`-Map LOKAL in graphcode** (`src/viewer/help-content.ts`), keyed auf
  `ruleId` / `gateId` / `panelId` / `artifactId` / `vocab-token`, je Eintrag `{ plain, se }` (+ die
  Vocabulary-Tabelle: element/trace-token → plain-phrase + SE-Konzept; + die Element-States-Notiz).
- **Kein Fork, kein Contracts-Bump.** `HELP_CONTENT` ist *keine* neue Rule/ElementType/TraceType/TRACE_PATTERN,
  sondern eine Annotations-Schicht über existierende `ruleId`s. Damit greift der Drift-Lock NICHT; die
  Promotion in `@sigloch/contracts` (Plain/SE co-located mit `V3_RULES`) ist eine **spätere** Family-Review-
  Entscheidung, NICHT Teil dieses CRs.
- Inhalt = der akzeptierte Stand aus dem Proposal (3 Runden Persona-Audit, beide PASS): alle 20 Regeln,
  5 Panels, 8 Gates, Artefakt-Rows. Namen folgen dem finalen Stand nach Kette 1 (Assumption Review, `srs`/`spec`).

## Akzeptanz

- `tests/help-content.test.ts` prüft gegen die **live `V3_RULES`-Registry**: jede Rule-ID hat genau einen
  `HELP_CONTENT`-Eintrag mit nicht-leerem `plain` + `se` (kein Hand-Count — eine neue Rule bricht den Test
  nur, wenn ihr Eintrag fehlt, nicht durch eine fixe Zahl).
- Jeder Gate-/Panel-/Artifact-Key ist abgedeckt; jeder Vocabulary-Token aus den SE-Zellen resolved in §3.
- `npm test` + `build` grün.

## Dependencies

**Nach CR-GC-226** (Kette 220→226 geschlossen → finale Artefakt-Namen/Row-Set/`kind` stehen). Konsumiert
keine Laufzeit-Felder, nur die finalen Namen — kann unmittelbar nach 226 starten.
