# CR-GC-958: Spike: Tests deterministisch aus dem Modell — Vertragstest je SCHEMA, Kettentest je FCHAIN

**Typ:** Spike, aus Item ITEM-2026-1455 (idea)
**Status:** Open
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1455.json (Lane: graph)
**Vorgänger:** CR-GC-957 (No-Go für Framework-Code; Planspiel Tests dort und unten)

---

## Frage

Finden Tests, die ein Generator ohne LLM allein aus dem Modell erzeugt, Fehler mindestens so gut wie die Handtests?

- **G1 Vertragstest je SCHEMA:** Der Generator liest nur das Zod-Schema und erzeugt daraus feste Beispiele und Prüfungen.
- **G2 Kettentest je FCHAIN:** Der Generator ruft die Glieder in Modellreihenfolge auf und prüft jede Übergabe gegen das SCHEMA ihres FLOW.

Ein Spike ändert kein Produkt. Bei No-Go entsteht kein Produktionscode.

## Ausgangslage (Planspiel, kein Kriterium)

Werkzeug: `graphanalyze/docs/spikes/SPIKE-GC-957/werkzeug/tests-planspiel.mjs`, Commit 0fb6ac3.

- In den heutigen 234 Testdateien sind 25,5 % der Zeilen Gerüst und 74 % Prüfungen, Daten und Abläufe.
- Aus dem Modell ableitbar sind höchstens 9,3 % (Imports und describe).
- Deshalb misst dieser Spike nicht den Anteil an bestehenden Zeilen. Er misst, ob erzeugte Tests Fehler finden.

## Prämisse gegen den Code geprüft

- `CLAUDE.md`: graphcode IS NOT a generator. Der Generator liegt in `graphanalyze`, nicht in `src/`.
- zod 4.4.3 ist installiert. Ein Schema lässt sich zur Laufzeit lesen, ohne den Quelltext zu parsen.
- Ein FCHAIN hat keine eigenen FLOW-Kanten. Eine Übergabe ist ein FLOW mit `io` von einem Glied und `io` zu einem Glied derselben FCHAIN.
- Heute hat keine der 33 FCHAIN eine Kante zu einem TEST. R-18 lehnt TEST→FCHAIN ab (FAQ `cr-relation-zieltypen`); der Kettentest hängt im Modell an einer REQ.
- Ein erzeugter Vertragstest prüft das Schema gegen sich selbst. Er findet nur eine spätere Änderung am Schema. Deshalb werden seine Beispiele einmal aus dem Original erzeugt und als Daten eingefroren.

## Prüfsatz (fest vor der ersten Zahl)

**Modellstand:** `docs/graph/graphcode.graph.json` wie in `graphanalyze/docs/spikes/SPIKE-GC-957/graph-1279.json`.

**G1, 20 SCHEMA:** alle SCHEMA mit `realRef` unter `src/kernel/measure/`, `src/loop/`, `src/projections/` (dieselben Module wie CR-GC-957):
`SCHEMA-adapter-befund`, `SCHEMA-code-lane-plan`, `SCHEMA-cr-groups`, `SCHEMA-eingangs-befund`, `SCHEMA-fit-advisory`, `SCHEMA-generation-step`, `SCHEMA-grenz-befund`, `SCHEMA-impacted-tests`, `SCHEMA-lauf-urteil`, `SCHEMA-markdown-view`, `SCHEMA-metrics-answer`, `SCHEMA-schlupf-zeile`, `SCHEMA-steering-delta`, `SCHEMA-steering-snapshot`, `SCHEMA-target-profile`, `SCHEMA-test-ingest-input`, `SCHEMA-test-selection`, `SCHEMA-verlauf`, `SCHEMA-vitest-lauf`, `SCHEMA-zug-bericht`.
19 davon haben einen TEST verify SCHEMA, `SCHEMA-test-ingest-input` hat keinen.

