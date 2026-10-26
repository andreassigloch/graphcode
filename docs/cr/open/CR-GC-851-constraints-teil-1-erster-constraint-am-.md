# CR-GC-851: Constraints Teil 1: erster Constraint am eigenen Modell mit Snapshot-Test und Positivkontrolle

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1058 (idea)
**Erstellt:** 2026-10-25, umgeschrieben 2026-10-26 (Konzept vom Auftraggeber freigegeben)
**Item:** bok/items/ITEM-2026-1058.json (Lane: code)

---

Teil 1 von CR-GC-804. Die Mechanik steht dort unverändert: ein Constraint ist eine nicht-funktionale REQ am
Element mit verifizierendem TEST, und die Testdatei liest den committeten Snapshot
`docs/graph/graphcode.graph.json`. Die Testauswahl folgt Weg A (Entscheidung 5).

## Konzept (2026-10-26)

**Architektur-bestimmend** ist ein Constraint, wenn ihn ein Zug am Modell brechen kann, ohne dass sich
Code-Verhalten ändert: Funktion verschieben, Fluss anlegen, Modul teilen.

**Prüffunktionen.** Jede Antwortform eines Constraints bekommt eine Prüffunktion in `src/kernel/measure/`.
Der Subpath `@sigloch/graphcode/constraints` exportiert sie, damit Constraint-Tests anderer Repos dieselben
Funktionen nutzen. Misst contracts schon (LCOM4, kreuzende Flüsse, Kettenkennzahlen), ruft die Prüffunktion
diese Messung und rechnet nicht nach. Die Bibliothek wächst je Constraint; dieser CR bringt die erste.

## Der Constraint: „Ein Schreibweg"

Adressat ist `FUNC-graph-store`. Anker: CLAUDE.md „Gate-only writes" (gate-only-writes), die Regel „Keine
parallelen Pfade" und der erste Punkt der „Locked constraints" (ein Store, ein Besitzer-Prozess).

Inhalt kommt in den Store nur über diese sechs Flüsse. Stand graphVersion 904, geprüft per `graph_get_edges`
auf `FUNC-graph-store` (Richtung ein, Typ `io`) und je Fluss auf seinen Absender:

| Fluss | Absender | Zweck |
|---|---|---|
| `FLOW-graph-delta` | `FUNC-mutate` | jede Änderung durch das Apply-Gate |
| `FLOW-imported-graph` | `FUNC-import` | Import-Operation: ein ganzer Graph ersetzt den Store |
| `FLOW-store-build` | `FUNC-create-harness` | Store öffnen |
| `FLOW-store-close` | `FUNC-serve-stdio` | Store schließen (MCP-Host) |
| `FLOW-store-close-cli` | `FUNC-cli-dispatch` | Store schließen (CLI) |
| `FLOW-store-close-rewind` | `FUNC-rewind` | Store schließen vor dem Zurückspulen |

Ein Zug, der einen siebten Fluss in `FUNC-graph-store` legt, bricht den Constraint, auch wenn kein Code
sich ändert. Genau dieser Zug ist die Positivkontrolle.

## Prüffunktion

„Eingänge eines Elements nur aus der erlaubten Liste": bekommt Graph, Element und die erlaubten Flüsse und
meldet zwei Listen.

- jeden eingehenden Fluss außerhalb der Liste, mit seinen Absendern;
- jeden Fluss der Liste, der im Modell nicht mehr in das Element führt.

Beide Listen leer heißt grün. Sie ist eine Ratsche wie `tests/import-boundaries.test.ts`: ein siebter Fluss
ist rot, bis der Autor ihn in die Liste aufnimmt; ein entfallener Fluss ist rot, bis der Autor ihn streicht.
Die Lookups kommen aus dem Index von contracts (`indexOf`), nicht aus eigenen Vollscans.

## Umfang (Dateien)

1. `src/kernel/measure/constraints.ts` (neu) — die Prüffunktion
2. `tests/constraint-ein-schreibweg.test.ts` (neu) — liest den Snapshot, ruft die Prüffunktion; Positivkontrolle
   im selben Test: eine Kopie des Snapshots mit einem zusätzlichen Fluss von einer anderen FUNC in
   `FUNC-graph-store` ist rot und nennt den Absender
3. `package.json` — Subpath `./constraints` in `exports`
4. `tests/distribution.test.ts` — der Import `@sigloch/graphcode/constraints` gelingt aus dem gepackten Paket
5. `scripts/model-test-set.mjs` — Eintrag in `INCLUDED` (Weg A)
6. dieser CR

Modell per `graph_mutate`: `REQ-ein-schreibweg` (nicht-funktional) mit `FUNC-graph-store -satisfy->`, ein TEST
mit `testRefs` auf die Testdatei und `verify` auf die REQ, eine FUNC für die Prüffunktion mit `realRef` in
`MOD-kernel`. Danach `graph_export`.

## Akzeptanzkriterien

- Der Constraint-Test ist am heutigen Modell grün; vor der Prüffunktion war er rot.
- Die Positivkontrolle ist rot für den siebten Fluss und nennt dessen Absender.
- Ein Fluss der Liste, den es im Modell nicht gibt, ist rot.
- `import { … } from '@sigloch/graphcode/constraints'` gelingt in einem Fremdrepo aus dem gepackten Paket.
- `npm run verify:model` fährt den Test mit; `tests/verify-model.completeness.test.ts` ist grün.
- Der TEST-Knoten trägt `testRefs` mit Ergebnis aus der Test-Lane (CR-GC-800).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 889, Tiefe 1, Wurzeln: `REQ-model-lane-fixed-set`._

Reichweite: 1 Elemente (FUNC 1); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- scripts/verify-model.mjs

Tests (`graph_tests`, 1):
- tests/verify-model.completeness.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
