# CR-GC-1026: Typbindung je FUNC gegen Anfrage- und Antwort-SCHEMA als Prüfung, Richtung aus der Wirkkette, Altlast als Ratsche

**Typ:** Spike, dann Bau; aus Item ITEM-2026-1660 (idea)
**Erstellt:** 2026-11-24
**Item:** bok/items/ITEM-2026-1660.json (Lane: graph)
**Vorgänger:** CR-GC-1024 (Entscheidung: generiert wird eine Prüfung, kein Framework)

---

## Frage

Kann der Generator aus CR-GC-1024 jede der 88 Blatt-FUNC mit TypeScript-`realRef` einer von drei Klassen zuordnen: **grün**, **Drift** oder **nicht prüfbar mit Grund**, ohne Artefakte des Generators? Erst wenn ja, wird die Prüfung mit Altlast-Liste in die CI gebaut (Entscheidung des Autors 2026-11-24: erst den Generator nachschärfen).

Lauf 3 (graphanalyze `docs/spikes/SPIKE-GC-1024/lauf3/`) ergab 3 grün, 42 rot, 43 nicht ableitbar. Drei Fälle am Code zeigten Artefakte unter den roten: MCP-Werkzeuge sind Objekte, keine exportierten Funktionen; async-Funktionen geben `Promise<T>` zurück.

## Generatorregeln Lauf 4 (fest vor der ersten Zahl)

1. Nur `io`-FLOW mit `sync`.
2. **Richtung je FLOW aus der Wirkkette** (Variante 2d): je FCHAIN Auslöser aus `chainRoles`, Aktivierungsnetz aus den sync-Links plus Gegenkante beim Holen (Erzeuger ohne Eingang, wie `chainRoles`), Breitensuche. Je FLOW zwischen f und Partner p: Liegt p näher am Auslöser, gehört der FLOW zur Signatur von f; liegt f näher, ist er ein Aufruf von f. Alle Ketten müssen einig sein. FLOW von oder an einen ACTOR gehören zur Signatur.
3. Parameter: je IN-FLOW der Signatur einer, gleiches SCHEMA = ein Parameter, Reihenfolge nach uid des FLOW.
4. Rückgabe: Vereinigung der SCHEMA der OUT-FLOW der Signatur, sonst `void`. **Neu:** verglichen wird mit `R | Promise<R>`.
5. Typ eines SCHEMA: `z.infer<typeof <symbol>>`; Import über den Pfad, `packages/contracts/src/<x>/…` als `@sigloch/contracts/<x>`, sonst `packages/<name>/src/…` als `@sigloch/<name>`.
6. **Neu:** Ist das Symbol in seiner Datei nicht exportiert, wird nicht gebunden. Die FUNC ist „nicht prüfbar: nicht exportiert“. Steht in der Datei `<symbol>: MCPTool<`, lautet der Grund „MCP-Werkzeug, `MCPTool<…>` bindet den Typ“.

**Klassen „nicht prüfbar“ (feste Liste):** Richtung offen (FLOW ohne gemeinsame Kette oder Ketten uneinig), SCHEMA ohne `realRef`, nicht exportiert, MCP-Werkzeug.

## Kontrolle (fest)

Fixture `werkzeug/fixture/graph-kette.json` in drei Varianten (grün, Rückgabe-Mutation rot, Parameter-Mutation rot) wie in CR-GC-1024. Dazu zwei neue Varianten:
- **async:** `f` gibt `Promise<Aus>` zurück → grün; gibt `Promise<{ offen: string }>` zurück → rot.
- **nicht exportiert:** `f` nicht exportiert → „nicht prüfbar: nicht exportiert“, keine Bindungsdatei.

## Messung

- **M1 Aufteilung** der 88 FUNC in grün, rot, nicht prüfbar je Grund.
- **M2 Genauigkeit der roten:** Stichprobe aus der alphabetisch sortierten Liste der roten FUNC: jede dritte ab der ersten, höchstens 15. Je FUNC von Hand am Code: **Drift** (die Signatur trägt nach Auspacken von `Promise` einen Parameter oder eine Rückgabe, die das gebundene SCHEMA nicht beschreibt, oder umgekehrt; die Richtung stimmt mit den Aufrufkanten des Codes überein, wo diese entscheiden) oder **Artefakt** (der Generator nahm einen falschen FLOW, einen falschen Import oder baute den Typ falsch). Nach CR-GC-1024 gilt: Das SCHEMA am Anfrage-FLOW ist der ganze Aufrufvertrag. Ein Parameter außerhalb davon ist Drift, keine Lücke des Generators.
- **M3 Richtung gegen Code:** je FLOW der Signatur, für den die Aufrufkanten des Codes entscheiden: Anteil, bei dem die Kette dieselbe Richtung nennt.

