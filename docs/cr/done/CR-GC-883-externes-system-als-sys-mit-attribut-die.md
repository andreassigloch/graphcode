# CR-GC-883: Externes System als SYS mit Attribut: Dienst außerhalb der Grenze, Kante vom Aufrufer, eine Funktion für die Wurzel

**Status:** ⛔ Verworfen (2026-11-01)
**Grund:** Folge von CR-SM-425 (verworfen). Die Lehre bleibt: Ein Dienst, der nur antwortet, ist kein ACTOR und hat keinen Fluss im Modell. Der Text bleibt als Konzept erhalten.
**Typ:** aus Item ITEM-2026-1146 (idea)
**Erstellt:** 2026-10-31
**Item:** bok/items/ITEM-2026-1146.json (Lane: graph)

---

## Befund

CR-SM-425 führt externe Systeme als `SYS` mit `outsideBoundary` ein. graphcode nimmt an mehreren Stellen das
erste SYS, und die Lehre sagt noch „ohne Fluss im Modell".

## Entscheidung des Autors (2026-10-31)

Ein externes System ist ein `SYS` mit Attribut, kein eigener Typ und kein ACTOR. Begründung und Zielbild: CR-SM-425.

## Zielbild

- **Wurzel:** `src/loop/generate.ts:601-602` und `src/kernel/measure/focus-set.ts:97` nutzen die Funktion aus
  contracts statt `find(type === 'SYS')`.
- **Weitere Leser prüfen:** `src/projections/` (`incose.ts`, `srs.ts`, `exporter.ts`, `helpers.ts`,
  `graphcode.ts`, `test-schlupf.ts`), `src/kernel/harness-import.ts`, `src/surface/import-code-verb.ts`.
- **Lehre:** `se:author-actor` und `se:top-level`: Ein Dienst, der nur antwortet, bleibt kein ACTOR. Neu ist
  er ein SYS mit `outsideBoundary` und einer Kante von der aufrufenden Funktion.
- **ICD:** Die Sicht nennt externe Systeme als Schnittstelle.

## Abhängigkeiten

- CR-SM-425 muss als contracts-Release vorliegen.
- Überschneidung mit CR-GC-878: Beide ändern Skill-Texte.
- `aise dispatch prepare` fand keinen Host: Der CR-Knoten fehlt, der erste Modell-Zug zieht ihn nach.

## Abnahme

- Rot zuerst: Ein Modell mit externem SYS, dessen Id alphabetisch vor der Wurzel steht. `generate` und `focus-set`
  lesen die Wurzel.
- Kein Skill empfiehlt noch „with no flow in the model" für einen externen Dienst.
- Der Test `tests/skill-top-level-ausloeser.test.ts` prüft die neuen Sätze.
- Die ICD-Sicht von immo-infra nennt PropStack nach dem Modell-Zug.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
