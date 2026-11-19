# CR-GC-966: Vertragsdatei: Spalte Kriterium fuer Bedingungen ohne Grenzwert

**Typ:** aus Item ITEM-2026-1481 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1481.json (Lane: graph)

---

## Befund

Die Verträge in sirail enthalten neben Grenzwerten Bedingungen ohne Zahl. Beispiele: „Polarität kehrt mit der Richtung um“ (`SCHEMA-block-voltage`), „je Richtung taktet genau ein Eingang“ (`SCHEMA-pwm-signal`). Der Generator aus CR-GC-965 verwirft jede Zeile ohne Min und Max. Mit ihm fielen diese Kriterien aus dem erzeugten Test von Hand, obwohl die heutigen TEST-Beschreibungen in sirail sie prüfen.

## Zielbild

- Die Vertragstabelle kennt die optionale Spalte `Kriterium`.
- Eine Zeile ist prüfbar, wenn sie Min, Max oder ein Kriterium trägt.
- Zeile nur mit Kriterium: „Prüfe <Größe> am <Messpunkt>; bestanden, wenn <Kriterium>.“
- Zeile mit Grenzwert und Kriterium: Das Kriterium steht nach der Grenze, mit „und“ angehängt.
- Eine Zeile ohne Min, Max und Kriterium bleibt verworfen.

## Akzeptanz

1. Eine Zeile nur mit Kriterium ergibt einen Prüfpunkt (Test, rot gesehen).
2. Eine Zeile mit Grenzwert und Kriterium nennt beides.
3. `se-bau` nennt die Spalte; der Skill-Test prüft es.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Bedingung ohne Zahl im Vertrag | optionale Spalte `Kriterium` der Vertragstabelle | Sonst fällt ein Teil des Vertrags aus dem Test von Hand. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1336, Tiefe 1, Wurzeln: `FUNC-erzeuge-vertragstests`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 2):
- src/projections/vertragstest.ts
- src/surface/vertragstest-verb.ts

Tests (`graph_tests`, 3):
- tests/vertrag/SCHEMA-vertragstest-bericht.vertrag.test.ts
- tests/vertrag/SCHEMA-vertragstest-satz.vertrag.test.ts
- tests/vertragstest.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-19)

- `pruefpunkte` liest die optionale Spalte `Kriterium`; eine Zeile ist prüfbar mit Min, Max oder Kriterium.
- `tests/vertragstest.test.ts`: neuer Fall, vor der Änderung rot; `se-bau` nennt die Spalte, der Skill-Test war vorher rot.
- Modell: Beschreibung von `REQ-contract-test-manual` nachgezogen.
- `verify:full CR-GC-966`: 246 Dateien, rot 0, Schlupf 0; Folge ohne Schlupf 2/10.
