# CR-GC-1023: Probelauf-Test des Optimierers liest das lebende Modell und muss nach jeder Modellaenderung neu eingemessen werden

**Typ:** aus Item ITEM-2026-1631 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1631.json (Lane: code)

---

## Befund

`tests/arch.optimization-dry-run.spike.test.ts` probt den Optimierer an `docs/graph/graphcode.graph.json`, also am lebenden Modell. Er hält die gemessenen Züge und den Engpass als Erwartung fest. Jede Modelländerung, die einen Vertrag oder einen Fluss bewegt, macht ihn rot, ohne dass etwas kaputt ist. In CR-GC-1014 bis 1019 musste er fünfmal neu eingemessen werden. Die FAQ `test-kein-live-zustand` entscheidet: Tests urteilen nur gegen eine eingecheckte, eingefrorene Vorlage.

## Zug

1. `tests/fixtures/arch-dry-run.graph.json` ist eine Kopie der SSOT am Commit 76f1b825 (nach CR-GC-1022).
2. Der Test liest die Vorlage. Ihre Prüfsumme steht als Konstante im Test. Weicht sie ab, bricht der Test ab, statt falsch zu messen.
3. Nachziehen nur per bewusstem Commit: Vorlage, Prüfsumme und Erwartungen gemeinsam.
4. `scripts/model-test-set.mjs` führt den Test nicht mehr in der Modell-Spur, sondern unter den begründeten Ausschlüssen. Eine Modelländerung kann ihn nicht mehr rot machen, Code und Regeln schon (Spur CODE).

Die übrigen Tests der Modell-Spur lesen die SSOT absichtlich: Sie prüfen das Modell selbst. Sie bleiben unverändert.

## Abnahme

- Der Test ist grün gegen die Vorlage.
- Ein geändertes Zeichen in der Vorlage bricht ihn an der Prüfsumme ab (Gegenprobe gefahren).
- Der Wächter `tests/verify-model.completeness.test.ts` ist grün.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1597, Tiefe 1, Wurzeln: `SCHEMA-generation-request`._

Reichweite: 1 Elemente (FLOW 1); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- src/loop/generate.ts

Tests (`graph_tests`, 1):
- tests/vertrag/SCHEMA-generation-request.vertrag.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
