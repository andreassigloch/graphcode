# CR-GC-777: Zweiter Ring nach der Executor-Auslagerung: verwaiste Zweige und Exporte (Treiber-Zweig in generate/suggest, Stempel in task-artifact, Kanal-Attribut treiber, Beispielgraphen)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-808 (finding)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-808.json (Lane: code)

---

## Befund

Nach der Auslagerung des Executors (CR-GC-775, CR-GC-776) blieb Code, den nur er brauchte und den seither
kein Aufrufer im Host mehr erreichte — nur noch Tests fuhren ihn.

## Entfernt

| Stelle | Was |
|---|---|
| `src/loop/generate.ts` | die Unterscheidung Host/Treiber: Typ und Parameter `selection`, die Treiber-Texte, der Ausschluss von Eintrittspunkten im Treiber, die Task-Klausel, `skillDatei`. 1.067 → 974 Zeilen |
| `src/loop/suggest.ts` | Eingabefeld `selection` am Werkzeug `graph_generate` |
| `src/loop/task-clause.ts` | ganze Datei |
| `src/loop/task-artifact.ts` | alles bis auf die Liste der Analyse-Tasks. 174 → 12 Zeilen |
| `src/loop/channel-rank.ts` | zwei Typen der gelöschten Dublettenprüfung |
| Kommentare | Executor als heutiger Leser, in zehn Dateien |

Das Verhalten für den Host ist unverändert: Die Host-Fassung war die Voreinstellung und ist jetzt die einzige.
Wer `selection` noch an `graph_generate` sendet, bekommt den Host-Schritt; das Feld wird verworfen.

## Bewusst gelassen

- `bindToolsWithContext`: sechs Tests brauchen die Kontext-Sicht.
- `VERDICT_ORDER` in `src/loop/decisions.ts`: steht über den Protokolltext im Host-Prompt.
- `beispielgraphen/gc-run-*.graph.json`: ein Skript liest das Verzeichnis, ein Artikel verlinkt eine Datei.

## Tests

- Rot zuerst: neuer Fall in `tests/generate.test.ts`, „das Eingabefeld selection gibt es nicht mehr".
- Gelöscht: Fälle, die nur Treiber-Verhalten prüften (in `generate`, `generate.task`, `stagnation`, `task-analysen`).
- Umgestellt: sieben Testdateien auf die neue Signatur; Host-Assertions erhalten.

## Modell

`REQ-analyse-artefakt-vor-stempel` und `TEST-task-analysen` neu gefasst: Die Anforderung beschrieb den
Stempel-Abschluss des Executors; sie sagt jetzt, was der Test noch prüft (Bauplan zählt mit offenen
Aufträgen, Stempel werden ganz geschrieben).

## Noch gesehen, nicht angefasst

- Das Feld `file` an den Skill-Verweisen in `generate.ts` hat keinen Leser mehr.
- Die Marken `<!-- inject:start/end -->` in drei Skill-Dateien liest niemand mehr.
- Der Prompt-Text der Anwendungsfall-Vorlage sagt „die volle Anleitung steht als Block im Rundeninhalt" —
  das stimmte nur für den Executor. Ein Prompt-Text, deshalb nicht in einer Aufräum-CR geändert.
- Vier Felder im Schritt-Vertrag (`offeneTasks`, `offeneFunde`, `focusElements`, `focusTypes`) kamen für den
  Executor; ob der Host sie liest, ist nicht geprüft.
- Das Kanal-Attribut „Treiber" im Modell trägt überall „Host".
