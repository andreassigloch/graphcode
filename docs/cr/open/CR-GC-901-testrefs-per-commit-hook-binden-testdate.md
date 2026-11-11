# CR-GC-901: testRefs per Commit-Hook binden: Testdatei nennt TEST-uid im Kopf, FUNC-commit-check bindet oder meldet (aus BOK-CR-080 Punkt 3)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1278 (finding)
**Erstellt:** 2026-11-10
**Item:** bok/items/ITEM-2026-1278.json (Lane: code)

---

## Befund

BOK-CR-080 (immo-infra, Bauphase 2026-11-04..09): Nach jedem neuen Test band der Agent die Datei
per graph_mutate von Hand an ihren TEST-Knoten. Diese Buchführung kann der Testlauf selbst leisten.

## Entscheidung (2026-11-10, Auftraggeber)

Der Titel nennt einen Commit-Hook, gebaut wird die Bindung aber in `graph_test_ingest`. Der
pre-commit-Hook (`scripts/githooks`) läuft nur im graphcode-Repo. immo-infra, bok und
sigloch-modules haben keinen Hook, dort hätte er nichts geändert. `graph_test_ingest` läuft in
jedem Repo, sobald ein Testlauf eingespielt wird.

## Änderung

- Eine Datei ohne `testRefs`-Eintrag wird beim Ingest gebunden, wenn ihr Kopfkommentar genau eine
  TEST-uid dieses Modells nennt. Kopf = die Zeilen vor der ersten Codezeile. Der neue Eintrag trägt
  Werkzeug, Ergebnis und `ranAt` und geht in dasselbe Kommando wie die übrigen Einträge des Knotens.
- Sonst bleibt die Datei `unresolved`, und der Grund sagt, was fehlt: keine uid im Kopf, mehrere
  (R-29), eine fremde, kein Werkzeug, Datei nicht lesbar, Datei außerhalb des Repos.
- Werkzeug: Beim vitest-Report ist es `vitest`, bei `results` gibt der Aufrufer `tool` je Eintrag mit.
- `planIngest` bekommt den Dateizugang als Funktionen (`KopfZugang`) und bleibt damit rein.

## Dateien (4)

`src/projections/verification-report.ts`, `src/projections/testreport.ts`,
`tests/testreport.kopf-bindung.test.ts`, diese Datei; dazu `docs/graph/graphcode.graph.json`.

## Akzeptanzkriterien

- Neue Testdatei mit TEST-uid im Kopf: ein Ingest bindet sie samt Ergebnis, ohne graph_mutate des
  Agenten. Ein zweiter Lauf erzeugt keine zweite Bindung.
- Ohne eindeutige uid kein Raten: die Datei bleibt `unresolved` mit benanntem Grund.
- Validierung am eigenen Modell: `TEST-testref-kopf-bindung` wird ohne testRefs angelegt und durch
  den Ingest des eigenen Laufs gebunden.

## Validierung (2026-11-11)

- Erster Ingest des eigenen Laufs: abgelehnt. Der Kopf der Testdatei sagt in Prosa „eine TEST-uid",
  das las der Ingest als zweite uid und meldete R-29.
- Korrektur (7d2fd511): Für die Eindeutigkeit zählen nur uids, die im Modell ein TEST sind. Der Test
  deckt den Fall ab; er lief vor der Korrektur rot.
- Zweiter Ingest über den neuen Host: `TEST-testref-kopf-bindung` gebunden, Ergebnis `passed`,
  `unresolved` leer. Volle Suite grün (1747 Tests).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1036, Tiefe 1, Wurzeln: `FUNC-test-ingest`._

Reichweite: 8 Elemente (FLOW 6, FUNC 2); Blackbox-Rand 7, nicht geoeffnet.

Dateien (realRef, 2):
- src/kernel/hooks.ts
- src/projections/testreport.ts

Tests (`graph_tests`, 8):
- tests/contracts.surface.test.ts
- tests/mcp.realize.test.ts
- tests/mcp.tests-deduction.test.ts
- tests/mutate.formate-binding.test.ts
- tests/mutate.schema-guard.test.ts
- tests/test-selection.audit.test.ts
- tests/testreport.ruecknahme.test.ts
- tests/testreport.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
