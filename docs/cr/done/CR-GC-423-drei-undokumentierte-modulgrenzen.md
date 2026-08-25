# CR-GC-423 — Drei Modulimporte, die im Modell nicht vorkamen

**Status:** done · **Angelegt:** 2026-08-25 · **Geschlossen:** 2026-08-25 (graphVersion 202)
**Herkunft:** CR-DRAFT-GC-409 §C (RC-05). Nach Gruppe A sind noch **3** von ursprünglich 11
RC-05 offen — die restlichen fielen als Nebeneffekt der dort gezogenen io-Kanten.

## Problem

RC-05 vergleicht die echten `import`-Kanten unter `src/` mit der Modul-Nachbarschaft im Graphen
(zwei MOD sind benachbart, wenn je eine ihrer FUNC an demselben FLOW hängt). Drei Importe
überqueren eine Modulgrenze, die das Modell nicht kennt — `graph_impact` unterschätzt dort den
Blast-Radius:

| Import | Modulgrenze |
|---|---|
| `src/harness.ts` → `src/element-slice.ts` | MOD-harness → MOD-element-slice |
| `src/tool-context.ts` → `src/codec.ts` | MOD-mcp-tools → MOD-codec |
| `src/tools/metrics.ts` + `src/tools/suggest.ts` → `src/conformance.ts` | MOD-mcp-tools → MOD-conformance |

Alle drei Importe sind **gewollt** — keiner ist auflösbar, ohne eine bewusste Entscheidung
zurückzunehmen:

- Die Fassade `harness.listElements()` ist CR-GC-388 ("eine Implementierung, ein bequemer
  Einstieg, kein zweiter Pfad"); sie zu löschen hieße, zwei Aufrufern (tools/read.ts,
  viewer/host.ts) das Einsammeln von Store und Scope selbst aufzubürden.
- `tool-context.ts` baut die beiden Codec-Instanzen **einmal** und reicht sie über den
  Werkzeugkontext weiter — Dependency Injection, kein Zufallsimport.
- `toOntologyGraph` ist seit CR-GC-324 der EINE Mapper Graph→OntologyGraph; ein zweiter in
  der Werkzeugschicht wäre exakt der Parallelpfad, den CR-324 abgeschafft hat.

Also wird die Abhängigkeit **dokumentiert**, nicht aufgelöst.

## Fix — drei io-Kanten, jede eine Aussage über echten Datenfluss

| Kante | Warum sie wahr ist |
|---|---|
| `FLOW-graph-state -io-> FUNC-list-elements` | `listElements(storage, scope, filter)` liest den Store, den das Gate besitzt. Der Zustand war bisher nur als Query-Request modelliert — die Scheibe hat aber zwei Eingänge. |
| `FLOW-impact-subgraph -io-> FUNC-encode` | `tools/read.ts:328` — `graph_impact` gibt seinen Teilgraphen an `codec.serialize()`; die Format-E-Scheibe ist Codec-Ausgabe, nicht Werkzeug-Ausgabe. |
| `FLOW-graph-state -io-> FUNC-graph-suggest` | `tools/suggest.ts:118` — `toOntologyGraph(harness.getGraph())`: `graph_suggest` liest den Graphzustand über denselben Mapper, den die Konformitätsprüfung nutzt. |

Die dritte Kante deckt beide Evidenzen des MOD-mcp-tools→MOD-conformance-Befundes ab
(`tools/metrics.ts` hat keine eigene FUNC, es fällt über `MOD-mcp-tools.path = src/tools`).

## Gemessen (dryRun vor dem Batch, 2026-08-25, graphVersion 201)

Keine neue Regel. Einziger Effekt: `R-04 MOD-mcp-tools` zählt 21 statt 20 crossing flows —
derselbe bestehende Befund, kein zusätzlicher. Kein IO-01, kein R-21, kein R-30.

## Akzeptanzkriterien

- [x] Die drei io-Kanten sind über `graph_mutate` gesetzt, `node scripts/export-graph.mjs` gelaufen.
- [x] `rules_evaluate`: RC-05 3 → 0, Gesamtzahl 35 → 32, keine neue Regel-ID.
- [x] `npm test` grün (118 Dateien / 928 Tests, 2026-08-25).

## Nachtrag — was mit RC-05 verschwindet

Die RC-05-Meldung trug als Anhang die Liste der Dateien, die auf **keine** MOD abgebildet werden
(17 Stück). Fällt RC-05 auf 0, verschwindet diese Liste stillschweigend mit — die Regel prüft
diese Dateien dann weiterhin nicht, sagt es aber niemandem mehr. Der Befund wandert deshalb in
**CR-GC-424** (was zuordenbar ist) und **CR-GC-425** (was ohne Regeländerung nicht zuordenbar ist).
