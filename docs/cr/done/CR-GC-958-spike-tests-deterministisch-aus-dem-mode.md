# CR-GC-958: Spike: Tests deterministisch aus dem Modell — Vertragstest je SCHEMA, Kettentest je FCHAIN

**Typ:** Spike, aus Item ITEM-2026-1455 (idea)
**Status:** Done, 2026-11-19, G1 Go, G2 No-Go
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

**Lauf 2026-11-19**, Code-Stand ac68bdda in einem eigenen Worktree. Werkzeug und Rohdaten liegen in `graphanalyze/docs/spikes/SPIKE-GC-958/`:
- Stand vor dem ersten Mutantenlauf: Commit 0de757b (G1) und d75e054 (G2).
- Ergebnisse: `ergebnis-g1.json`, `ergebnis-g2.json`.

**Vor dem Lauf am Generator geändert:** Datumsformate, Grenzen aus mehreren Zahlenprüfungen, exakte Listenlänge und ein Beispiel ohne optionale Felder, wenn die volle Variante abgelehnt wird. Jede Änderung gilt allgemein, keine ist auf ein Schema zugeschnitten. Alle stehen vor dem ersten Mutantenlauf.

**Kontrolle:**
- Im Grundlauf sind alle Hand- und erzeugten Tests grün.
- Jeder Arm hat mindestens eine Mutante, die ihn rot macht.
- Eine Handtestdatei läuft je in einem eigenen vitest. Im gemeinsamen Aufruf fehlten die Handtests im Bericht.

### G1: Vertragstest je SCHEMA

**Erzeugt:** 19 von 20 SCHEMA, 224 Fälle, alle auf dem Original grün.

**Nicht erzeugbar:** `SCHEMA-test-ingest-input`. Zwei `refine` verlangen genau eins der Felder `report` und `results`. Aus der Struktur des Schemas lässt sich das nicht ablesen.

| Mutante | Anzahl | Arm E findet | Arm H findet |
|---|---|---|---|
| M1 Pflichtfeld optional | 16 | 16 | 2 |
| M2 Pflichtfeld entfernt | 16 | 16 | 14 |
| M3 Typ getauscht | 9 | 8 | 7 |
| M4 Enum erweitert | 3 | 0 | 0 |
| M5 strict → object | 4 | 4 | 4 |
| **Summe** | **48** | **44** | **27** |

- 17 Mutanten findet nur Arm E, 0 nur Arm H, 4 keiner von beiden.
- `SCHEMA-test-ingest-input#M3` findet keiner, weil es weder einen erzeugten noch einen Handtest gibt.

**Urteil:**
- Muss G1-1 erfüllt (19 ≥ 18).
- Muss G1-2 erfüllt (44 ≥ 27).
- Kill G1 greift nicht.
- **G1: Go.**

**Einordnung, kein Kriterium:**
- Arm E findet M1 und M2 per Konstruktion. Der Test friert die Struktur des Schemas ein, ein Strukturbruch macht ihn deshalb rot.
- Damit ist der erzeugte Vertragstest der Zod-Schutz aus ITEM-2026-1454, geschrieben als Test statt als Hash.
- Eine Enum-Erweiterung (M4) findet er nicht. Das könnte nur ein Abgleich mit der eingefrorenen Werteliste.

### G2: Kettentest je FCHAIN

| FCHAIN | Übergaben | auf dem Original grün | Grund |
|---|---|---|---|
| `FCHAIN-model-lane` | 3 | 3 | Hand-Stimulus 14 Zeilen |
| `FCHAIN-render-document` | 3 | 0 | `main` (`src/cli.ts`) nicht exportiert; `exportMarkdown` liefert Markdown-Text, gebunden ist `MarkdownViewSchema` (Enum der Sichtnamen) → rot; `executeRender` nicht ausgeführt (pandoc, schreibt Dateien) |
| `FCHAIN-repo-lifecycle` | 4 | 0 | `main` nicht exportiert; `collectStatus` liefert `RepoStatus`, gebunden ist `CliCommandSchema` (Enum `init`/`update`/`remove`) → rot; `scaffold` und `executeUpgrade` nicht ausgeführt (npm, Host-Ende). Ihre Rückgabetypen `InstallResult` und `UpgradeReport` sind ebenfalls kein `CliCommand` |

K1 an model-lane, je Übergabe eine Mutante: Arm E findet 3 von 3, Arm H (Auswahl von `graph_tests`) findet 3 von 3. Die Erzeuger parsen ihr Ergebnis selbst, deshalb wird jeder Aufruf rot. Für render-document und repo-lifecycle gibt es keine K1-Mutante, weil alle Übergabe-SCHEMA Enums ohne Pflichtfeld sind.

**Urteil:**
- Muss G2-1 nicht erfüllt (1 von 3 FCHAIN, gefordert ≥ 2).
- Muss G2-2 erfüllt (3 ≥ 3).
- Kill G2 greift nicht.
- **G2: No-Go.**

**Soll** erfüllt: Arm E findet in G1 17 Mutanten, die Arm H nicht findet.

### Befund am Modell (Nebenergebnis)

Der erzeugte Kettentest ist auf dem Original rot, weil die Bindung im Modell falsch ist, nicht der Code. Betroffen sind:
- **`FLOW-install-result-collect-status`, `-harness-cli`, `-upgrade`:** gebunden an `SCHEMA-cli-command`. Übergeben werden aber `RepoStatus`, `InstallResult` und `UpgradeReport`.
- **`FLOW-markdown-text`:** gebunden an `SCHEMA-markdown-view`. Übergeben wird aber Markdown-Text.
- **`FLOW-render-view-request`:** gebunden an `SCHEMA-markdown-view`. Übergeben wird der Sichtname als Teil von `opts`, das Ergebnis von `executeRender` ist eine `RenderSummary`.

`rules_get_violations` (Ausschnitt mit 295 Elementen, darin `SCHEMA-markdown-view`) meldet für keinen dieser FLOW einen RC-Befund. RC-04 prüft nur, ob das Schema an der Schnittstelle irgendwo geparst wird. Keine Regel prüft, ob das gebundene SCHEMA den Typ beschreibt, den der Erzeuger liefert. Einen Lauf über das ganze Modell habe ich dafür nicht gemacht.

### Empfehlung

- **Go für G1:** Vertragstests aus dem Zod-Schema erzeugen. Weil graphcode kein Generator ist, entscheidet der Autor, wo der Generator lebt. Er überschneidet sich mit ITEM-2026-1454: Der Test ist dort eine Umsetzung.
- **No-Go für G2:** in dieser Form kein Generator für Kettentests. Erst muss das Modell die Übergaben richtig binden. Der erzeugte Kettentest hat genau diese Fehlbindungen gefunden.

## Entscheidungen

keine

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Generator, Mutanten und Läufe liegen in `graphanalyze/docs/spikes/SPIKE-GC-958/`.
Relation-Kanten: die 20 SCHEMA des Prüfsatzes G1. Die FCHAIN aus G2 nimmt R-18 nicht als Ziel; ihre Glieder stehen im CR-Text.
