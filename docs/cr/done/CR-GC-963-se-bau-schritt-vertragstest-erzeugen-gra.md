# CR-GC-963: se-bau erzeugt den Vertragstest je neuem oder geändertem SCHEMA

**Typ:** aus Item ITEM-2026-1478 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1478.json (Lane: graph)
**Status:** Done — 2026-11-19
**Herkunft:** CR-GC-961 F1 (Folge 2), CR-GC-962 (Verb `graphcode vertragstest`)

---

## Befund

Seit CR-GC-962 erzeugt `graphcode vertragstest` den Vertragstest je SCHEMA aus dem Zod-Schema. `se-bau` nennt den Schritt nicht. Ein Vertragstest entsteht heute nur, wenn jemand R-32 liest und ihn von Hand schreibt. Im Spike CR-GC-958 fanden Handtests 27 von 48 eingebauten Schemafehlern, der erzeugte Satz 44.

## Änderung

| Datei | Was |
|---|---|
| `.claude/commands/se-bau.md` | Koordinator Punkt 7: nach dem Zusammenführen und dem Export des `realRef` ruft er `npx graphcode vertragstest <uid …>` auf, bindet die Datei als TEST mit `verify` und `testRefs` und fährt sie. Kein Vertragstest von Hand für ein SCHEMA mit Zod-Symbol; Ausnahme: das Verb lehnt es mit Grund ab (Exit 1). Version 1 → 2. |
| `tests/skill-bau.test.ts` | prüft Punkt 7 und Version 2; vor der Textänderung rot gesehen |

Modell: `REQ-bau-vertragstest-erzeugen` (FUNC-se-bau satisfy, TEST-skill-bau verify).

Der Koordinator ruft das Verb, nicht der Umsetzer: Das Verb liest den Snapshot, und den Snapshot schreibt nur der Koordinator.

## Nicht in diesem CR

- **Gerüst der Testdatei von Hand aus einer Vertragsdatei (CR-GC-961 F3d):** Es braucht zuerst das Format der Vertragsdatei und die Regeln, die einen Dokument-`realRef` annehmen (CR-GC-961 Folge 3 und 4). Ohne sie würde der Schritt Dateien erzeugen, die R-26 weiter meldet.
- **Abgleich der eingefrorenen Enum-Werte (ITEM-2026-1454):** Der Generator prüft heute nur, dass ein Wert außerhalb abgelehnt wird; eine Enum-Erweiterung bricht den erzeugten Test nicht. Bleibt im Item.

## Akzeptanzkriterien

- [x] `tests/skill-bau.test.ts` grün, die neue Prüfung vor der Textänderung rot gesehen.
- [x] Alle Skill-Tests grün (`tests/skill*`).
- [x] `verify:full CR-GC-963` grün.


---

## Ergebnis

- `tests/skill-bau.test.ts`: die neue Prüfung und die Version waren vor der Textänderung rot, danach grün.
- Skill-Tests `tests/skill*`: 28 Dateien, 298 Tests grün.
- `verify:full CR-GC-963`: rot 0, Schlupf 0.
- Smoke: Der Skill ist Text; das Verb, das er aufruft, lief in CR-GC-962 (Exit 0 und 2).

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wer erzeugt den Vertragstest? | Der Koordinator, mit `graphcode vertragstest`, nach dem Zusammenführen | Das Verb liest den Snapshot; nur der Koordinator schreibt das Modell (se-bau Punkt 3). |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1322, Tiefe 1, Wurzeln: `FUNC-se-bau`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-bau.md

Tests (`graph_tests`, 1):
- tests/skill-bau.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
