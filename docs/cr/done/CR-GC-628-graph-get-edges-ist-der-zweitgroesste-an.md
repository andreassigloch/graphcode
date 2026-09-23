# CR-GC-628: graph_get_edges ist der zweitgroesste Antwortgeber, und sein sparsamer Modus ist heute die teurere Falle

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-502 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-502.json (Lane: code)

---

## Befund

Gemessen am Lauf `opus5-16`: `graph_get_edges` 9 Aufrufe / 40.599 Zeichen (4.511 je Aufruf) —
nach `graph_elements` der größte Posten, und von CR-GC-613/621/624 nicht angefasst. Alle neun
Aufrufe nahmen den JSON-Default.

Nachgerechnet am Graphen desselben Laufs, deterministisch:

| `compose`, 133 Kanten in 30 Gruppen | Zeichen |
|---|---:|
| JSON (Default) | 14.608 |
| `format:'formatE'` — heutiger Stand | **36.018** |
| nur der gruppierte Kantenblock | **4.375** |

Bei `relation` (213 Kanten): 20.590 · 68.918 · 6.520.

**Der sparsame Modus ist der teuerste.** `format:'formatE'` serialisiert die **Endpunkt-Knoten mit
voller Prosa** dazu — wer nach Kanten fragt, bekommt die Beschreibungen beider Enden geschenkt.
Dabei hätte dieser Modus schon die Antwort: `serializeEdges` gruppiert seit CR-GC-268 nach
`(sourceId, edgeType)` und schreibt `A -verify-> B, C`. Geprüft gegen den Codec: drei Kanten
werden zwei Zeilen, und die mit eigenem `cardinality` bleibt einzeln.

**Gemeinsame Wurzel mit CR-GC-627** (dort benannt, hier nicht gelöst): Format-E wird als
Graph-Projektion benutzt statt als das, was es ist. Schreibseitig wirft die Graph-Rekonstruktion
die Nicht-Add-Ops weg; leseseitig zwingt sie Knoten samt Prosa in eine Antwort, die nur nach
Kanten gefragt hat. Zwei Seiten, zwei Blast-Radien, zwei CRs.

## Zielbild

Die Kantenantwort trägt Kanten. Die Endpunkt-Knoten kommen als **Identität**, nicht als Prosa —
dieselbe `nurIdentitaet`-Kürzung und dieselbe Legende wie `graph_elements` seit CR-GC-621, kein
dritter Kürzungsweg.

Damit ist `format:'formatE'` der kleinste Modus statt des größten, und die Gruppierung wirkt.
Erwartung aus der Messung oben: unter dem JSON-Default, nicht das Zweieinhalbfache.

Der JSON-Default bleibt, was er ist — programmatische Agent-Logik braucht Objekte. Er lernt nur
denselben Prosa-Schnitt.

## Akzeptanzkriterien

- [ ] `graph_get_edges({edgeType:'compose', format:'formatE'})` am Golden kleiner als dieselbe
      Anfrage als JSON (heute 2,5× größer)
- [ ] Die Gruppierung ist in der Antwort sichtbar: mindestens eine Mehrziel-Zeile, nachgewiesen
      durch Decode zu mehreren Kanten gleicher Quelle und Kantenart
- [ ] Eine Kante mit eigenen Attributen bleibt eine eigene Zeile
- [ ] Die Legende steht einmal je Antwort (CR-GC-613-Marke, kein neues Zeichen)
- [ ] `total` und die Kantenmenge bleiben unverändert — gekürzt wird Text, nicht Umfang
- [ ] Testsuite grün

## Umfang

`src/surface/read.ts`, `tests/read-tools.scope.test.ts`, `tests/mcp.read-format.test.ts` — 3 Dateien.
