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

**Lauf 2026-11-19**, Modellstand graphVersion 1279 (Commit 061104f0; 1279 = 1278 + die drei Relation-Kanten dieses CR). Werkzeug und Rohdaten: `graphanalyze/docs/spikes/SPIKE-GC-957/` (`klassifizieren.mjs`, `ableitbar.mjs`, `f1-zeilen.json`, `f1-ableitbar.json`).

**Kontrolle F1:** Die Fixture (`werkzeug/fixture.ts`) ergibt nach Hand-Zählung F 9, V 3, A 8 Zeilen; der Zähler trifft jede Zeile. Alle FUNC-Anker unter den Modulpfaden wurden gefunden.

### F1: Anteile

| MOD | Dateien | Zeilen | F | V | A | Token F | Token V | Token A |
|---|---|---|---|---|---|---|---|---|
| `MOD-kernel-measure` | 9 | 919 | 15,7 % | 15,7 % | 68,7 % | 12,5 % | 19,4 % | 68,0 % |
| `MOD-loop` | 10 | 1900 | 10,3 % | 5,1 % | 84,6 % | 8,7 % | 4,6 % | 86,8 % |
| `MOD-projections` | 23 | 4979 | 13,4 % | 4,6 % | 82,0 % | 9,0 % | 4,9 % | 86,1 % |

Median F-Anteil (Zeilen): **13,4 %**. **Kill F1 greift** (< 30 %).

Beobachtung, kein Kriterium: Auch wenn man V ganz zum Framework zählt, liegt der Median bei 18,0 % (`MOD-projections`: 13,4 % + 4,6 %).

### F1: Ableitbarkeit

| MOD | FUNC | ableitbar |
|---|---|---|
| `MOD-kernel-measure` | 10 | 6 |
| `MOD-loop` | 6 | 1 |
| `MOD-projections` | 19 | 5 |
| Summe | 35 | 12 |

RC-01, RC-03, RC-08, RC-12, RC-13 melden auf dem ganzen Modell keinen Befund; Punkt 1 und 6 sperren keine FUNC.

### Modelllücken, die eine Ableitung verhindern

| Lücke | FUNC |
|---|---|
| FLOW, dessen SCHEMA nur Konzept ist (`concept:true`, ohne `realRef`), z. B. `SCHEMA-query-params` an `FLOW-query-request-agent` | 16 |
| FUNC ohne REQ (Punkt 3, R-02) | 9 |
| REQ, deren TEST keine `testRefs` hat (Punkt 4) | 4 |
| FUNC-`realRef` außerhalb des MOD-Pfads (`packages/…`, `src/kernel/evaluation.ts`) | 6 |
| Erfolgsausgang und Fehlerfälle: kein Attribut in der Ontologie | nicht zählbar |

Eine FUNC kann mehrere Lücken haben; die Zeilen summieren sich nicht zu 23.

### Nachtrag 2026-11-19: Zählfehler JSDoc

Der Zähler oben zählte JSDoc-Kommentare als A, entgegen der Regel („reiner Kommentar zählt nicht“). Die Fixture enthielt kein JSDoc und fand den Fehler nicht; sie trägt jetzt einen JSDoc-Block. Regel, Schwelle und Module sind unverändert; die Tabelle oben bleibt als Lauf 1 stehen.

| MOD | Zeilen | F | V | A | Token F |
|---|---|---|---|---|---|
| `MOD-kernel-measure` | 593 | 21,9 % | 17,0 % | 61,0 % | 12,6 % |
| `MOD-loop` | 1388 | 10,7 % | 5,0 % | 84,3 % | 8,6 % |
| `MOD-projections` | 4139 | 13,4 % | 4,6 % | 82,1 % | 8,8 % |

Median F-Anteil: **13,4 %**. Kill F1 greift weiter. Rohdaten: `f1-zeilen-korrigiert.json`.

### Planspiel (kein Kriterium, nach dem Urteil)

Gleicher Zähler, korrigiert (`werkzeug/planspiel.mjs`, `werkzeug/a-zerlegen.mjs`):

| Annahme | measure | loop | projections | Median F |
|---|---|---|---|---|
| S0 gemessen | 21,9 % | 10,7 % | 13,4 % | 13,4 % |
| S1 alle Modelllücken geschlossen | 21,9 % | 10,7 % | 13,4 % | 13,4 % |
| S2 jede benannte Funktion oberster Ebene ist eine FUNC | 30,9 % | 16,8 % | 19,4 % | 19,4 % |
| S2 + Hülle der MCP-Tools (name, description, inputSchema) | 30,9 % | 18,0 % | 21,5 % | 21,5 % |

S1 ändert keine Zeile: Die Lücken entscheiden, ob eine FUNC ableitbar ist, nicht wie viele ihrer Zeilen Framework sind.

### F2

Nicht gelaufen. Kill F1 ist die Abbruchbedingung und erzwingt No-Go für die Frage nach dem eingesparten Code. Die Kontextfrage (F2) ist davon unabhängig und offen.

### Empfehlung

**No-Go** für einen CR „Framework aus dem Modell generieren“. Der Generator würde 10–16 % der Zeilen liefern; 69–85 % bleiben Algorithmus, den das LLM weiter schreibt.

## Entscheidungen

keine

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Werkzeuge und Läufe liegen in `graphanalyze` (`docs/spikes/SPIKE-GC-957-*`).
Relation-Kanten: `MOD-kernel-measure`, `MOD-loop`, `MOD-projections`.
