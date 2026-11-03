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

Offen, vor Start zu entscheiden: `sigllm-v98` durch ein neutrales Fixture unter `tests/fixtures/` ersetzen, oder die Tests nach graphanalyze ziehen. `docs/messung/` bleibt hier: `verify:full` und `src/projections/test-schlupf.ts` schreiben und lesen es.

## Schnitt

Über 10 Dateien, überwiegend Löschungen. Vor dem Start teilen, Vorschlag:
1. Dieser CR: `docs/archive/` (ohne Belege), `docs/spikes/`, `docs/project/`, `LANDSCAPE.md` nach graphanalyze; Verweise darauf in Leitlinie, Konzepten, Artikeln und `.gitignore`-Kommentar nachziehen.
2. Folge-CR: `beispielgraphen/` samt Fixture-Umbau der Tests.

## Abnahme

- `git ls-tree -r origin/master` enthält keine der oben als privat gelisteten Dateien.
- Die Dateien liegen in graphanalyze, mit Commit.
- Frischer Clone von origin: `npm ci && npm run build && npm test` grün.
- `git grep` nach den verschobenen Pfaden trifft außerhalb von `docs/cr/` nichts mehr.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
