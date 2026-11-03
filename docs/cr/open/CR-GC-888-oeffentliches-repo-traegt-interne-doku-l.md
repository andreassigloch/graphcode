# CR-GC-888: Oeffentliches Repo traegt interne Doku: Leitlinie, Konzepte, Arbeitsstaende, private Beispielgraphen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1180 (finding)
**Erstellt:** 2026-11-03
**Item:** bok/items/ITEM-2026-1180.json (Lane: graph)

---

## Befund

Öffentlich ist alles, was in git getrackt ist. Das npm-Paket liefert kein docs/ aus (`files` in package.json), GitHub (`origin`) dagegen schon. Auf `origin/master` liegen heute interne Dokumente:

| Bereich | Inhalt | Warum intern |
|---|---|---|
| `docs/graphcode_leitlinie.md`, `docs/graphcode_*_konzept.md`, `docs/graphcode_regelmatrix_entwurf.md` | 5 Dateien, 1880 Zeilen | deutsch, 41 Verweise auf private Repos (bok/, graphanalyze, sigloch-modules) |
| `docs/LANDSCAPE.md`, `docs/project/`, `docs/spikes/` | Arbeitsstände | deutsch, nicht für Nutzer geschrieben |
| `docs/archive/` außer `ADR-001` und `spikes/` | Session-Notizen, Testläufe mit `/Users/`-Pfaden, alte Leitlinie, Proposals | Arbeitsprozess |
| `beispielgraphen/` außer `todo-referenz/` | Modelle privater Projekte: moneyflow, bok, sigllm (mit Audit-Log), gve, gc-run-* | fremde, private Inhalte |

Bleibt öffentlich (Entscheidung Andreas 2026-11-03): README, `docs/articles/`, `docs/archive/ADR-001…`, `docs/archive/spikes/` (Belege), `docs/cr/`, `docs/views/`, `docs/graph/`, `beispielgraphen/todo-referenz/`.

## Ziel

Das interne Material liegt versioniert in einem privaten Repo, im öffentlichen Repo ist es per `.gitignore` ausgeschlossen. Die öffentliche History bleibt unverändert (Entscheidung 2026-11-03: kein neuer Orphan-Commit).

## Abhängigkeiten im Code — vor dem Verschieben lösen

Ein frischer öffentlicher Clone muss grün bleiben. Diese Stellen lesen Dateien, die wandern sollen:

- `beispielgraphen/sigllm-v98.graph.json`: `tests/generate.statemachine.test.ts`, `tests/generate.stufen.test.ts`, `tests/generate.task.test.ts`, `tests/steer-optimum.test.ts`, `scripts/model-test-set.mjs`, `scripts/randbreiten.mjs`
- `beispielgraphen/` (ganzer Ordner): `tests/randbreiten.test.ts`
- `beispielgraphen/dummy-slicer.graph.json`: `scripts/whitebox-messung.mjs`
- `docs/messung/`: `src/projections/test-schlupf.ts` und `scripts/verify-full.mjs` (schreiben `testauswahl.jsonl`, Teil der Testdisziplin in CLAUDE.md), `scripts/messung.mjs`, `scripts/retro-kpi.mjs`, `tests/messung.test.ts`, `tests/retro-kpi.test.ts`, `.claude/commands/se-retro.md`

Offen, vor Start zu entscheiden: (a) `docs/messung/` bleibt öffentlich, weil der Code es schreibt und liest; (b) `sigllm-v98` durch ein neutrales Fixture ersetzen oder als Fixture nach `tests/fixtures/` verschieben (Inhalt prüfen: privat?).

## Schnitt

Die Verschiebung berührt über 50 Dateien, die Grenze liegt bei 10 je CR. Vorschlag: dieser CR legt das private Repo an und nimmt `docs/` (Leitlinie, Konzepte, LANDSCAPE, project, spikes, archive) heraus; die Beispielgraphen samt Fixture-Umbau werden ein eigener CR.

Ebenfalls anzupassen: `CLAUDE.local.md` (Pfad der Leitlinie), Kommentar in `.gitignore` (verweist auf `graphcode_leitlinie.md §9`), README-Abschnitt „Model & docs“ (folgt in CR-GC-889).

## Abnahme

- `git ls-tree -r origin/master` enthält keine der oben als intern gelisteten Dateien.
- Die Dateien liegen im privaten Repo, mit Commit.
- Frischer Clone von origin: `npm ci && npm run build && npm test` grün.
- `grep -rn` nach den verschobenen Pfaden in src/, scripts/, tests/, .claude/ ohne Treffer, oder nur auf bewusst öffentliche Pfade.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
