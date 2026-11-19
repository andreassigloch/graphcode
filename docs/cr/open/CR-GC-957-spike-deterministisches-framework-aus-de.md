# CR-GC-957: Spike: deterministisches Framework aus dem Modell, LLM schreibt nur die FUNC-Rümpfe

**Typ:** Spike, aus Item ITEM-2026-1453 (idea)
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1453.json (Lane: graph)
**Vorlage:** `docs/project/Spike Deterministisches Framework aus dem Modell.md`

---

## Frage

Wie viel Code eines fertigen Moduls lässt sich deterministisch aus dem Modell erzeugen, und wie klein wird dann der Kontext, den ein LLM für den Rest braucht?

- **F1:** Anteil Framework zu Algorithmus in Zeilen und Token; Anteil der FUNC, die heute vollständig ableitbar sind; die Lücken.
- **F2:** Kontext je Arbeitspaket heute gegen hybrid; besteht ein kleines LLM die Tests im 1. oder 2. Versuch?

Ein Spike ändert kein Produkt. Bei No-Go entsteht kein Produktionscode.

## Prämisse gegen den Code geprüft

- RC-01 bis RC-13 stehen in `@sigloch/contracts/se` (`conformance-rules.ts`, `call-rules.ts`) wie in der Vorlage beschrieben.
- Keine Regel prüft eine FUNC-Signatur gegen die gebundenen Zod-Typen. Keine Regel erkennt eine Inhaltsänderung an einem gebundenen Schema.
- `CLAUDE.md` sagt: graphcode IS NOT a generator. Deshalb liegt der Mini-Generator in `graphanalyze`, nicht in `src/`. Ein Go führt zu einer Grundsatzfrage an den Autor, nicht direkt zu einem CR.
- Die Vorlage spricht von „N ≥ 3 Modulen mit Modell“. graphcode hat 7 MOD; die drei Blätter mit den meisten gebundenen SCHEMA sind gewählt (siehe Prüfsatz).

## Prüfsatz (fest vor der ersten Zahl)

**Module F1:** `MOD-kernel-measure` (`src/kernel/measure`), `MOD-loop` (`src/loop`), `MOD-projections` (`src/projections`). Gezählt werden alle `*.ts` unter dem `path` des MOD, ohne Testdateien.

**FUNC F2:** aus `MOD-kernel-measure` die sechs FUNC, deren REQ einen TEST mit `testRefs` haben und deren SCHEMA alle gebunden sind: `FUNC-compute-steering-delta`, `FUNC-ein-adapter-je-akteur`, `FUNC-eingaenge-nur-aus`, `FUNC-grenze-nur-mit-schema`, `FUNC-select-tests`, `FUNC-zug-bericht`.

**Modellstand:** `docs/graph/graphcode.graph.json` bei graphVersion 1278.

### Zählregel F1

Jede Zeile, die nicht leer und kein reiner Kommentar ist, fällt in genau eine Klasse:

| Klasse | Zeilen |
|---|---|
| **F** Framework | `import`/`export … from`; `type`/`interface`-Deklarationen; Kopf einer Funktion, die ein FUNC-`realRef` ist (von `function`/`const` bis zur öffnenden `{`) und ihre schließende `}`; eine Zeile im Rumpf dieser Funktion, deren einziger Ausdruck `<S>.parse(…)`/`<S>.safeParse(…)` eines an die FUNC per FLOW gebundenen SCHEMA ist (nur der Aufruf, ein mehrzeiliges Objekt darin zählt als A) |
| **V** Vertrag | die Deklaration eines Zod-Schemas (`… = z.…`), über alle Zeilen bis zum Ende des Ausdrucks |
| **A** Algorithmus | alles andere, auch Kopf und Rumpf von Hilfsfunktionen ohne FUNC |

V ist getrennt, weil die Vorlage das SCHEMA als Quelle im Code führt: der Generator erzeugt es nicht, das LLM schreibt es aber auch nicht im Bau.

