# CR-GC-381 — Messinstrument für die selektive Testauswahl

**Status:** open · **Angelegt:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests (CR-GC-380)

## Problem

Der Spike hat die Lage einmal vermessen — von Hand, in Wegwerf-Skripten. Die Modellarbeit, die
daraus folgt (CR-GC-382/383), braucht aber ein **wiederholbares** Instrument: ohne Vorher/Nachher
ist nicht entscheidbar, ob die Vertiefung wirkt, und das A/B vor der späteren Verdrahtung wäre
Meinung statt Messung.

Zweite Hälfte des Problems: das Instrument muss dieselbe Auswahl-Semantik benutzen wie
`graph_tests`. Eine nachgebaute Traversierung im Messskript wäre ein paralleler Pfad — die Messung
könnte grün melden, was der Produktionspfad anders sieht.

## Lösung

**Ein Traversal, zwei Aufrufer.** `impactedTests(graph, changeSet, depth)` wird als reine Funktion
aus `harness.testImpact()` herausgezogen. Der Store-Pfad (`graph_tests` → Harness → Kuzu) und der
Snapshot-Pfad (Audit → committetes JSON) rufen dieselbe Funktion; ein Paritätstest fährt denselben
ChangeSet über beide Wege gegen dieselbe Fixture.

`testImpact()` liest den Graphen jetzt in **einem** `loadGraph()` statt hop-weise über
`getSubgraph()` — dieselbe Store-Primitive, die `listElements()` benutzt. Verhalten unverändert
(bewiesen durch `tests/mcp.tests-deduction.test.ts`, unangetastet grün), Begründung aus CR-GC-204
bleibt gültig: es ist eine gefilterte Sicht auf eine Graph-Lesung, kein zweiter Blast-Radius.

**Die Fallback-Regel ist Teil des Instruments, nicht des späteren Runners.** `selectForChange()`
liefert bei jeder nicht auflösbaren geänderten Datei — kein Knoten, oder ein Trigger wie
`package.json`/`package-lock.json`/`tsconfig`/`vitest.config` — die **volle** Testliste. Eine leere
Auswahl darf nie zu `--passWithNoTests` werden; genau das tut `graph_tests` heute noch, gemessen an
`src/upgrade.ts`.

## Änderungen

| Datei | Was |
|---|---|
| `src/test-selection.ts` | **neu** — `impactedTests()`, die Kantensemantik (`satisfy` out, `allocate` in, `verify` in) als SSOT |
| `src/harness.ts` | `testImpact()` delegiert; die hop-weise Eigenimplementierung entfällt (55 Zeilen weniger) |
| `src/test-selection-audit.ts` | **neu** — M1/M2/M3/M8, Auswahl-Policy mit Fallback, Direkt-Import-Orakel |
| `scripts/test-selection-audit.mjs` | **neu** — dünner Runner über `dist/` (Muster `export-graph.mjs`), `--commits n`, `--json` |
| `tests/test-selection.audit.test.ts` | **neu** — 12 Fälle: Kantensemantik, Parität Store↔Snapshot, Fallback, Zählung gegen das echte Repo |
| diese CR-Datei | |

## Messwerte beim Anlegen (Baseline für CR-GC-382/383)

```
M1 Quellseite   19/65 Dateien modelliert (29 %)
M3 Testseite    49/106 Dateien verankert (46 %)
M2 Recall       17/128 direkt gekoppelte Tests getroffen (13 %), Auswahl 35
M8 Potenzial    2975 statt 6360 Dateiläufe über 60 Commits (53 % weniger)
   Decke        1639 Dateiläufe (74 % weniger), wenn jede geänderte Datei einen Knoten hätte
```

Zwei Zahlen bei M8, bewusst: **53 %** ist, was die Auswahl mit dem heutigen Modell und ehrlichem
Fallback spart; **74 %** ist die Decke bei vollständigem Modell. Die Differenz ist exakt der Preis
der 46 unmodellierten Quelldateien — und damit die Rechtfertigung für CR-GC-382/383. Der Spike
nannte 78 %, weil seine Wegwerf-Rechnung `package-lock.json` nicht als Volllauf-Trigger führte; die
Zahl des Instruments ist die verbindliche.

## Rot-zuerst-Nachweis

Beide tragenden Zusicherungen wurden durch Mutation als wirksam nachgewiesen, nicht nur grün
beobachtet:

| Mutation | erwartet rot | beobachtet |
|---|---|---|
| Fallback entfernt (`files` immer die Teilauswahl) | die zwei Volllauf-Fälle | 2 rot, 10 grün |
| `allocate`-Hop deaktiviert | MOD→TEST-Kette + Parität | 2 rot, 10 grün |

## Nicht in diesem CR

- **Keine Verdrahtung.** `npm test` bleibt der Volllauf, CI bleibt unverändert. Die Entscheidung
  fällt nach CR-GC-382/383 anhand des Falsifikationskriteriums (Spike §6: Recall ≥ 60 %).
- **`graph_tests` bleibt wie es ist** — inklusive `--passWithNoTests`. Das zu ändern ist Teil der
  Verdrahtungs-Entscheidung, nicht des Instruments.

## Akzeptanzkriterien

- [x] `impactedTests()` ist die einzige Implementierung der Auswahl-Semantik (kein zweiter Traversal)
- [x] Paritätstest Store-Pfad ↔ Snapshot-Pfad auf realem Disk-Kuzu
- [x] Nicht auflösbare Datei ⇒ volle Testliste, nie die leere Menge
- [x] Keine festen Dateizahlen in den Tests (jede Zählung aus dem Repo abgeleitet)
- [x] `tests/mcp.tests-deduction.test.ts` unverändert grün (Refactor-Sicherung)
- [x] `npm run build` grün, Suite 846/847 — **eine** Vorbestands-Rotstelle, nicht aus diesem CR:
      `tests/distribution.test.ts` scheitert an `@sigloch/graph-view-edit@^0.6.0` (npm kennt nur bis
      0.5.0; der Dep-Bump liegt uncommitted im Arbeitsbaum und ist dieselbe Ursache wie die zuletzt
      roten CI-Läufe). Gehört in einen eigenen CR: publishen oder Range zurücknehmen.

@author andreas@siglochconsulting
