# CR-GC-382 — Modellbereinigung: eine Code-Bindung, keine zweite Adresse

**Status:** done · **Angelegt:** 2026-08-21 · **Geschlossen:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests, CR-GC-381

## Problem

Drei Befunde des Spikes betreffen nicht das Werkzeug, sondern die Daten:

1. **`codeRef` lebt neben `realRef` weiter** (M5): 36 FUNC tragen beide, **13 davon widersprüchlich** —
   `FUNC-deduce-tests` zeigt per `realRef` auf `src/tools/report.ts#graph_tests` und per `codeRef`
   auf `src/mcp-tools.ts#bindToolsToHarness`, den Stand vor der Tool-Aufteilung. `codeRef` ist seit
   CR-228 abgelöst; kein Konsument liest es mehr. Ein zweiter Adressweg mit falschen Daten ist genau
   der parallele Pfad, den die Guardrails verbieten.
2. **`case` wird von genau einem Konsumenten gelesen** (M10): RC-02 prüft den Namen, R-29,
   `graph_tests` und der Ingest ignorieren ihn. Unter dem Leitsatz (der TEST-Knoten IST das
   Testobjekt) ist `case` eine feinere Adresse **neben** der Objektidentität — sie entfällt.
3. **Die grobe MOD-Ebene war eine Hypothese** (M9) — sie wird hier geprüft.

## Änderungen (gate-only, `graph_mutate`, keine Handedits am SSOT)

| Batch | Was | Ergebnis |
|---|---|---|
| 1 | `codeRef: null` auf 36 FUNC (Attribute sind nur mergebar → Grabstein) | graphVersion 115 |
| 2 | `case` aus den 12 `testRefs`-Einträgen entfernt (Array vollständig neu geschrieben, `result`/`ranAt` erhalten) | 116 |
| 3 | `path` auf `MOD-mcp-tools`/`MOD-docs`/`MOD-dashboard` — **gemessen und zurückgenommen**, s. u. | 117 → 118 |

Dateien: nur die generierten `docs/graph/graphcode.graph.json` + `docs/views/*` (Export über den
Owner-Prozess) und diese CR-Datei. Die `codeRef`-Grabsteine (`"codeRef": null`) bleiben als
Merge-Semantik im Snapshot stehen — der falsche Wert ist weg, der Schlüssel bleibt.

## Negativergebnis: die grobe MOD-Ebene trägt heute nicht

`MOD.path` sollte die 46 unmodellierten Quelldateien billig auflösen (`Datei → MOD → FUNC → REQ →
TEST`, 3 Pfade decken 12 Dateien). Real gemessen für genau diese 12 Dateien:

| | Wert |
|---|---|
| ausgewählte Testdateiläufe | 100 |
| tatsächlich direkt gekoppelte Tests | 20 |
| davon getroffen | **3** |

Gesamtauswahl 35 → 129 Dateien, Treffer 17 → 19. Entscheidend ist nicht die Ineffizienz, sondern die
Semantik: Dateien, die vorher ehrlich in den **Volllauf** fielen, lieferten danach eine Auswahl, die
`complete` meldet und die wirklich koppelnden Tests **nicht** enthält — aus einem ehrlichen Volllauf
wird ein selbstbewusst falscher Teil-Lauf. Deshalb zurückgenommen (`path: null`).

Ursache ist nicht die Grobheit, sondern die unverankerte Testseite: die TESTs, die diese Module
wirklich abnehmen, existieren als Knoten nicht (M3). **Erst Testseite verankern (CR-GC-384), dann die
grobe Ebene erneut messen.**

## Messwerte

| | vorher | nachher |
|---|---|---|
| M1 Quellseite | 19/65 | 19/65 (unverändert — `realRef` war schon die einzige gültige Adresse) |
| M2 Recall | 13 % | 13 % |
| `case`-Einträge | 12 | **0** |
| widersprüchliche Code-Bindungen | 13 | **0** |

Die Bereinigung verbessert keine Kennzahl — sie entfernt eine Fehlerquelle. Genau das war der Zweck:
eine Auswahl, die auf `codeRef` aufgesetzt hätte, wäre in 13 Fällen zur falschen Datei gelaufen.

## Nicht in diesem CR

- **R-29 (16 Verletzungen)** → CR-GC-383. Die Auflösung berührt zwei Dateien mit hartkodierten
  TEST-uids (`tests/hooks.inject-graph-slice.test.ts`, `rig/minimal-whitebox/jobs.mjs`), ist also
  nicht gate-only und gehört in einen eigenen Zug.
- **57 unverankerte Testdateien** → CR-GC-384.
- **contracts: `case` streichen** → eigener Familie-CR; hier ist nur der eigene Graph bereinigt,
  damit der spätere Bump auf einen sauberen Graphen trifft.

## Befund fürs Instrument (Folgearbeit)

Diese Änderung selbst ist ein blinder Fleck des Audits: geänderte `docs/graph/*.graph.json` gelten
als „keine Quelldatei" und wählen **keinen** Test — obwohl `claims.conformance`, `graph-integrity`,
`harness.import` und `views.conformance` den Snapshot lesen. Datenabhängigkeit gehört ins Orakel
(Testdatei nennt den Snapshot-Pfad ⇒ gekoppelt). Bis dahin: Volllauf.

## Akzeptanzkriterien

- [x] Kein `codeRef` mit Wert mehr im Graphen (36 Grabsteine, 0 widersprüchliche Adressen)
- [x] Kein `case` mehr in `testRefs` (12 → 0)
- [x] MOD-Ebene gemessen statt geglaubt; Negativergebnis dokumentiert, Zustand zurückgenommen
- [x] Alle Änderungen durchs Gate (dryRun → apply, OCC-baseVersion je Batch), Export über den Owner
- [x] Gesamtsuite 846/847 — dieselbe Vorbestands-Rotstelle wie in CR-GC-381
      (`tests/distribution.test.ts`, `@sigloch/graph-view-edit@^0.6.0` ist nicht publiziert)

@author andreas@siglochconsulting