## Kriterien (fest vor der ersten Zahl)

| | Kriterium |
|---|---|
| **Kontrolle** | alle fünf Fixture-Varianten wie erwartet; sonst keine Wertung |
| **Muss 1** | M2: höchstens 1 Artefakt in der Stichprobe |
| **Muss 2** | M1: jede nicht prüfbare FUNC hat einen Grund aus der festen Liste |
| **Muss 3** | M3: ≥ 95 % gleiche Richtung |
| **Kill** | M2: mehr als 3 Artefakte in der Stichprobe |
| **Soll** | M1: höchstens 30 von 88 nicht prüfbar |

Go = Kontrolle, Muss 1 bis 3, kein Kill. Dann baut dieser CR die Prüfung in graphcode: Generator in `src/`, erzeugte Bindungsdatei unter `tests/`, geprüft von `npm run type-check` in der CI, rote FUNC aus einer Altlast-Liste mit `@ts-expect-error`, sodass eine behobene FUNC die Liste verlassen muss. Den Bauteil schneidet ein eigener Abschnitt nach dem Urteil, mit höchstens 10 Dateien. Bei Kill: Ergebnis sind die Artefaktklassen, keine Prüfung.

## Ergebnis

**Lauf 4, 2026-11-24**, Modell beim Commit in `lauf4/commit.txt`, Werkzeug und Rohdaten: graphanalyze `docs/spikes/SPIKE-GC-1024/` (`werkzeug/kopf.mjs`, `werkzeug/richtung-aus-kette.mjs`, `lauf4/`).

### Kontrolle

Alle sechs Fixture-Varianten wie erwartet: grün, Rückgabe rot, Parameter rot, async grün, async rot, nicht exportiert ohne Bindung. **Bestanden.**

### M1 Aufteilung (88 FUNC)

| Klasse | FUNC |
|---|---|
| grün | 4 |
| rot | 29 |
| nicht prüfbar: Richtung offen | 43 |
| nicht prüfbar: MCP-Werkzeug | 10 |
| nicht prüfbar: nicht exportiert | 2 |

### M2 Stichprobe der roten (jede dritte von 29, also 10)

| FUNC | Urteil | Grund |
|---|---|---|
| `FUNC-audit-trail` | Drift | Die FUNC holt laut Modell selbst; `projectAuditEntries(entries, opts?)` bekommt die Einträge übergeben |
| `FUNC-compute-steering-delta` | Drift | Das SCHEMA beschreibt einen Snapshot, der Code nimmt `(before, after)` |
| `FUNC-eingaenge-nur-aus` | Drift | `(graph, elementId, erlaubt)` außerhalb des Vertrags |
| `FUNC-export-markdown` | Drift | `(graph, view, name?)` statt `MarkdownView` |
| `FUNC-function-criticality` | Drift | Liste statt Einzelwert |
| `FUNC-gve-supervise` | **Artefakt** | Regel 3 macht aus zwei Operationen (anhängen, stoppen) zwei Parameter |
| `FUNC-lauf-urteil` | Drift | Funktionsparameter `relativ` außerhalb des Vertrags |
| `FUNC-merge-nodes` | Drift | `(harness, entries, opts)` statt `AuditRecord` |
| `FUNC-schema-guard` | Drift | Die Anfrage trägt das Antwort-SCHEMA |
| `FUNC-vorschlag` | **Artefakt** | Die Kette nennt `FUNC-generation-step` als Aufrufer; im Code ruft `vorschlagNachAnwendung` selbst `generationStep` |

**2 Artefakte. Muss 1 (höchstens 1) ist nicht erfüllt.** Kill (mehr als 3) greift nicht.

### M3 Richtung gegen Code

Von 126 FLOW in Signaturen und eigenen Aufrufen der ableitbaren FUNC entscheidet der Code bei 79: 76 gleich, 3 anders, **96,2 %**. Muss 3 erfüllt. Die 3 Abweichungen: `FUNC-host-proxy` (`FLOW-proxy-build`), `FUNC-vorschlag` (`FLOW-generation-step-vorschlag`, `FLOW-target-profile`).

### Urteil

| | Ergebnis |
|---|---|
| Kontrolle | bestanden |
| Muss 1 | **nicht erfüllt** (2 Artefakte) |
| Muss 2 | erfüllt (jede nicht prüfbare FUNC hat einen Grund aus der Liste) |
| Muss 3 | erfüllt (96,2 %) |
| Kill | greift nicht |
| Soll | **nicht erfüllt** (55 von 88 nicht prüfbar) |

**Kein Go, kein Kill.** Die Prüfung wird in diesem Stand nicht gebaut.

