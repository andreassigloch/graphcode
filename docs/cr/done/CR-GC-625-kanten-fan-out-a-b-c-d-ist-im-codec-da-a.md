# CR-GC-625: Kanten-Fan-out A->B,C,D ist im Codec da, aber nirgends gezeigt — 43 Prozent der Kantenschreibungen im Rig-Lauf unnoetig einzeln

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-498 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-498.json (Lane: code)

---

## Befund

Format-E kann Kanten-Fan-out. `parseEdgeLine` spaltet die Zielseite auf Kommas und erzeugt je
Ziel eine Operation (`format-e-codec.js:347–370`, Kommentar „Handle 1:N targets"). Und
`serializeEdges` **schreibt** genau diese Form: Kanten ohne Attribute werden nach
`(sourceId, edgeType)` gruppiert und als eine Zeile mit `targets.join(', ')` ausgegeben
(`format-e-codec.js:439–465`).

**Die Hälfte wurde schon einmal repariert — die falsche.** CR-GC-268 („Format-E-Codec: Fan-out
erzeugen", done 2026-07-29) hat genau diese Gruppierung in den **Emit**-Zweig gebracht: 751
Kantenzeilen wurden 318, gemessen 4,3 % des Gesamtprompts. Sein eigener Abschlusssatz lautet
*„decode blieb unveraendert, der Parser beherrscht 1:n bereits"* — die Lesefähigkeit war der
Anlass, nicht das Ergebnis. Was nie folgte: es dem Autor zu sagen.

Der Autor erfährt das nirgends. Die drei Stellen, an denen er die Kantensyntax liest, zeigen
ausschließlich Einzelziele:

| Ort | Was dort steht |
|---|---|
| `src/surface/write.ts:89` (`formatE`-Parameter) | `"## Edges" + Zeilen der Form "+ A -verify-> B"` |
| `src/surface/bootstrap.ts:79–82` (Starttemplate) | drei Zeilen, drei Einzelkanten |
| `src/projections/authoring-example.ts:76–92` (`graph_authoring_guide`) | **gar kein Edges-Block** — der Musterblock endet nach den Nodes |

**Gemessen am Rig-Lauf `opus5-16`** (2026-09-22, 75 Turns, 24 `graph_mutate`-Aufrufe):

| | |
|---|---|
| Kantenschreibungen gesamt | **343** |
| davon als einzelnes `add-edge`-Kommando | 284 |
| davon als Format-E-Einzelzeile | 59 |
| distinkte `(source, edgeType)`-Gruppen | **194** |
| **einsparbare Zeilen/Kommandos** | **149 (43 %)** |

Fan-out genutzt: **0-mal**. Schlimmster Einzelfall Aufruf #20 — 54 Kanten in 11 Gruppen, größter
Fan-out 10: zehn `add-edge`-Objekte für das, was eine Zeile ist.

Und er konnte es auch nicht abschauen: im gesamten `claude-stream.jsonl` — Tool-**Ergebnisse**
eingeschlossen — kommt **keine einzige** Mehrziel-Zeile vor. Der Lauf hat nie eine Serialisierung
gelesen, in der die Gruppierung sichtbar gewesen wäre.

## Zielbild

Die Form steht dort, wo der Autor die Kantensyntax liest — in allen drei Fassungen dieselbe.

1. **`formatE`-Parameterbeschreibung** nennt die Zielliste: `+ A -verify-> B, C, D` schreibt drei
   Kanten. Ein Satz, kein Absatz.
2. **`formatEExampleFor` bekommt seinen Edges-Block** — mit einer Fan-out-Zeile, und zwar über
   ein **echtes** `TRACE_PATTERN` des angefragten Typs, nicht über ein erfundenes. Die Muster
   liegen in `report.ts` bereits als `outgoing` vor und werden hineingereicht; ein Typ ohne
   ausgehendes Muster behält den heutigen Block ohne Edges.

   Warum hier und nicht nur in der Parameterbeschreibung: seit CR-GC-622 gibt der Leitfaden beim
   **zweiten** Aufruf nur noch die Kantengrammatik zurück. Was die Form angeht, hat der Autor
   also genau einen Schuss — der Musterblock des **ersten** Aufrufs.
3. **Bootstrap-Template** zeigt die Gruppierung an seinen zwei Kanten mit gleicher Quelle, statt
   sie auseinanderzuschreiben.
4. **Die Einschränkung wird mitgesagt, nicht verschwiegen:** eine Fan-out-Zeile trägt **einen**
   Inline-Attributblock für alle ihre Ziele (`parseEdgeLine` hängt `inlineAttrs` an jede erzeugte
   Operation). Kanten mit eigenem `cardinality`/`constraint`/`notes` bleiben einzeln — dieselbe
   Invariante, die `serializeEdges` schon fährt.

**Nicht in diesem CR:** dass 19 von 24 Aufrufen über `commands` statt `formatE` gingen, obwohl die
Werkzeugbeschreibung `formatE` mit „~2–3× fewer tokens" empfiehlt. Das ist eine andere Ursache
(Modus-Wahl, nicht Kantensyntax) und steht als eigenes Item.

## Akzeptanzkriterien

- [x] `graph_authoring_guide({type})` liefert für jeden Typ mit ausgehendem Muster einen
      `## Edges`-Block, dessen Fan-out-Zeile ein echtes `TRACE_PATTERN` dieses Typs benutzt
      (11 von 12 Typen; SCHEMA hat keins und behält den Block ohne Kanten)
- [x] Der zurückgegebene Musterblock decodiert durch `GraphCodeCodec.decode()` und ergibt aus der
      **einen** Fan-out-Zeile **mehrere** `add_edge`-Operationen mit gleichem `sourceId` und
      gleichem `edgeType` (Erweiterung von `tests/mutate.formate-name.test.ts` — derselbe Vertrag
      „ein Beispiel, das der Codec nicht frisst, ist schlimmer als keins")
- [x] Positivkontrolle im Testkommentar benannt: nimmt man die Fan-out-Zeile zurück auf
      Einzelziele, wird der Test rot
- [x] Die `formatE`-Parameterbeschreibung nennt die Zielliste **und** dass ein Inline-Attributblock
      für alle Ziele der Zeile gilt
- [x] Das Bootstrap-Template decodiert weiter fehlerfrei und zeigt die Gruppierung an
      `SYS-template -compose-> REQ-template-root, MOD-template`
- [x] Testsuite grün (168 Dateien; rot bleiben nur `lockfile-sync` und `distribution` —
      vorbestehend seit dem Peer-Floor-Bump von CR-GC-616, unabhängig von diesem CR)

## Umfang

`src/surface/write.ts`, `src/surface/bootstrap.ts`, `src/projections/authoring-example.ts`,
`src/projections/report.ts`, `tests/mutate.formate-name.test.ts` — 5 Dateien.

## Nachtrag aus der Umsetzung

Zwei Dinge, die der Entwurf nicht wissen konnte:

1. **Die Zielknoten müssen mitdeklariert werden.** Ohne `### <TYPE>`-Sektion kann der Codec den Typ
   eines Kantenziels nicht auflösen — `decode` wirft *„Cannot resolve type of target"*. Der
   Musterblock trägt deshalb die zwei Zielknoten; der Test prüft, dass genau **ein** Anker
   herauskommt und der Rest seine Kantenziele sind.
2. **Die `kinds` des Ziels hängen an der Kante.** Erfüllt ein MOD oder SYS, verlangt contracts 9.x
   ein *strukturelles* `kinds` am REQ (`where`-Prädikat am satisfy-Muster). Ein Beispiel mit
   `functional` wäre dort am Gate illegal gewesen — dieselbe Klausel, die das Bootstrap-Template
   seit CR-SM-266 trägt.
