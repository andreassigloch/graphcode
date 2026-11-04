# CR-GC-891: Private Beispielgraphen und ihre Testfaelle nach graphanalyze (Folge von CR-GC-888)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1183 (finding)
**Erstellt:** 2026-11-04
**Item:** bok/items/ITEM-2026-1183.json (Lane: graph)

---

Folge-CR von CR-GC-888 (Teil 2 des Schnitts). Teil 1 hat Archiv, Spike und LANDSCAPE nach graphanalyze verschoben.

## Befund

`beispielgraphen/` enthält Modelle privater Projekte: moneyflow, bok, sigllm-v98 (mit Audit-Log), gve, gc-run-devstral-v14, gc-run-haiku45, gc_test-graphview, dummy-slicer, graphcode. Öffentlich bleibt nur `beispielgraphen/todo-referenz/`.

## Entscheidung (Andreas 2026-11-04)

Die Testfälle, die diese Graphen lesen, ziehen mit nach graphanalyze. Die Graphen sind eingefroren, graphanalyze ist privat (GitHub `PRIVATE`, package.json `"private": true`).

Es ziehen nur die Fälle um, nicht die Dateien. Die Dateien testen `generate` und `steer` aus `src/` und laufen teils gegen `todo-referenz/`:

| Datei | sigllm-/dummy-Fälle | bleibt in graphcode |
|---|---|---|
| `tests/generate.statemachine.test.ts` | Golden sigllm-v98 | Fälle gegen `todo-referenz/`; Datei ist testRef von TEST im Modell |
| `tests/generate.stufen.test.ts` | Zeile „Golden sigllm v98“ | Referenz lokal und frontier |
| `tests/generate.task.test.ts` | Golden sigllm-v98 | prüfen, ob ein Fall ohne Golden bleibt |
| `tests/steer-optimum.test.ts` | Block „CR-GC-608: am Golden“ | übrige Blöcke |
| `tests/randbreiten.test.ts` | Zeilen der privaten Graphen | Zeilen der verbleibenden Graphen |

Skripte auf die verbleibenden Graphen umstellen: `scripts/model-test-set.mjs`, `scripts/randbreiten.mjs`, `scripts/whitebox-messung.mjs` (liest dummy-slicer). `beispielgraphen/README.md` nachziehen.

In graphanalyze laden die umgezogenen Fälle graphcode über `graphanalyze/graphcode.mjs`.

## Abnahme

- `git ls-files beispielgraphen` zeigt nur `README.md` und `todo-referenz/`.
- graphcode: `npm run build` und `npm run verify:full CR-GC-891` grün; `rules_evaluate` ohne neuen R-19-Befund.
- graphanalyze: `npm test` grün, inklusive der umgezogenen Fälle.
- `git grep -nE 'sigllm-v98|dummy-slicer|moneyflow\.graph|bok\.graph'` trifft außerhalb von `docs/cr/` und `docs/archive/` nichts.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
