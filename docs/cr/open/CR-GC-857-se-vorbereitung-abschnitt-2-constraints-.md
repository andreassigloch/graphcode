# CR-GC-857: se-vorbereitung Abschnitt 2: Constraints herunterdeklinieren mit constraintCarriers (contracts 12.8.0)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1080 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1080.json (Lane: code)

---

Abgespalten aus CR-GC-852 am 2026-10-26 (Konzept vom Auftraggeber freigegeben). Herkunft: CR-GC-804,
Abschnitt „Herunterdeklinieren" und Entscheidung 6.

## Ziel

`se-vorbereitung` §2 bekommt den zweiten Eingang: neben der Gegenmaßnahme jede nicht-funktionale
Anforderung an Modul, Kette oder System ohne Rolle, also jeden Constraint. Der Skill ordnet ihn in die vier
Klassen aus CR-GC-804 ein (Tieferlegen, Zerlegen, Funktion fehlt, Gilt quer) und liest seine Träger aus
`constraintCarriers` statt sie über Kette und Allokation selbst zu sammeln.

## Voraussetzung

`constraintCarriers` aus `@sigloch/contracts/se` 12.8.0 (CR-SM-418, ITEM-2026-1057) ist veröffentlicht und
in graphcode eingezogen. Stand 2026-10-26: 12.8.0 steht im Release-Zug, graphcode hängt an 12.7.0.

## Umfang (Dateien)

1. `.claude/commands/se-vorbereitung.md` §2
2. `tests/skill-vorbereitung-felder.test.ts` — bindet die neuen Felder an den Vertrag in contracts
3. `package.json` + `package-lock.json` (contracts-Version)
4. dieser CR

Modell: REQ + TEST an `FUNC-se-vorbereitung` per `graph_mutate`.

## Akzeptanzkriterien

- §2 ordnet einen Constraint ohne Rolle in die vier Klassen ein und liest seine Träger aus `constraintCarriers`.
- Der Text-Test ist rot, wenn §2 ein Feld nennt, das `constraintCarriers` nicht liefert.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 904, Tiefe 1, Wurzeln: `FUNC-se-vorbereitung`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-vorbereitung.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-vorbereitung-felder.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