**G2, 3 FCHAIN:** alle FCHAIN, deren Übergaben alle ein gebundenes SCHEMA haben und deren FUNC alle `realRef` tragen:
`FCHAIN-model-lane` (3 Übergaben), `FCHAIN-render-document` (3), `FCHAIN-repo-lifecycle` (4).

### Fehler, die eingebaut werden (Mutanten)

Je Mutante eine Änderung am Original, einzeln eingespielt, danach zurückgesetzt. Die Liste entsteht mechanisch aus diesen Regeln und wird vor dem ersten Testlauf committet.

**G1, am Zod-Schema** (je Schema jede Regel, die anwendbar ist; „erstes“ = erstes in Deklarationsreihenfolge, auf oberster Ebene des Objekts):
- M1 erstes Pflichtfeld wird `.optional()`.
- M2 erstes Pflichtfeld wird entfernt.
- M3 erstes Feld vom Typ string wird `z.number()`, sonst erstes number-Feld wird `z.string()`.
- M4 erstes Enum bekommt den Wert `'mutant'` dazu.
- M5 `z.strictObject` wird `z.object` (nur wenn strict).

**G2, am Erzeuger einer Übergabe** (je gebundener Übergabe eine Mutante):
- K1 Das Glied, das den FLOW erzeugt, lässt im übergebenen Objekt das erste Pflichtfeld des SCHEMA weg.

### Arme

| Arm | G1 | G2 |
|---|---|---|
| **E** erzeugt | Vertragstest aus dem Original-Schema, Beispiele eingefroren | Kettentest aus dem Modell; Auslöser und Setup von Hand, in einer Datei je Kette |
| **H** Hand | die Testdateien der `testRefs` aller TEST verify dieses SCHEMA | die Auswahl von `graph_tests({changeSet: [Erzeuger-FUNC]})` |

Eine Mutante gilt als gefunden, wenn mindestens ein Test des Arms rot wird. Gezählt wird nur `vitest run`, ohne Typprüfung (eine Schema-Mutante bricht sonst den Build an fremder Stelle).

**Kontrolle:**
- Jeder erzeugte Test ist auf dem Original grün. Ein roter Test geht nicht in die Wertung und zählt als „nicht erzeugbar“.
- Je Arm wird eine Mutante gezeigt, die ihn rot macht. Sonst gilt der Arm als nicht gemessen.

**Preis:** Zeilen Handarbeit je Kette in Arm E (Auslöser und Setup), Laufzeit je Arm.

## Kriterien (fest vor der ersten Zahl)

| | Kriterium |
|---|---|
| **Muss G1-1** | Der Generator erzeugt für ≥ 18 der 20 SCHEMA einen Vertragstest, der ohne Handänderung auf dem Original grün ist |
| **Muss G1-2** | Arm E findet mindestens so viele G1-Mutanten wie Arm H |
| **Kill G1** | Arm E findet weniger G1-Mutanten als Arm H |
| **Muss G2-1** | Für ≥ 2 der 3 FCHAIN läuft ein Kettentest mit ≤ 40 Zeilen Handarbeit |
| **Muss G2-2** | Arm E findet mindestens so viele K1-Mutanten wie Arm H |
| **Kill G2** | Arm E findet weniger K1-Mutanten als Arm H |
| **Soll** | Arm E findet in G1 oder G2 mindestens eine Mutante, die Arm H nicht findet |

Go je Teil (G1, G2) = kein Kill und beide Muss erfüllt. Ein Go führt zu einer Grundsatzfrage an den Autor (graphcode ist kein Generator), nicht direkt zu einem CR. Nach dem Lauf ändern sich weder Regel noch Schwelle noch Prüfsatz.

## Ergebnis

Noch nicht gelaufen.

## Entscheidungen

keine

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Generator, Mutanten und Läufe liegen in `graphanalyze/docs/spikes/SPIKE-GC-958/`.
Relation-Kanten: die 20 SCHEMA des Prüfsatzes G1. Die FCHAIN aus G2 nimmt R-18 nicht als Ziel; ihre Glieder stehen im CR-Text.
