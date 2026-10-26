# CR-GC-860: se:import-doc meldet Gate-Verstoesse leer: liest v.elementId, graph_mutate liefert im Format summary elements[] und {el}

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1084 (bug)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1084.json (Lane: code)

---

## Befund (2026-10-26)

`se:import-doc` Stufe 2 meldet die Gate-Befunde leer: im Bericht stehen `elementId: ""` und unersetzte
`{el}`-Platzhalter.

**Root Cause:** Der Transport im Skill ruft `graph_mutate` ohne `violations` und liest `v.elementId`.
Ohne Angabe liefert das Werkzeug seit CR-GC-570 das Format `summary`: ein Eintrag je Regel und
Meldungsmuster, die Elemente in `elements`, die uid in `message` und `fixHint` als `{el}`
(`groupViolationsByRule`, `src/kernel/evaluation.ts`). Ein Feld `elementId` hat dieses Format nicht.

**Der Vertrag am Producer:** Je Befund ein Element liefert `violations: "full"`. Das ist die Form von
`MutateResultSchema.violations` in `@sigloch/contracts/harness` (`ruleId`, `severity`, `message`,
`elementId?`, `fixHint?`). Die Werkzeugbeschreibung von `graph_mutate` sagt das: „summary (Default): EIN
Eintrag je (Regel, Meldungsmuster) mit `elements: [uid, ...]`; … full: ein Eintrag je Element". Der
Producer hält seinen Vertrag; der Consumer las das falsche Format.

**Weitere Leser (grep nach `elementId` an `graph_mutate`-Ergebnissen):**

| Datei | liest | Befund |
|---|---|---|
| `.claude/commands/se/import-doc.md` | `v.elementId` | derselbe Fehler |
| `scripts/migrate-req-kinds.mjs` | `x.elementId` der Fehler-Befunde | derselbe Fehler |
| `se-status`, `se-review`, `se:close-violations`, `se:help` | `elementId` aus `rules_get_violations` / `graph_readiness` / `rules_evaluate` | kein graph_mutate-Ergebnis, nicht betroffen |
| `se:optimize` | `elementId` aus `graph_suggest` | kein graph_mutate-Ergebnis, nicht betroffen |
| `scripts/commit-pruefung.mjs` | `v.elementId` aus der Regelauswertung | nicht betroffen |

## Fix

Beide Leser fordern `violations: "full"` an. Kein Zurückrechnen der Faltung im Consumer: das wäre ein
zweiter Pfad neben der Projektion im Producer.

## Umfang (Dateien)

1. `.claude/commands/se/import-doc.md` — Stufe 2 ruft `graph_mutate` mit `violations: 'full'`
2. `scripts/migrate-req-kinds.mjs` — derselbe Aufruf
3. `tests/mutate-violations-leser.test.ts` (neu) — am echten Werkzeug: der Aufruf, wie der Skill ihn
   schreibt, liefert je Befund ein `elementId` ohne `{el}`; der Default liefert keins (Prämisse). Dazu:
   jeder Leser in `.claude/commands` und `scripts`, der `elementId` aus `graph_mutate` liest, fordert
   `full` an. Rot vor dem Fix: `elementId` undefiniert, zwei Leser ohne `full`.
4. dieser CR

Modell per `graph_mutate`: `REQ-mutate-befund-je-element` an `FUNC-import-doc`, verifiziert von
`TEST-mutate-violations-leser`.

## Bewusst offen

- Die Kopien von `import-doc.md` in den Member-Repos (bok, energymanager, graph-view-edit, MessageRouter,
  agentdiary-*, graphify-harness) tragen den alten Aufruf. Sie ziehen den Fix mit dem nächsten
  `graphcode upgrade`; dieser CR ändert keine fremden Repos.
- graphify: `GateViolation.elementId` ist dort Pflicht, in `MutateResultSchema` optional. Der Skill
  behält deshalb `v.elementId ?? ''` für einen Befund ohne Element. Der Kommentar an
  `MutateTransportResult` („The shape the graphcode graph_mutate MCP tool returns") stimmt nur für
  `full`. Das ist ein Befund für graphify (ITEM-2026-1085), kein Teil dieses CR.
- `GroupedViolation` (Format `summary`) ist ein TS-Interface, kein Zod-Vertrag.

## Akzeptanzkriterien

- Der Bericht von Stufe 2 nennt je Gate-Befund das Element; keine Meldung trägt `{el}`.
- Kein Leser im Repo liest `elementId` aus einem `graph_mutate`-Ergebnis im Format `summary`.

## Nachweis (2026-10-26)

- Rot zuerst: `tests/mutate-violations-leser.test.ts` 2 von 3 rot — `elementId` undefiniert am Aufruf des
  Skills, zwei Leser ohne `full` (`import-doc.md`, `migrate-req-kinds.mjs`). Danach grün, dazu
  `tests/skill-import-doc-modell.test.ts` und `tests/migrate-req-kinds.test.ts`.
- `verify:code`: Spur CODE, 54 Dateien grün. `verify:full CR-GC-860`: 198/198 Dateien, 1647 Tests, Schlupf 0.
- Modell (graphVersion 924): `REQ-mutate-befund-je-element` an `FUNC-import-doc`, `TEST-mutate-violations-leser`.
