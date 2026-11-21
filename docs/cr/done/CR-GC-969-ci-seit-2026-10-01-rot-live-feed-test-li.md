# CR-GC-969: CI seit 2026-10-01 rot: live-feed.test liest das Nachbar-Repo graph-view-edit, whitebox-messung.test braucht Git-Historie, die der flache Checkout der CI nicht hat

**Typ:** aus Item ITEM-2026-1502 (bug)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1502.json (Lane: code)

---

## Befund

Die CI ist seit dem 2026-10-01 rot (43 der letzten 60 Läufe). Im Lauf vom 2026-11-21 sind 2 von 246 Testdateien rot:

| Test | Ursache |
|---|---|
| `tests/live-feed.test.ts`, „Rundreise über die Modelle der Familie“ | liest `../graph-view-edit/docs/graph/graph-view-edit.graph.json`. Die Datei gibt es nur auf dem Rechner des Autors. |
| `tests/whitebox-messung.test.ts`, „die Historie liefert Jobs …“ | `jobsAusHistorie` liest die Git-Historie. `actions/checkout` holt ohne Angabe nur einen Commit. |

## Änderung

1. Der Test liest als zweites Modell die eingecheckte Fixture `tests/fixtures/todo-local-v9.graph.json` statt des Nachbar-Repos. Das folgt der FAQ `test-kein-live-zustand`. Das Modell von graph-view-edit wird nicht kopiert: Das Repo ist privat, graphcode ist öffentlich.
2. `.github/workflows/ci.yml` holt die volle Historie (`fetch-depth: 0`).

## Nebenbefund

`tests/fixtures/perf-basis.graph.json` besteht dieselbe Rundreise nicht. Nicht untersucht, Item folgt.

## Nachweis

- `jobsAusHistorie` auf einem Klon mit einem Commit: 0 Jobs (der rote Fall). Auf einem vollen Klon: 3 Jobs.
- `tests/live-feed.test.ts`: 8 von 8 grün gegen die Fixture.
- Der Lauf der CI nach dem Push steht unter „Ergebnis“.


---

## Entscheidungen

keine

---|---|---|

---

## Umfang laut `graph_impact`

Relation-Kanten: `MOD-dev-scripts` (`scripts/whitebox-messung.mjs`), `FUNC-block-live-dashboard` (Live-Kanal).
Geändert: `tests/live-feed.test.ts`, `.github/workflows/ci.yml`. Kein Quellcode in `src/`.
