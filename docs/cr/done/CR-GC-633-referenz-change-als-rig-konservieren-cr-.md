# CR-GC-633: Referenz-Change als Rig konservieren

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-517 (idea)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-517.json (Lane: code)

---

## Befund

Die drei Rigs im Repo messen, was ein Agent HERVORBRINGT — ein Systemmodell (greenfield),
ein Stueck Code (code-test), eine Spezifikation (sigllm). Keines misst, **wie** er dabei
arbeitet. Genau darueber macht dieses Repo aber seine zentrale Zusage: die Tabelle
„Ask the graph, don't grep for it" in der `CLAUDE.md`, belegt mit der Messung vom 2026-08-27
(„0 Aufrufe `graph_impact`, 174 Suchoperationen").

CR-GC-630/631/632 ist dafuer eine gute Sonde: klein genug fuer eine Sitzung, und er stellt
nacheinander vier Fragen, die exakt in dieser Tabelle stehen — mit nachpruefbaren Antworten.

## Zielbild

`rig/referenz-change/` konserviert den Change als Aufgabe und liefert zwei Messungen:

- `messen.mjs` liest ein Sitzungsprotokoll und rechnet Graph-gegen-grep, Volllaeufe und
  selektive Laeufe aus.
- `gegenprobe.mjs` sagt, was der Graph geantwortet HAETTE — gegen den Schnappschuss **vor**
  dem Change, damit die Antwort die von damals ist und nicht die von heute.

## Umfang

`rig/referenz-change/`: `README.md`, `aufgabe.md`, `golden/endzustand.md`, `messen.mjs`,
`gegenprobe.mjs`. Fuenf Dateien, kein Eingriff in `src/`.

## Ergebnis (2026-09-23) — die Grundlinie ist der eigene Lauf, und er ist schlecht

Gemessen ab der Nutzernachricht „keine parallel pfade":

| Kennzahl | Wert |
|---|---|
| Werkzeugaufrufe | 151, davon 146 Bash |
| Graph-**Lese**aufrufe | **0** |
| Suchoperationen | **54** |
| Volllaeufe `npm test` | **7** (~35 min Wanduhr) |

Gegenprobe, beide aus den Routinen hinter den Werkzeugen:

- `graph_tests` haette **4 Testdateien statt 172** genannt (`selectForChange` gegen den
  Schnappschuss `d1285ef`).
- `graph_impact` haette **20 Kanten an zwei Knoten** gezeigt — darunter die zwei `satisfy`
  und die zwei `realRef`, die nach dem Loeschzug als RC-01 hochkamen. Gefunden wurden sie
  stattdessen von der Testsuite, 300 Sekunden spaeter.

Das Rig hat damit eine ehrliche Grundlinie: nicht „so geht es", sondern „so ging es, und das
hat es gekostet".