Beispiele aus `src/kernel/measure/constraints.ts`:
- Zeilen 143–147 (`export function einAdapterJeAkteur(` bis `): AdapterBefund {`) → F, FUNC-Kopf.
- Zeile 166 `return AdapterBefund.parse({ flussOhneEinModul, moduleOhneEinenAkteur, akteurOhneAdapter });` → F, Parse des gebundenen Ausgangs.
- Zeilen 61–… `export const AdapterBefund = z.strictObject({ …` → V.
- Zeile 148 `const { idx, kinder, kinderVon, endpunkte } = kindModule(graph, elternMod);` → A.

**Token:** lexikalische Token des TypeScript-Scanners (`ts.createScanner`), ohne Leerraum und Kommentar.

**Kontrolle F1:** eine Fixture-Datei mit Hand-Zählung (F/V/A) in `graphanalyze`. Der Zähler muss sie exakt treffen, bevor er auf die Module läuft.

### Ableitbarkeit F1 (Readiness-Lint)

Eine FUNC gilt als ableitbar, wenn alle sechs Punkte gelten:
1. `realRef` vorhanden, kein RC-01-Befund.
2. `allocate` auf genau ein MOD.
3. mindestens eine REQ per `satisfy`.
4. jede dieser REQ hat einen TEST mit `testRefs`.
5. jeder `io`-FLOW der FUNC hat ein SCHEMA mit `realRef`, ohne RC-03- oder RC-08-Befund.
6. kein RC-12- oder RC-13-Befund an der FUNC oder ihren FLOW.

Jeder verletzte Punkt ist eine Lücke ihrer Klasse. Erfolgsausgang und Fehlerfälle hat die Ontologie nicht als Attribut; sie werden als Lückenklasse „im Modell nicht darstellbar“ geführt, nicht gezählt.

### Ablauf F2

Je FUNC, beide Arme, gleiches Modell:
1. **Kontrolle:** Originalrumpf → Tests der `testRefs` grün; Rumpf durch `throw new Error('rumpf')` ersetzt → rot. Nur FUNC, die beides zeigen, gehen in die Wertung.
2. **Arm R (heute):** Auftrag nach `se-bau`: Ausgabe von `graph_context(<FUNC>)`, Datei und Symbol, Testdateien; der Agent darf das Repo lesen.
3. **Arm H (hybrid):** Arbeitspaket aus dem Mini-Generator: Signatur, Quelltext der gebundenen Zod-Schemas, REQ-Texte, Testdateien. Der Agent darf das Repo lesen; jeder Lesezugriff wird gezählt.
4. Versuch 1; sind die Tests rot, Versuch 2 mit der Testausgabe. Mehr Versuche gibt es nicht.

**Modell:** aus der OpenCode-Config, `ollama/qwen3.8:27b-nvfp4`, temperature 0.6, top_p 0.95. Ein Seed lässt sich in OpenCode nicht setzen: je FUNC und Arm ein Lauf, paarweise auf derselben FUNC.

**Gemessen je Lauf:** Eingabe-Token (aus `opencode.db`), Zahl gelesener Dateien, Versuch bis grün oder „rot nach 2“, Rückfragen oder Abbruch.

## Kriterien (fest vor der ersten Zahl)

| | Kriterium |
|---|---|
| **Kill F1** | Median des F-Anteils (F / (F+V+A), Zeilen) über die 3 Module < 30 % |
| **Muss F2-1** | Median Eingabe-Token je FUNC: H ≤ 50 % von R |
| **Muss F2-2** | H besteht bei mindestens so vielen FUNC in ≤ 2 Versuchen wie R |
| **Kill F2** | H besteht bei weniger FUNC als R |
| **Soll F2** | H besteht bei ≥ 4 der gewerteten FUNC |

Go = kein Kill und beide Muss erfüllt. Nach dem Lauf ändert sich weder Regel noch Schwelle noch FUNC-Liste.

## Ergebnis

_(nach dem Lauf, unverändert protokolliert)_

## Entscheidungen

keine

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Werkzeuge und Läufe liegen in `graphanalyze` (`docs/spikes/SPIKE-GC-957-*`).
Relation-Kanten: `MOD-kernel-measure`, `MOD-loop`, `MOD-projections`.
