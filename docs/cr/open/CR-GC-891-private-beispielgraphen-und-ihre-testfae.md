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

## Ergebnis (2026-11-04)

**Abweichung von der Entscheidung vom Vormittag (Autor 2026-11-04, Nachfrage):** Die sigllm-Fälle ziehen nicht um. Der Golden ist graphcodes einziger realistischer Prüfstand für etwa 20 Regressionstests von `generate` und `steer`; umgezogen liefen sie nur noch in graphanalyze, und `graphcode.mjs` hätte 6 Funktionen mehr koppeln müssen. Stattdessen liegt er **anonymisiert** hier.

- **Anonymisiert:** `sigllm-v98.graph.json`, `sigllm-v98.audit.jsonl` und `moneyflow.graph.json`. Jedes Wort in Namen, Beschreibungen, uids, Pfaden und Testfällen wird durch ein Kunstwort gleicher Länge ersetzt, dasselbe Wort überall durch dasselbe. moneyflow kam dazu, weil zwei Fälle in `randbreiten.test.ts` ihn als Beleg brauchen (grösster Graph, 0 Whiteboxen). Werkzeug und Originale liegen in graphanalyze (Commit `ef525ef`); das Werkzeug erzeugt die Dateien byte-gleich neu (geprüft).
- **Prüfung, dass nur der Inhalt wechselte:** die 8 Testdateien, die den Golden lesen, vorher 84/84 grün, nachher 84/84 grün — keine Erwartung geändert ausser den vier wörtlichen Stellen in `read-tools.scope.test.ts` (drei uids, ein Text), die auf die Kunstwörter umgestellt sind. Ein erster Lauf mit Kunstwörtern anderer Länge brach eine Grössengrenze (4418 statt < 4400 Zeichen); daher gleiche Länge.
- **Entfernt:** `bok`, `graph-view-edit`, `gc_test-graphview` — Leser war nur `randbreiten`; ihre Zeilen in `STAND` sind gestrichen. Die Originale liegen in graphanalyze.
- **Bleiben unverändert:** `dummy-slicer` (fiktiv), `gc-run-*` (Läufe auf einer generischen Aufgabe), `graphcode` (eigenes Modell), `todo-referenz/`.
- **`beispielgraphen/README.md`** neu: Abschnitt Anonymisierung, Prüfsummen alt und neu, Leser.
- **Modell:** `CR-GC-891 -relation-> REQ-docs-taxonomy` (Graph-Version 1000). Eine Kante auf `TEST-generation-statemachine` lehnt R-18 ab (CR → TEST ist kein Muster).
- **Tests:** Build grün; `verify:full CR-GC-891` 1701/1701, Schlupf 0.
- **Befund zur Spur CODE:** `verify:code` wählte für diesen Diff 2 Testdateien. Die 8 Tests, die die geänderten Fixtures lesen, fehlten: eine Fixture-Datei hat keinen Knoten, die Spur sieht den Leser nicht. Hier fing es der Handlauf und der Volllauf; ein eigenes Item wert.
- **Nicht gepusht.**