**Artefaktklassen:**
1. Eine FUNC mit mehreren Operationen (verschiedene Anfrage-FLOW mit verschiedenem SCHEMA, eine `realRef`). Regel 3 macht daraus Parameter einer Signatur.
2. Die Richtung aus der Kette widerspricht dem Code (3 von 79 FLOW). Wo der Code entscheidet, wäre seine Richtung die sichere Quelle.

**Offen ist vor allem die Richtung:** 43 FUNC haben einen FLOW, dessen Partner in keiner gemeinsamen Kette liegt oder dessen Ketten sich widersprechen.

## Lauf 5: Prüfsatz (fest vor der ersten Zahl, Freigabe des Autors 2026-11-24)

**Geänderte Regeln** (alle anderen wie Lauf 4):

- **Regel 2:** Richtung je FLOW zwischen f und Partner p. Ruft im Code genau eine Seite die andere (Aufrufkanten aus `extractCallFacts`, Zuordnung wie RC-12, Weg ≤ 3 Kanten), gilt diese Richtung. Sonst gilt die Richtung aus der Kette wie in Lauf 4. Sonst ist sie offen.
- **Regel 3a (neu):** Tragen die IN-FLOW der Signatur mehr als ein SCHEMA, ist die FUNC „nicht prüfbar: mehrere Operationen“. Das ist zugleich ein Befund ans Modell.

**Klassen „nicht prüfbar“:** Richtung offen, SCHEMA ohne `realRef`, nicht exportiert, MCP-Werkzeug, mehrere Operationen.

**Kontrolle:** die sechs Varianten aus Lauf 4, dazu zwei neue:
- **Code vor Kette:** Fixture, deren Kette den Auslöser an `FUNC-helfer` setzt, also die Richtung umdreht. Die Aufrufkanten nennen die echte Richtung. Erwartet: dieselbe Signatur wie die grüne Variante, grün.
- **mehrere Operationen:** `FUNC-f` bekommt einen zweiten Anfrage-FLOW von einem Akteur mit anderem SCHEMA. Erwartet: „nicht prüfbar: mehrere Operationen“.

**Messung:** M1 und M2 wie in Lauf 4, neue Stichprobe aus der roten Liste von Lauf 5 (jede dritte, alphabetisch, höchstens 15), dieselbe Definition von Drift und Artefakt. M3 entfällt als Kriterium, weil der Code dort entscheidet, wo er kann. Berichtet wird, bei wie vielen FLOW der Code entschied, bei wie vielen die Kette und bei wie vielen niemand.

**Kriterien:**

| | Kriterium |
|---|---|
| **Kontrolle** | alle acht Varianten wie erwartet |
| **Muss 1** | M2: höchstens 1 Artefakt in der Stichprobe |
| **Muss 2** | M1: jede nicht prüfbare FUNC hat einen Grund aus der Liste |
| **Kill** | M2: mehr als 3 Artefakte |
| **Soll** | M1: höchstens 30 von 88 nicht prüfbar |

Go = Kontrolle, Muss 1 und 2, kein Kill. Dann folgt der Bau wie oben beschrieben.

## Lauf 5: Ergebnis

Modell und Aufrufkanten wie Lauf 4 (`lauf5/`, kopiert aus `lauf4/`). Werkzeug: `kopf.mjs` Modus `mix:`.

### Kontrolle

Alle acht Varianten wie erwartet. Die Variante „Code vor Kette“: Die Kette allein dreht alle vier Richtungen um, mit den Aufrufkanten entsteht dieselbe Signatur wie bei der grünen Variante, grün. „mehrere Operationen“: keine Bindung, Grund `SCHEMA-ein`, `SCHEMA-stopp`. **Bestanden.**

### M1 Aufteilung (88 FUNC)

| Klasse | Lauf 4 | Lauf 5 |
|---|---|---|
| grün | 4 | 6 |
| rot | 29 | 42 |
| nicht prüfbar: Richtung offen | 43 | 16 |
| nicht prüfbar: mehrere Operationen | – | 10 |
| nicht prüfbar: MCP-Werkzeug | 10 | 10 |
| nicht prüfbar: nicht exportiert | 2 | 4 |

Quelle der Richtung je FLOW und Partner: Code 348, Kette 134, offen 21.

### M2 Stichprobe (jede dritte von 42, also 14)

