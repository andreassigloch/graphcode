# CR-GC-628: graph_get_edges ist der zweitgroesste Antwortgeber, und sein sparsamer Modus ist heute die teurere Falle

**Status:** ✅ Done  
**Abgeschlossen:** 2026-09-23
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

- [x] `graph_get_edges({edgeType:'compose', format:'formatE'})` am Golden kleiner als dieselbe
      Anfrage als JSON (heute 2,5× größer)
- [x] Die Gruppierung ist in der Antwort sichtbar: mindestens eine Mehrziel-Zeile, nachgewiesen
      durch Decode zu mehreren Kanten gleicher Quelle und Kantenart
- [x] Eine Kante mit eigenen Attributen bleibt eine eigene Zeile
- [x] Die Legende steht einmal je Antwort (CR-GC-613-Marke, kein neues Zeichen)
- [x] `total` und die Kantenmenge bleiben unverändert — gekürzt wird Text, nicht Umfang
- [x] Testsuite grün

## Umfang

`src/surface/read.ts`, `tests/read-tools.scope.test.ts`, `tests/mcp.read-format.test.ts` — 3 Dateien.

---

## Umsetzung (2026-09-23)

Die Endpunkt-Knoten kommen als Identität (`endpunktIdentitaet` in `read.ts`), und die Antwort geht
über die Agenten-Sicht (`omitProvenance`) statt über den Rundlauf.

**Der Entwurf sagte „dieselbe `nurIdentitaet`-Kürzung" — das allein reicht nicht.** Am Golden
nachgemessen, `compose` (144 Kanten / 122 Knoten):

| | Zeichen |
|---|---:|
| JSON-Default | 18.001 |
| formatE vorher | 49.431 |
| nur `nurIdentitaet` (Beschreibungen) | 29.072 |
| Identität (ohne Attribute, Agenten-Sicht) | **10.746** |

Mit nur geschnittenen Beschreibungen läge `formatE` weiter ÜBER dem JSON-Default, und das
Akzeptanzkriterium wäre verfehlt. Die Attribute mussten mit: auf eine Kantenfrage ist der
Endpunkt ein Referent, kein Gegenstand — dieselbe Linie wie die Blackbox-Front von `graph_impact`
(CR-GC-373: „Identitaet plus Vertragskante, keine Beschreibung, keine Attribute"). `nurIdentitaet`
bleibt der eine Beschreibungs-Schnitt; `endpunktIdentitaet` setzt nur den Attribut-Schnitt darauf.

**Folge für die Zusage:** der Modus ist nicht mehr rundlauf-stabil in den NAMEN (die Agenten-Sicht
schreibt kein `__name`). Die Werkzeugbeschreibung sagt das jetzt und verweist für Wortlaut und
Attribute auf `graph_get_node` — dieselbe Abwägung, die `graph_expand` seit CR-GC-621 trägt.

Alle Konsumenten (`executor-gate.ts`, `se-conops`, `se-plan`, `se-fmea`, `se-view:fmea`) nehmen
den JSON-Default; dort ändert sich nichts.

**Positivkontrolle:** ohne `endpunktIdentitaet` sind 4 der 5 Fälle rot.
