# CR-GC-853: Constraints Teil 3: Rueckbau Zielprofil

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1060 (idea)
**Erstellt:** 2026-10-25
**Item:** bok/items/ITEM-2026-1060.json (Lane: code)

---

Teil 3 von CR-GC-804 (Schnitt 2026-10-25), Entscheidung 4: der Rückbau des Zielprofils ist ein eigener CR
und beginnt, wenn CR-GC-851 und CR-GC-852 geschlossen sind. Der Konzepttext steht in `docs/cr/done/CR-GC-804-…`.

## Ziel

Das Zielprofil entfällt ersatzlos: `.graphcode/target-profile.json`, `TargetWeightsSchema`
(`src/loop/target-profile-contract.ts`), `src/loop/target-profile.ts`, der Skill `se:target-profile`
(`.claude/commands/se/target-profile.md`). `graph_suggest` ordnet nach roten Constraint-Tests und dem
schwächsten Ort (CR-SM-292), nicht nach einem Gewichtsvektor.

## Umfang laut Suche (vor dem Bau mit `graph_impact` auf FUNC-target-profile, FUNC-target-profile-load,
SCHEMA-target-profile prüfen)

Verweise auf Skill oder Profil heute: `src/loop/target-profile*.ts`, `src/loop/generate.ts`,
`src/projections/help.ts`, `src/surface/scaffold-docs.ts`, `.claude/commands/se/top-level.md`,
`.claude/commands/se/optimize.md`, die Tests `tests/target-profile.test.ts`, `tests/generate.test.ts`,
`tests/help-content.test.ts`, `tests/skills.mcp-conformance.test.ts` und weitere Steuerungs-Tests, dazu jedes
Repo mit Profildatei. Das sind mehr als 10 Dateien: vor dem Bau schneiden (`/se-umbau` führt die Reihenfolge).

## Akzeptanzkriterien

- Kein Code, kein Skill und kein Test liest oder schreibt ein Zielprofil; `grep target-profile` trifft nur
  `docs/cr/done/` und `docs/archive/`.
- `graph_suggest` ordnet ohne Gewichte; sein Test zeigt die Ordnung nach roten Constraint-Tests.
- Die Modellknoten des Zielprofils sind per `graph_mutate` gelöscht.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 891, Tiefe 1, Wurzeln: `FUNC-target-profile`, `FUNC-target-profile-load`, `SCHEMA-target-profile`._

Reichweite: 7 Elemente (FLOW 3, FUNC 4); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 3):
- .claude/commands/se/target-profile.md
- src/loop/target-profile-contract.ts
- src/loop/target-profile.ts

Tests (`graph_tests`, 3):
- tests/mcp.suggest.test.ts
- tests/skill-authoring-gate.test.ts
- tests/target-profile.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
