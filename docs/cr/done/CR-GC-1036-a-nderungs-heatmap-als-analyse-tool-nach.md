# CR-GC-1036: Änderungs-Heatmap als Analyse-Tool nach graphanalyze

**Typ:** aus Item ITEM-2026-1710 (finding)
**Erstellt:** 2026-11-26
**Item:** bok/items/ITEM-2026-1710.json (Lane: code)

---

Entscheidung Autor 2026-11-26: das ganze Tool (Skript, Config, Vorlage, Test, Ausgabe) zieht nach graphanalyze; FUNC/REQ/TEST verlassen das graphcode-Modell; der offene CR-GC-1033 zieht als CR-GA-002 mit.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Gehört ein Analyse-Tool über mehrere, auch private Repos ins graphcode-Modell? | Nein. Die Änderungs-Heatmap ist ein Analyse-Tool, kein Produktpfad: Werkzeug, Test und Ausgabe liegen in graphanalyze, FUNC, REQ und TEST verlassen das graphcode-Modell. | Entscheidung des Autors am 2026-11-26 (Analysen und Analyse-Tools nach graphanalyze). |

---

## Umfang

- `scripts/aenderungs-heatmap.mjs`, `.config.json`, `.html` → `graphanalyze/werkzeuge/aenderungs-heatmap/`; `tests/aenderungs-heatmap.test.ts` → `graphanalyze/tests/`; Ausgabe → `graphanalyze/docs/messung/aenderungs-heatmap.html`. Dort: Wurzel zwei Ebenen höher, graphcode als `../graphcode` in der Config.
- Gegenprobe: `--json`-Ausgabe alt (graphcode) gegen neu (graphanalyze) bei gleichem Stand, 11 von 11 Feldern gleich (ohne Zeitstempel). Test in graphanalyze 7/7 grün.
- Modell: FUNC-aenderungs-heatmap, REQ-aenderungs-hotspots, TEST-aenderungs-heatmap gelöscht (`graph_impact`: nur Heatmap-eigene Kanten, Eltern-REQ REQ-quality-metric behält drei TESTs); Trockenlauf ohne neuen Fehler.
- Der offene, unbegonnene CR-GC-1033 zieht als CR-GA-002 nach graphanalyze; sein Knoten verlässt das Modell.
- `scripts/model-test-set.json` neu gemessen; Kommentar in `src/loop/generate-klauseln.ts` nennt den neuen Ort.
- Danach trägt der Stand keinen verbotenen Pfad der Push-Prüfung mehr.

## Vorbestand

- graphanalyze `tests/rig-interaktiv.test.ts`: 2 Fälle rot (`todo-skill-warnungsfrei`, `todo-hand-skill-wf`). Ursache: `start.md` dieser Rig-Aufgaben trägt den Wortlaut des Skills `se:close-violations` vor CR-GC-942/945/949 (2026-11-15). Die Commits dieses CR berühren weder `rig/` noch den Test (`git diff 19f5d9a HEAD -- rig tests/rig-interaktiv.test.ts` leer). Item ITEM-2026-1711.

## Läufe

- `verify:code`: Spur CODE, 84 Testdateien grün.
- `verify:full`: 8870 Tests grün, Schlupf 0.
- graphanalyze `npm test`: Heatmap-Test 7/7 grün; 2 rote Fälle sind Vorbestand (siehe oben).
