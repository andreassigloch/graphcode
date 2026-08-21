# CR-GC-385 — Die Testseite steht im Graphen

**Status:** done · **Angelegt:** 2026-08-21 · **Geschlossen:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests M3, CR-GC-381

## Problem

59 von 109 Testdateien hatten keinen Knoten. Sie liefen, sie waren grün, und für den Graphen
existierten sie nicht: durch keine Query erreichbar, in keiner Abnahme genannt, in keiner
Testauswahl wählbar. Die Bindungsregeln melden dazu nichts — R-19 prüft die Knoten, die da sind,
nicht die Realität, die fehlt (KPI-Befund M4).

## Änderung (gate-only, `graph_mutate`, sechs Batches)

| | vorher | nachher |
|---|---|---|
| Testdateien mit Abnahme | 50/109 | **109/109** |
| TEST-Knoten | 63 | 120 (57 neu) |
| `verify`-Kanten | 136 | 224 |
| Auswahl-Recall (M2) | 13 % | **30 %** |
| Graph-Anteil an der Auswahl über 60 Commits | 31 | 105 Dateiläufe |

**Zuordnungsgrundlage.** Jede Abnahme trägt Name und Beschreibung aus dem Kopfkommentar ihrer
Datei — was die Datei behauptet zu beweisen, nicht was sie technisch anfasst. Die `verify`-Kanten
gehen an die REQ, die diese Behauptung wirklich trägt. Mechanisch war das nicht zu haben: nur
3 der 59 Dateien nannten eine existierende REQ, und die Auflösung über die CR-Relationen lieferte
je Datei bis zu vier Kandidaten-REQ — brauchbar als Vorschlag, unbrauchbar als Bindung.

**Drei Dubletten aufgelöst statt verdoppelt.** `tests/mcp.merge.test.ts` und
`tests/schema-guard.test.ts` realisieren zwei bereits vorhandene Konzept-Abnahmen. Statt neue
Knoten danebenzustellen, wurden die vorhandenen gebunden (`concept: false` + `testRefs`) und die
versehentlich angelegten Zwillinge hineinverschmolzen. Dazu eine falsch gesetzte Kante entfernt:
`TEST-deny-stale-read` verifizierte `REQ-hook-extension-points`, das Thema von `TEST-hooks` — der
Shell-Hook belegt die SSOT-Eigenschaft, nicht das Hook-System.

## Was das NICHT repariert

**Die Quellseite bleibt bei 19/65** (M1). Der Graph kennt jetzt die Tests, aber nicht den Code:
46 Quelldateien haben keinen Knoten, und eine Änderung dort fällt weiter in den Volllauf. Das ist
der nächste und teurere Schritt — eine FUNC trägt vier Pflichten (CR-GC-366), nicht nur eine
Dateireferenz.

**Die Ergebnisse fehlen zunächst.** Neue Bindungen tragen kein `result`, VR-01 meldet sie als
`pending` — korrekt: eine Bindung ohne Lauf ist keine Evidenz. Sie werden aus einem echten
`--reporter=json`-Lauf über `graph_test_ingest` nachgetragen.

## Akzeptanzkriterien

- [x] Jede Testdatei auf Disk gehört zu genau einer Abnahme (109/109, R-29 = 0)
- [x] Jede neue Abnahme hat mindestens eine `verify`-Kante (R-05 = 0)
- [x] Keine Dublette neben einer vorhandenen Konzept-Abnahme
- [x] Alle Änderungen durchs Gate, OCC je Batch, Export über den Owner
- [x] Ergebnisse aus einem echten `--reporter=json`-Lauf eingespielt: 108 von 109 Dateien
      gestempelt; die eine Ausnahme deckte zwei Fehler auf (Instrument + Ingest, s. CR-GC-386)
- [x] Gesamtsuite 851/852 — einzige Rotstelle bleibt der Vorbestand `tests/distribution.test.ts`
      (`@sigloch/graph-view-edit@^0.6.0` ist nicht publiziert, npm kennt nur bis 0.5.0)

@author andreas@siglochconsulting
