# CR-GC-776: Executor im Host auslagern: toten Code, Tests und Modellknoten loeschen

**Status:** ✅ Done (2026-10-09)
**Typ:** aus Item ITEM-2026-807 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-807.json (Lane: code)

---

## Herkunft

Zweiter Teil der Auslagerung des Executors (CR-GC-775 trägt den Quellcode).

## Tests

**Gelöscht (22 Dateien):** alle Tests, die nur den Executor prüften.

**Angepasst (14 Dateien):** Tests, die Bleibendes prüfen und den Executor als Vehikel nutzten.

| Datei | Änderung |
|---|---|
| `channel-rank`, `decision-texts`, `generate` | Fälle zu gelöschten Funktionen entfernt; ein neuer Fall hält die Kriterienordnung am Register fest |
| `flow-contracts`, `gate.modelfree`, `nd-similarity` | Executor-Teil entfernt; der Teil über Export-Marke, modellfreies Gate und ND-Regeln bleibt |
| `schema-parse-at-interface` | sieben Fälle prüfen die Verträge jetzt direkt statt über die Rangfolge |
| `skill-kinds-werte`, `skill-rule-ids` | Executor-Prompt aus den gescannten Texten; Positivkontrolle je Quelle statt Summe |
| `task-analysen` | Bauplan-Vorbild geht direkt durchs Gate |
| `cli.scaffold`, `mvp-e2e` | kein Schalter mehr im Host-Block; neuer Fall: `update` entfernt beide alten Schalter |
| `channel-model` | ein Treiber statt zwei |
| `arch.optimization-dry-run.spike` | Autopilot-Messung neu festgeschrieben (drei Züge, alle fachlich falsch, ITEM-2026-798) |

Mehr als zehn Dateien: jede Änderung folgt aus derselben Löschung; ein Teilstand ließe Tests gegen
gelöschten Code stehen.

## Modell

Durchs Gate, graphVersion 665 → 668, kein Fehler:

- **85 Knoten gelöscht:** 20 Funktionen (darunter die Blöcke Antrieb, Modell-Draht, Runden-Prompt),
  die Kette des Executors, 28 Flüsse, 12 Verträge, 11 Tests, 11 Anforderungen, der Akteur Modell-Endpunkt.
- **Neu:** Kette `FCHAIN-grammar-query` für `graph_authoring_guide`, das nur in der Executor-Kette lag.
- **Umgehängt:** der Steuerungs-Vergleich in die Steuerungsschleife; die Werkzeug-Registry geht direkt
  an die stdio-Bindung; „offener Punkt wird gefragt" erfüllt jetzt der Skill `se:generate`.
- **Fünf erledigte CRs** (714, 763, 769, 772, 773) zeigen auf das Modul statt auf gelöschte Funktionen.
- **Kanäle:** alle elf tragen den Treiber Host.

Beim Anlegen dieser CR hat der Export 21 Platzhalterdateien unter den gelöschten Pfaden neu erzeugt (das
Modell band noch an sie). Nach dem Modellzug gelöscht; ein zweiter Export erzeugt keine mehr.

## Dokumente

`docs/project/steuerungsschleife.md`, `docs/articles/05-the-advisory-roundtrip.md`.

## Ergebnis

24 von 25 Wirkketten bewertbar (wie zuvor; eine Kette weg, eine neu). Das Modell hat 1.007 statt 1.087 Elemente. Volllauf wie in CR-GC-775.
