# CR-GC-505: Drei Bus-Reste: Weiterreicher und tote Leser an FLOW-Enden

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-028 (idea, Spike Bus-FLOW)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-028.json (Lane: graph)

---

Der Spike (Item, Abschnitt „ERGEBNIS 2026-09-11 … SUCHLAUF") fand nach CR-GC-501..504 vier Stellen desselben Phänomens: eine FUNC ist als Ende eines FLOW modelliert, obwohl sie den Inhalt nicht bildet, nur weiterreicht oder den Zustand nicht mehr liest. Diese CR behandelt die Stellen 2–4. Stelle 1 (`FLOW-mutate-cmd`, `src/loop/executor.ts`) ist nicht Teil dieser CR.

## Befund (am Code geprüft)

Die Kandidaten stammen aus einer Heuristik. Jeder ist hier am Code gelesen.

### Stelle 2: `FLOW-formatE-artifact`, graph-impact / graph-expand als Produzenten (bestätigt, Hypothese korrigiert)

- `harness.impact` (`src/kernel/harness.ts:261–264`) gibt `impactSlice(graph, [rootId], depth)` zurück, also ein `ImpactSlice` mit Rolle und Abstand je Knoten. Text entsteht dort nicht.
- `harness.subgraph` (`harness.ts:272–274`) gibt einen `Graph` aus `storage.getSubgraph` zurück.
- Format-E bildet das Lese-Werkzeug `bindReadTools` (`src/surface/read.ts:234`):
  - graph_impact ruft `harness.impact` (349), serialisiert mit `codec.serialize` (358) und hängt die Blackbox-Front (361–376) und das Freshness-Banner (382) an.
  - graph_expand ruft `harness.subgraph` (402), filtert nach Zweig (403–404) und serialisiert (405).
- Korrektur zur Hypothese: der Weg führt nicht über `gcCodec.encode`. `codec` ist der `FormatECodec` aus graph-api-core (`src/surface/tool-context.ts:267`). `gcCodec.encode` bedient nur graph_elements und graph_get_edges (read.ts:269, 321), dort bleibt `FUNC-encode` Produzent.
- Weiterer Fehler auf demselben Paar: die Konsumkante `formatE-artifact → graph-expand` stimmt nicht. `handle` ist eine uid (read.ts:54), `harness.subgraph(rootId: string, …)`.
- Der eigentliche Produzent (`bindReadTools`) fehlte im Modell.

### Stelle 3: `FLOW-query-request`, serve-stdio als Produzent (bestätigt)

- `serveStdio` (`src/surface/mcp-server.ts:132–224`) wählt zwischen Host und Proxy, bindet die Registry und verbindet den Transport (223).
- Die Argumente einer Anfrage kommen vom Agenten über das SDK in `tool.handler(tool.inputSchema.parse(args))` (mcp-server.ts:59, `bindRegistryToMcpServer`).
- serveStdio bildet also keinen Inhalt der Anfrage. Es reicht sie nur weiter.

### Stelle 4: `FLOW-graph-state` → apply-reseed / reseed (bestätigt)

- `harness.reseed` (`harness.ts:385–387`) reicht `relPath` unter der Schreibsperre an `applyReseed` weiter.
- `applyReseed` (`src/kernel/harness-import.ts:159–170`) ruft `target.clear()` und `seedFromJsonFile(target, relPath)` auf; Letzteres liest die Datei (146–148). Danach folgt `clearExportPending`.
- Den Arbeitsstand liest nur der Store selbst, in `clear` (`src/kernel/graph-store.ts:145–150`, `this.graph.nodes` in Zeile 147).

### Positivkontrollen (I2)

- **A: Wo entsteht Format-E?** `grep 'serialize(\|\.encode('` über harness.ts und read.ts findet die bekannten Stellen read.ts:269/321/358/405/432, in harness.ts keine.
- **B: Wer liest den Arbeitsstand?** `grep 'current()\|this\.graph\|getGraph()'` findet die bekannten Leser graph-store.ts:147 und harness.ts:225/355. In harness-import.ts und in harness.ts:385–387 findet er keinen.
- **C: Findet das Rig die Stellen?** Rig `io02` am SSOT v253 findet `formatE-artifact` mit 6P (darunter graph-impact und graph-expand) und `query-request` mit 11P (darunter serve-stdio).

## Änderung (nur Modell, über `graph_mutate`)

- Stelle 2:
  - Die Produzentenkanten `graph-impact → formatE-artifact` und `graph-expand → formatE-artifact` sind gelöscht, ebenso die Konsumkante `formatE-artifact → graph-expand`.
  - Neu ist `FUNC-read-tools` (realRef `src/surface/read.ts::bindReadTools`, MOD-surface, erfüllt `REQ-query-precision` und `REQ-progressive-expansion`, Kind von `FUNC-block-abfrage`). Die Funktion liest `query-request` und erzeugt `formatE-artifact`.
  - Rückgabewerte als eigene Flüsse:
    - `FLOW-impact-slice`: graph-impact → read-tools, mit `SCHEMA-impact-slice` (graph-api-core `ImpactSlice`, external).
    - `FLOW-expand-subgraph`: graph-expand → read-tools, mit `SCHEMA-ontology-graph`.
  - `FUNC-read-tools` ist in die Ketten aufgenommen, die den Werkzeugschritt graph_impact/graph_expand nennen: `FCHAIN-agent-query`, `FCHAIN-interface-escalation` und `FCHAIN-advisory-roundtrip`.
  - Die Beschreibungen von `FUNC-graph-impact` und `FLOW-formatE-artifact` sind an den Code angepasst.
- Stelle 3: die Kante `serve-stdio → query-request` ist gelöscht.
- Stelle 4: die Kanten `graph-state → apply-reseed` und `graph-state → reseed` sind gelöscht.

## Messplan

- IO-02: Rig `rig/flow-cardinality/measure.mjs::io02` am exportierten SSOT, Produzenten je FLOW vorher und nachher.
- `graph_readiness`: Fehler, importCoverage, RC-04, R-31, FC-04, IO-01.
- GVE im Funktionsnetzwerk, Grounding aufgeklappt: Knoten · Kanten, Bild vorher und nachher.
- Tests: Auswahl über `graph_tests`, dazu die modellgebundenen Tests, danach die volle Suite.

## Akzeptanzkriterien

- graph-impact, graph-expand und serve-stdio sind keine Produzenten mehr. graph-state hat keine io-Kante zu reseed oder apply-reseed.
- Das Format-E der Lese-Werkzeuge hat einen code-gebundenen Produzenten.
- 0 Fehler, kein neuer RC-Befund, importCoverage unverändert.
- Jede Änderung an R-31 und IO-01 ist benannt und begründet.
- In der vollen Suite ist nur die bekannte Grundlast rot.

---

## Umsetzung (2026-09-11, Graph-Version 253 → 254)

Nur Modell, keine Code-Datei geändert. Ein Batch mit 27 Kommandos über `graph_mutate` (vorher `dryRun`, `baseVersion` 253), danach `scripts/export-graph.mjs`.

| Stelle | gelöscht | neu |
|---|---|---|
| 2 formatE-artifact | `graph-impact → formatE-artifact`, `graph-expand → formatE-artifact`, `formatE-artifact → graph-expand` | `FUNC-read-tools` (read.ts::bindReadTools) mit `query-request →`, `→ formatE-artifact`, allocate MOD-surface, satisfy REQ-query-precision/REQ-progressive-expansion, Kind von Abfrage, Glied von agent-query, interface-escalation und advisory-roundtrip; `FLOW-impact-slice` (graph-impact → read-tools) + `SCHEMA-impact-slice`; `FLOW-expand-subgraph` (graph-expand → read-tools) → `SCHEMA-ontology-graph` |
| 3 query-request | `serve-stdio → query-request` | — |
| 4 graph-state | `graph-state → apply-reseed`, `graph-state → reseed` | — |

Die Beschreibungen von `FUNC-graph-impact` und `FLOW-formatE-artifact` nennen jetzt den Code-Weg.

Warum read-tools auch in `interface-escalation` und `advisory-roundtrip` steht: beide Ketten nennen den Werkzeugschritt graph_impact. Das Werkzeug besteht aus zwei Teilen, der Abfrage im Kern und der Serialisierung im Lese-Werkzeug. Im dryRun ohne diese beiden Kanten meldete IO-01 `FUNC-mutate` in `interface-escalation`. Die Verbindung zu `mutate` läuft über `formatE-artifact`, einen Kanal mit mehreren Absendern, und damit so wie vor der CR über graph-impact.

## Messung

| Größe | vorher (v253) | nachher (v254) |
|---|---|---|
| IO-02 (Rig am SSOT) | 6 | 6 |
| `formatE-artifact` Produzenten | 6 | 5 (graph-impact und graph-expand sind weg, read-tools ist neu) |
| `query-request` Produzenten | 11 | 10 (serve-stdio ist weg) |
| `graph-state` Konsumenten | 23 | 21 (reseed und apply-reseed sind weg) |
| neue Flüsse `impact-slice`, `expand-subgraph` | — | je 1 Produzent und 1 Konsument |
| install-result / mutate-cmd / skill-report / steering-trigger | 3 / 22 / 6 / 3 | unverändert |
| `graph_readiness` Fehler | 0 | 0 |
| importCoverage | 83/84 | 83/84 (`src/index.ts`) |
| RC-04 | 5 | 5, kein anderer RC-Befund |
| R-31 | 10 | **11** (+ `FUNC-serve-stdio`) |
| FC-04 | 3 | 3 |
| IO-01 | 1 | **2** (+ `FUNC-serve-stdio` in `FCHAIN-doc-export`) |
| GVE, Grounding offen, FLOW sichtbar | 20 Knoten · 88 Kanten | 20 Knoten · 86 Kanten |

Bilder (lokal, `data/` ist gitignored): `data/bilder-2026-09-10/cr505-vorher.png` und `data/bilder-2026-09-10/cr505-nachher.png`.

Sichtcheck (I3), welches Signal hinter den zwei fehlenden Linienbündeln steckt. Die Zuordnung ist am v253-SSOT gegengeprüft:
- Abfrage verliert den Port `in.FLOW-formatE-artifact`. Im v253-Modell war `graph-expand` der einzige Konsument von formatE-artifact in der Abfrage, also die falsche Leser-Kante aus Stelle 2.
- Betrieb verliert die Linie zum Bus `Query-Request`. Im v253-Modell war `serve-stdio` (Bedienung) der einzige Produzent von query-request im Betrieb, also Stelle 3.
- Stelle 4 hat in dieser Sicht keine eigene Linie. `reseed` liegt im Gedächtnis, das graph-state weiter über vier Konsumenten liest. `apply-reseed` liegt im Speicherwerk, dem Block, der graph-state selbst erzeugt.
- Die Format-E-Ausgabe der Abfrage bleibt, jetzt über read-tools. Die neuen Rückgabeflüsse verlaufen innerhalb der Abfrage und sind auf dieser Ebene nicht sichtbar.

## Bewusst offen

- **R-31 `FUNC-serve-stdio`, neu:** serveStdio verbindet nur den Transport (mcp-server.ts:223) und hat keinen Ausgang mit eigenem Inhalt. Die Antworten der Werkzeuge reicht es ebenfalls nur weiter. Das ist dieselbe Klasse wie `serve-sse` (CR-GC-501). Ich habe keine Ersatzkante angelegt.
- **IO-01 `FUNC-serve-stdio` in `FCHAIN-doc-export`, neu:** folgt aus demselben Grund. Die Kette beschreibt den Transport als Glied. Ob ein Transport Glied einer Kette sein soll, entscheidet diese CR nicht. Compose-Kante und Beschreibung sind unverändert.
- **R-31 `reseed` / `apply-reseed`:** jetzt ohne Eingang und ohne Ausgang, der Zähler bleibt gleich. Die tatsächliche Eingabe ist der Snapshot-Pfad: `rewind.ts:148` ruft `harness.reseed(stageRel)`, `write.ts:583` ruft `harness.reseed(input.path)`, weiter über `applyReseed` an `seedFromJsonFile`. Dafür gibt es keinen FLOW. Das Modell zeigt ihn weiterhin nicht, IO-01 `FUNC-rewind` in `FCHAIN-recall` bleibt.
- **`FLOW-round-scope` (concept):** beschreibt einen „Format-E-Slice als string aus graph_impact bzw. graph_expand" und hat graph-impact als Produzent. Das ist dasselbe Muster, aber nur konzeptuell modelliert; nicht angefasst.
- **Stelle 1 `FLOW-mutate-cmd` / `executor.ts`:** gehört zu einem anderen Auftrag.
- **Code:** read.ts serialisiert graph_impact, graph_expand und graph_context mit dem rohen `FormatECodec` (358/405/432), graph_elements und graph_get_edges dagegen mit `GraphCodeCodec.encode` (269/321). Das sind zwei Serialisierungswege. Hier nur benannt.

## Tests

- Kein TypeScript geändert, deshalb kein Build nötig.
- Auswahl: `graph_tests` für graph-impact, graph-expand, serve-stdio, reseed und apply-reseed (14 Dateien), dazu die modellgebundenen `mcp.agent-agnostic` und `repository-style.spike`. 16 Dateien, 98 von 98 grün, darunter `rewind.test` mit der realRef-Bindung von `FUNC-reseed`.
- Volle Suite (Modell v254): 1074 von 1080 grün. Rot sind 5 Dateien mit 6 Tests, genau die bekannte Grundlast: `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.artifact-coupling`, `steering.process-ratchet`, `steering`. Das sind dieselben Zahlen wie in CR-GC-504, keine neue rote Datei.
