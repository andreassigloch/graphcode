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

_(nach dem Lauf)_

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

Spike: Werkzeug und Läufe in graphanalyze (`docs/spikes/SPIKE-GC-1024/`). Relation-Kanten nach dem Lauf.
