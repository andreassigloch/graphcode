# Referenz-Change — eine konservierte Aufgabe, an der sich graphcode messen laesst

Die Rigs nebenan messen, was ein Agent **hervorbringt** (ein Systemmodell, ein Stueck Code).
Dieses hier misst, **wie** er dabei arbeitet: ob er den Graphen fragt oder das Dateisystem
durchsucht — die eine Zusage, die dieses Repo ueber sich macht.

## Der Change

`CR-GC-630` + `CR-GC-631` + `CR-GC-632`, Commits `d1285ef^..HEAD`. Zwei parallele Pfade fielen:
der Kaltstart bekam denselben Schreibweg wie `graph_mutate`, und `GraphCodeCodec` — ein Wrapper
um genau die `FormatECodec`-Instanz, die im selben Kontext schon stand — wurde geloescht.

- `rig/referenz-change/aufgabe.md` — was ein Agent bekommt. **Die Loesung steht nicht darin.**
- `rig/referenz-change/golden/endzustand.md` — woran „fertig" nachpruefbar ist.
- `messen.mjs` — liest ein Sitzungsprotokoll und rechnet die Kennzahlen aus.
- `gegenprobe.mjs` — was der Graph geantwortet HAETTE, gegen den Stand vor dem Change.

## Warum gerade dieser Change

Er stellt vier Fragen, die in der Werkzeugtabelle der `CLAUDE.md` stehen, und jede hat eine
nachpruefbare Antwort (siehe `aufgabe.md`). Er ist klein genug fuer eine Sitzung und teuer genug,
dass die Abkuerzung weh tut: wer nicht fragt, faehrt die volle Suite, und die dauert 5 Minuten.

## Aufruf

```bash
node rig/referenz-change/messen.mjs <sitzung>.jsonl --ab "<Startsatz>" --bis "<Endsatz>"
node rig/referenz-change/gegenprobe.mjs d1285ef src/projections/codec.ts
```

`--ab` / `--bis` schneiden die Messung auf die Nutzernachrichten zu, zwischen denen der Change
lag — eine Sitzung traegt meist mehr als einen.

## Grundlinie: der Lauf, aus dem dieses Rig entstanden ist

Claude Opus 5, 2026-09-23, Sitzung `82b7759d`, Fenster „keine parallel pfade" → „referenz change"
(= CR-GC-630 + CR-GC-631, der Auftrag aus `aufgabe.md`):

| Kennzahl | Wert |
|---|---|
| Werkzeugaufrufe | 131 — davon **126 Bash** |
| Graph-**Lese**aufrufe | **0** |
| Graph-Schreibaufrufe | 3 (ein Modell-Batch, zweimal `dryRun`) |
| Suchoperationen (grep/find) | **45** |
| Volllaeufe `npm test` | **3** (~15 Minuten Wanduhr) |
| selektive Laeufe | 10 |

**Das ist kein guter Lauf, sondern der Anlass.** Er wiederholt exakt das Muster, das die
`CLAUDE.md` seit dem 2026-08-27 als Fehlerbild fuehrt („0 Aufrufe `graph_impact`, 174
Suchoperationen") — diesmal 0 zu 54. Was das gekostet hat, sagt die Gegenprobe:

| Frage | gegriffen | was der Graph geantwortet haette |
|---|---|---|
| Welche Tests muss ich fahren? | 3× volle Suite | **4 Dateien** statt 172 (`selectForChange`, dieselbe Routine hinter `graph_tests`) |
| Was bricht, wenn `codec.ts` faellt? | zwei Volllaeufe, bis `RC-01` es meldete | **20 Kanten an zwei Knoten**, darunter die zwei `satisfy` und die zwei `realRef`, die genau den Fehlschlag ausgeloest haben |

Die zweite Zeile ist die teure: dass `FUNC-encode` eine REQ erfuellt und `FUNC-decode` an der
geloeschten Datei haengt, stand die ganze Zeit im Graphen. Gefunden wurde es 300 Sekunden spaeter
von der Testsuite.

## Was ein besserer Lauf zeigen muesste

Kein Zielwert als Quote — die ehrliche Messlatte ist, ob die **vier Fragen aus `aufgabe.md`** am
Graphen gestellt wurden, bevor sie am Dateisystem gestellt wurden. Ein Lauf mit einem Volllauf
statt sieben und einem `graph_impact` vor dem Loeschzug ist besser, auch wenn er mehr greppt.