| FUNC | Urteil | Grund |
|---|---|---|
| `FUNC-apply-reseed` | Drift | Vertrag `ontology-json`, Code `(target, relPath)` |
| `FUNC-code-urteil` | Drift | `graph` außerhalb des Vertrags |
| `FUNC-decode` | Drift | `bestand` außerhalb des Vertrags; Rückgabe ein Objekt statt eines Befehls |
| `FUNC-emit-trajectory` | Drift | `(log, outDir)` statt `AuditRecord` |
| `FUNC-export-marker` | Drift | `(repoRoot)` statt `ExportPending` |
| `FUNC-function-criticality` | Drift | Liste statt Einzelwert |
| `FUNC-harness-cli` | Drift | `(action, opts)` statt `CliCommand` |
| `FUNC-init-verb` | Drift | `(opts, deps?)` statt `CliCommand` |
| `FUNC-measure-test-schlupf` | Drift | Positionsargumente; die Anfrage trägt das Antwort-SCHEMA |
| `FUNC-plan-code-lane` | Drift | Positionsargumente; die Anfrage trägt das Antwort-SCHEMA |
| `FUNC-schema-guard` | Drift | Die Anfrage trägt das Antwort-SCHEMA |
| `FUNC-serve-sse` | **Artefakt** | Regel 2 rechnet den FLOW an einen Akteur (`health-report`, über HTTP) als Rückgabe von `serveHost` |
| `FUNC-stand-verlauf` | Drift | `VerlaufEingabe` verlangt zusätzlich `git` und `cache` |
| `FUNC-vertragstest-verb` | Drift | `(opt)` statt `CliCommand` |

**1 Artefakt.**

### Urteil

| | Ergebnis |
|---|---|
| Kontrolle | bestanden |
| Muss 1 | erfüllt (1 Artefakt) |
| Muss 2 | erfüllt |
| Kill | greift nicht |
| Soll | nicht erfüllt (40 von 88 nicht prüfbar) |

**Go** für den Bau. Bekannte Grenze: Ein FLOW an einen Akteur gilt als Rückgabe; bei einem Server, der über HTTP antwortet, ist das falsch (Artefaktklasse aus M2).

## Bau

### Abhängigkeit von contracts (CR-SM-459)

Die Richtung aus dem Code braucht die Zuordnung „Aufrufstelle → FUNC“ aus contracts. Sie war nicht exportiert; der Spike hatte sie kopiert. Nach FAQ `zuordnung-nicht-nachbauen` kommt sie aus contracts (Entscheidung des Autors 2026-11-24, umgesetzt von Smeagol in sigloch-modules): `funcCalls(graph, facts)` (Bedeutung von RC-13: direkter Aufruf, innerster Anker) und `ChainRoles.depth` (Abstand vom Auslöser im Aktivierungsnetz von `chainRoles`). contracts 12.18.0, nicht veröffentlicht. graphcode baut im Link-Modus dagegen; der Floor steht auf `^12.18.0`. Bis zum Publish sind `lockfile-sync` und `distribution` rot (FAQ `peer-floor-wann`).

### Lauf 6 mit dem Produkt (kein neues Kriterium)

Der Spike nutzte die Bedeutung von RC-12 und ein nachgebautes Aktivierungsnetz. Nachgemessen mit dem Verb (`graphcode typbindung`, 3,3 s) am selben Modell:

| | Lauf 5 | Lauf 6 |
|---|---|---|
| gebunden, grün | 6 | 6 |
| gebunden, rot | 42 | 41 |
| nicht prüfbar | 40 | 41 |

Die roten FUNC von Lauf 6 sind die von Lauf 5 ohne `FUNC-import` (jetzt „Richtung offen: FLOW-imported-graph“). Die 14 Signaturen der Stichprobe sind identisch; das Urteil von M2 (1 Artefakt) gilt weiter. Grün: `FUNC-arch-fitness`, `FUNC-chain-metrics`, `FUNC-collect-status`, `FUNC-cr-groups`, `FUNC-generation-step`, `FUNC-select-tests`.

### Schnitt

Der Floor gehört in denselben Commit wie der Import (FAQ `peer-floor-wann`). Damit hätte der Bau 12 Dateien. Er teilt sich an einer Stelle, an der beide Teile grün bleiben:

- **Teil 1 (dieser CR):** `src/projections/typbindung.ts` (Generator), `src/surface/typbindung-verb.ts` (Verb, Richtung Code vor Kette), `src/cli.ts`, `src/surface/cli-args.ts` (Verb `typbindung`), `tests/typbindung.test.ts` (8 Tests), `tests/rc04.surface-erzeuger-parst.test.ts` (12 Verben), `tests/vertrag/SCHEMA-cli-command.vertrag.test.ts` (neu erzeugt), `package.json`, `package-lock.json`, diese Datei. 10 Dateien.
- **Teil 2 (Folge-CR):** `tests/typbindung/bindungen.ts` (erzeugt), `tests/typbindung/altlast.json` (41 FUNC), Test auf Gleichstand der committeten mit der neu erzeugten Datei, README, Modellknoten.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

Spike: Werkzeug und Läufe in graphanalyze (`docs/spikes/SPIKE-GC-1024/`). Relation-Kanten nach dem Lauf.
