# CR-GC-852: Constraints Teil 2: Skill se-constraints und se-vorbereitung Abschnitt 2 fuer Constraints

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1059 (idea)
**Erstellt:** 2026-10-25
**Item:** bok/items/ITEM-2026-1059.json (Lane: code)

---

Teil 2 von CR-GC-804 (Schnitt 2026-10-25, Regel max. 10 Dateien je CR). Entscheidungen 1, 2, 3 und 6 aus
CR-GC-804 gelten unverändert; der Konzepttext steht dort (`docs/cr/done/CR-GC-804-…`).

## Ziel

Der CREATE-Skill `se-constraints` nach dem Muster von `se-conops`: Prüfliste je Ebene (Knoten, Block,
Kette, Gesamtmodell), liest den Umfang (`graph_metrics`, `graph_elements`), schreibt REQ + TEST durch das
Gate (`se:author-req`), schlägt das Herunterdeklinieren über `se-vorbereitung` §2 vor, hält den Walk als
geschlossenen CR fest und stempelt. `se-vorbereitung` §2 bekommt den zweiten Eingang: jede
nicht-funktionale Anforderung an Modul, Kette oder System, nicht nur Gegenmaßnahmen.

## Voraussetzung

Entscheidung 6: `riskCarriers` in `@sigloch/contracts/se` ist auf alle nicht-funktionalen Anforderungen an
Modul, Kette oder System verallgemeinert (Hüter, Version-Bump, Release) und in graphcode eingezogen.
Vorher fehlt §2 die Trägerliste für einen Constraint ohne Rolle. Item für contracts: ITEM-2026-1057
(sigloch-modules).

## Umfang (Dateien)

1. `.claude/commands/se-constraints.md` (neu)
2. `tests/skill-constraints.test.ts` (neu) — bindet den Skill-Text an die Verträge, aus denen er liest
   (Muster `tests/skill-vorbereitung-felder.test.ts`)
3. `.claude/commands/se-vorbereitung.md` §2
4. `tests/skill-vorbereitung-felder.test.ts`
5. `package.json` + `package-lock.json` (contracts-Version)
6. dieser CR

Modell: FUNC für den Skill (`realRef`), REQ + TEST am Skill, per `graph_mutate`.

## Akzeptanzkriterien

- Der Skill nennt nur Felder, Regeln und Kanten, die es in contracts gibt; der Text-Test ist rot, wenn er
  eines nennt, das es nicht gibt.
- §2 ordnet einen Constraint ohne Rolle in die vier Klassen ein und liest seine Träger aus der
  verallgemeinerten Ableitung.
- `se:target-profile` bleibt bis CR-GC-853 bestehen; er setzt Gewichte, `se-constraints` setzt Constraints.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 890, Tiefe 1, Wurzeln: `FUNC-se-vorbereitung`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-vorbereitung.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-vorbereitung-felder.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
