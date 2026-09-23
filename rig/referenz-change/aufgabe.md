# Referenz-Change — die Aufgabe, wie sie gestellt wurde

Diese Datei ist der EINGANG des Rigs: das, was ein Agent bekommt. Die Loesung steht in
`golden/endzustand.md` und darf ihm nicht vorliegen.

---

## Kontext, den der Agent hat

Das Repo ist `graphcode`. Seine `CLAUDE.md` traegt die Tabelle „Ask the graph, don't grep for it"
und die Regel „Keine parallelen Pfade". Der Graph ist befuellt (883 Knoten, 2.169 Kanten) und
bindet den Code ueber `realRef`.

## Der Auftrag

> Es gibt zwei Wege, aus Format-E-Text Mutationen zu machen: `graph_mutate` faehrt seit CR-GC-627
> `formatEToCommands`, `bootstrap()` faehrt weiter `GraphCodeCodec.decode()` und bildet den
> rekonstruierten Graphen auf `add-node`/`add-edge` ab. Und `GraphCodeCodec` selbst ist ein
> Wrapper um genau die `FormatECodec`-Instanz, die im selben Kontext schon steht.
>
> Keine parallelen Pfade. `GraphCodeCodec` komplett entfernen.

## Was „fertig" heisst

Die Hausregeln des Repos gelten unveraendert: Item vor CR, CR-Text in `docs/cr/`, rot-zuerst,
VOLL-Spur als Riegel vor dem Schliessen, und **das Modell muss mitkommen** — `RC-*` sagt
kongruent, oder die Abweichung ist im CR benannt.

## Warum dieser Change eine gute Sonde ist

Er stellt genau die Fragen, fuer die die Werkzeugtabelle da ist, und jede davon hat eine
nachpruefbare Antwort:

| Frage im Verlauf | Werkzeug laut Tabelle | Falle, wenn gegreppt wird |
|---|---|---|
| Wer benutzt `GraphCodeCodec`? | `graph_impact` | grep findet die Importe, nicht die MODELL-Knoten, die an der Datei haengen |
| Was bricht, wenn `codec.ts` faellt? | `graph_impact` | `FUNC-encode` traegt `satisfy`, `io`, `compose` — RC-01 faellt erst in der VOLL-Spur auf |
| Welche Tests muss ich fahren? | `graph_tests` | sonst faehrt man die volle Suite, mehrfach, je ~5 Minuten |
| Wo ist das im Code realisiert? | `realRef` aus `graph_context` | grep findet die Datei, nicht die Bindung, die mitwandern muss |

Der Change ist klein genug fuer eine Sitzung und gross genug, dass die Abkuerzung weh tut.
