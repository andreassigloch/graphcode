# CR-GC-998: Generator: kein Zusatzfeld-Fall fuer nicht-strikte Objekte

**Typ:** aus Item ITEM-2026-1575 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1575.json (Lane: code)

---

graphcode vertragstest bildet fuer ein nicht-striktes z.object den Fall 'lehnt ab: unbekanntes Zusatzfeld'. Zod nimmt das Zusatzfeld an, der Fall landet als Rauschen in verworfen. Entscheidung des Autors: Fall nur fuer strikte Objekte (z.strictObject), fuer z.object gar nicht, fuer z.looseObject bleibt 'nimmt an'.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Welche Objekte bekommen den Zusatzfeld-Fall? | Nur `z.strictObject` (Fall „lehnt ab"). `z.looseObject` behält „nimmt an". `z.object` bekommt keinen. | Zod nimmt das Zusatzfeld bei `z.object` an: der Fall war immer Rauschen in `verworfen`. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1479, Tiefe 1, Wurzeln: `FUNC-erzeuge-vertragstests`, `FUNC-vertragstest-verb`._

Reichweite: 7 Elemente (FLOW 3, FUNC 4); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 2):
- src/projections/vertragstest.ts
- src/surface/vertragstest-verb.ts

Tests (`graph_tests`, 5):
- tests/cli.scaffold.test.ts
- tests/knowledge-binding.test.ts
- tests/vertrag/SCHEMA-vertragstest-bericht.vertrag.test.ts
- tests/vertrag/SCHEMA-vertragstest-satz.vertrag.test.ts
- tests/vertragstest.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Änderung

`src/projections/vertragstest.ts` (`knoten`, Zweig `object`): der Fall entsteht nur noch, wenn `catchall` vom Typ `never` (strikt) oder `unknown` (offen) ist. Datei 805 auf 807 Zeilen (Grenze 500 schon vorher verletzt, Schnitt nicht Teil dieses CR). `tests/vertragstest.test.ts`: der Test „lehnt ab, was das Original annimmt, und verwirft den Fall" gilt nicht mehr (der Fall entsteht gar nicht); ersetzt durch zwei Tests: kein Fall für `z.object`, weder aufgenommen noch verworfen; offen „nimmt an", strikt „lehnt ab". Rot zuerst gesehen: `verworfen` enthielt den Fall.

## Messung

Alle 29 Dateien unter `tests/vertrag` neu erzeugt (`graphcode vertragstest <29 uid>`): `git status` zeigt keine Änderung, jede Datei bleibt byte-gleich; die Zahl der Fälle je Schema ist gleich. `verworfen` über die 29 Schemas: vorher 63, nachher 5 (58 Zusatzfeld-Fälle weg). Die 5 übrigen betreffen andere Fälle (`lehnt ab ohne elements`, `context mit falschem Typ` ×3, `lehnt ab ohne paket`) und sind nicht Teil dieses CR.

