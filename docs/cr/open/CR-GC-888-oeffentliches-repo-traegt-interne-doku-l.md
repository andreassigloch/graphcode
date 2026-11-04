# CR-GC-888: Oeffentliches Repo traegt interne Doku: Leitlinie, Konzepte, Arbeitsstaende, private Beispielgraphen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1180 (finding)
**Erstellt:** 2026-11-03
**Item:** bok/items/ITEM-2026-1180.json (Lane: graph)

---

## Befund

Öffentlich ist alles, was in git getrackt ist. Das npm-Paket liefert kein docs/ aus (`files` in package.json), GitHub (`origin`) dagegen schon. CR-GC-764/765 haben am 2026-10-08 Rig und Auswertung ins private Repo graphanalyze verschoben, aus demselben Grund: echte Projekte gehören nicht ins öffentliche Repo. Liegen geblieben sind:

| Bereich | Inhalt | Warum privat |
|---|---|---|
| `docs/archive/` außer `ADR-001…` und `spikes/` | Session-Notizen, Testläufe mit `/Users/`-Pfaden, Fassung der Leitlinie vom 2026-10-08, Proposals, Research | Arbeitsprozess |
| `docs/spikes/`, `docs/project/`, `docs/LANDSCAPE.md` | Arbeitsstände | Arbeitsprozess |
| `beispielgraphen/` außer `todo-referenz/` | Modelle privater Projekte: moneyflow, bok, sigllm (mit Audit-Log), gve, gc-run-* | fremde, private Inhalte |

Bleibt öffentlich (Entscheidung Andreas 2026-11-03): README, `docs/graphcode_leitlinie.md` und die vier Konzepte (`graphcode_*_konzept.md`, `graphcode_regelmatrix_entwurf.md`), `docs/articles/`, `docs/archive/ADR-001…`, `docs/archive/spikes/` (Belege), `docs/cr/`, `docs/views/`, `docs/graph/`, `beispielgraphen/todo-referenz/`.

## Ziel

Das Material oben liegt versioniert in graphanalyze (`docs/archive/`, `docs/spikes/`, `beispielgraphen/`) und ist im öffentlichen Repo gelöscht. Die öffentliche History bleibt unverändert (Entscheidung 2026-11-03; ITEM-2026-786 deshalb verworfen). Kein neues Repo: graphcode-internal ist die eingefrorene History vom 2026-07-26, keine laufende Ablage.

## Abhängigkeiten im Code — vor dem Verschieben lösen

Ein frischer öffentlicher Clone muss grün bleiben. Diese Stellen lesen Dateien, die wandern sollen:

- `beispielgraphen/sigllm-v98.graph.json`: `tests/generate.statemachine.test.ts`, `tests/generate.stufen.test.ts`, `tests/generate.task.test.ts`, `tests/steer-optimum.test.ts`, `scripts/model-test-set.mjs`, `scripts/randbreiten.mjs`
- `beispielgraphen/` (ganzer Ordner): `tests/randbreiten.test.ts`
- `beispielgraphen/dummy-slicer.graph.json`: `scripts/whitebox-messung.mjs`

Entschieden 2026-11-04: Die sigllm-Fälle ziehen mit nach graphanalyze. Der Graph ist ein eingefrorener Stand, und graphanalyze ist privat (GitHub `PRIVATE`, package.json `"private": true`). Es ziehen nur die Fälle um, die sigllm-v98 oder dummy-slicer lesen, nicht die ganzen Dateien: Die Dateien testen `generate` und `steer` aus `src/`, und `generate.statemachine` und `generate.stufen` laufen auch gegen `todo-referenz/`, das öffentlich bleibt. `tests/generate.statemachine.test.ts` ist im Modell als testRef gebunden und bleibt deshalb in graphcode. Die umgezogenen Fälle laden graphcode über `graphanalyze/graphcode.mjs`. `tests/randbreiten.test.ts` hält Kennzahlen je eingefrorenem Graphen und behält nur die Zeilen der Graphen, die hier bleiben.

`docs/messung/` bleibt hier: `verify:full` und `src/projections/test-schlupf.ts` schreiben und lesen es.

## Schnitt

Über 10 Dateien, überwiegend Löschungen. Vor dem Start teilen, Vorschlag:
1. Dieser CR: `docs/archive/` (ohne Belege), `docs/spikes/`, `docs/project/`, `LANDSCAPE.md` nach graphanalyze; Verweise darauf in Leitlinie, Konzepten, Artikeln und `.gitignore`-Kommentar nachziehen.
2. Folge-CR CR-GC-891: `beispielgraphen/` ohne `todo-referenz/` nach graphanalyze, mit den sigllm-Fällen aus `generate.*`, `steer-optimum` und `randbreiten`, und `scripts/model-test-set.mjs`, `scripts/randbreiten.mjs` und `scripts/whitebox-messung.mjs` auf die verbleibenden Graphen umstellen.

## Abnahme

- `git ls-tree -r origin/master` enthält keine der oben als privat gelisteten Dateien.
- Die Dateien liegen in graphanalyze, mit Commit.
- Frischer Clone von origin: `npm ci && npm run build && npm test` grün.
- In graphanalyze laufen die umgezogenen Fälle grün gegen die graphcode-Arbeitskopie.
- `rules_evaluate` meldet keinen neuen R-19-Befund.
- `git grep` nach den verschobenen Pfaden trifft außerhalb von `docs/cr/` nichts mehr.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Ergebnis (2026-11-04)

Teil 1 umgesetzt, Teil 2 geht an CR-GC-891.

- **Verschoben:** 21 Dateien nach graphanalyze (byte-gleich geprüft, dort Commit `f82ca06`-Nachfolger „interne graphcode-Doku übernommen“): `docs/archive/` ohne `ADR-001` und `spikes/`, `docs/spikes/SPIKE-GC-bedrohungsanalyse.md`, `docs/LANDSCAPE.md`. In graphcode gelöscht (Commit `2c46676e`).
- **Abweichung vom Plan:** `docs/project/` bleibt. Es ist der Ort für Projektdoku, `steuerungsschleife.md` ist ein Konzept wie die Leitlinie, und drei ungetrackte Arbeitsdateien des Autors liegen dort.
- **Verweise nachgezogen:** Leitlinie Kopf (nur diese Zeile; die offenen Änderungen des Autors bleiben ungestagt), Artikel 03 (Benchmark-Link auf `archive/spikes/`, Executor-Bericht-Link entfernt), `.gitignore`-Kommentar, Herkunftskommentare in `src/projections/help-content.ts` und `help.ts`.
- **Bleiben bewusst:** Verweise in `docs/archive/ADR-001…` und `docs/archive/spikes/SPIKE-GC-minimal-whitebox.md` auf verschobene Dateien. Beides sind eingefrorene Belege.
- **Modell:** `CR-GC-888 -relation-> REQ-docs-taxonomy, FUNC-graph-help`; dazu 889 und 890 auf `REQ-docs-taxonomy` (Graph-Version 997).
- **Tests:** `npm run build` grün; `verify:code` 442/442; `verify:full CR-GC-888` 1700/1701, Schlupf 0. Der rote Test `arch.optimization-dry-run.spike` prüft, dass die SSOT während seines Laufs unverändert bleibt; ein paralleler `graph_export` hat sie geschrieben. Allein nachgefahren: grün.
- **Nicht gepusht:** weder graphcode noch graphanalyze.
