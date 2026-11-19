# CR-GC-956: grenzeNurMitSchema: eigene Liste zwischenKindern streichen; ein Fluss zwischen Kind-Modulen ist nur ohne erlaubten Vertrag ein Befund, wie jeder Grenzfluss (Autor 2026-11-19, ersetzt Lesart aus CR-GC-913)

**Typ:** aus Item ITEM-2026-1452 (finding)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1452.json (Lane: code)

---

## Befund

CR-GC-913 baute `grenzeNurMitSchema` nach der engeren Lesart: Ein Fluss zwischen zwei Kind-Modulen war immer ein
Befund (`zwischenKindern`), auch mit einem Vertrag aus der Liste. Der Autor sah dafür am 2026-11-19 keinen Grund:
Ein Fluss ohne Vertrag ist immer ein Problem, ein Fluss mit erlaubtem Vertrag nicht.

## Zielbild

- Ein Fluss zwischen zwei Kind-Modulen ist ein Grenzfluss wie jeder andere. Er ist nur ein Befund, wenn er kein
  Schema oder ein Schema außerhalb der Liste trägt; dann steht er in `ohneSchema` mit beiden Modulen.
- `GrenzBefund` hat nur noch `ohneSchema`. Das Feld `zwischenKindern` ist gestrichen, kein zweiter Pfad.
- `se/constraints.md` (Version 8): Die Zeile Erweiterbarkeit verbietet keinen Fluss zwischen Kind-Modulen mehr.

## Akzeptanz

- [x] Tests in `tests/constraint-grenze-adapter.test.ts` vorher rot (6 von 15, Feld `zwischenKindern` im Befund),
  nachher grün: Fluss zwischen Kind-Modulen mit erlaubtem Schema ist kein Befund, ohne Schema ist er einer mit
  beiden Modulen; der Vertrag lehnt `zwischenKindern` ab.
- [x] REQ, SCHEMA und FUNC im Modell beschreiben die weitere Lesart.
- [x] `npm run verify:full CR-GC-956` grün: 234 von 234 Dateien, rot 0, Schlupf 0.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Ist ein Fluss zwischen zwei Kind-Modulen mit erlaubtem Vertrag ein Befund von `grenzeNurMitSchema`? | Nein. Befund ist nur ein Fluss ohne erlaubten Vertrag, an jeder Grenze. | Autor 2026-11-19: Für ein Verbot fiel ihm kein Grund ein; ein Fluss ohne Vertrag ist immer ein Problem. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1275, Tiefe 1, Wurzeln: `FUNC-grenze-nur-mit-schema`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- src/kernel/measure/constraints.ts

Tests (`graph_tests`, 2):
- tests/constraint-grenze-adapter.test.ts
- tests/contracts.kernel.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
