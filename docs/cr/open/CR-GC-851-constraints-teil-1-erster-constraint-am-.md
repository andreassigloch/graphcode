# CR-GC-851: Constraints Teil 1: erster Constraint am eigenen Modell mit Snapshot-Test und Positivkontrolle

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1058 (idea)
**Erstellt:** 2026-10-25
**Item:** bok/items/ITEM-2026-1058.json (Lane: code)

---

Teil 1 von CR-GC-804 (Schnitt 2026-10-25, Regel max. 10 Dateien je CR). Die Entscheidungen 1, 3 und 5 aus
CR-GC-804 gelten unverändert; der Konzepttext steht dort (`docs/cr/done/CR-GC-804-…`).

## Ziel

Der erste Constraint am eigenen Modell, mit der Mechanik aus CR-GC-804: eine nicht-funktionale REQ am
Adressaten (FUNC, MOD, FCHAIN oder SYS, Kante `satisfy`), ein TEST mit `verify` und `testRef` auf eine
Testdatei, die den committeten Snapshot `docs/graph/graphcode.graph.json` liest und die Eigenschaft prüft.
Der Test ist das Messinstrument; kein `measured*`-Attribut.

## Offen vor dem Bau (Entscheidung des Autors)

Welcher Constraint, an welchem Element. CR-GC-804 nennt nur Beispiele („Kette in einem Modul",
„Modul gesichert", Budget an der Kette); die Wahl ist eine Projektentscheidung. Ohne sie baut dieser CR nicht.
`se:author-req` legt REQ und TEST an; der Skill `se-constraints` (CR-GC-852) ist dafür nicht nötig.

## Umfang (Dateien)

1. `tests/constraint-<name>.test.ts` (neu) — liest den Snapshot, prüft den Constraint; Positivkontrolle im
   selben Test: eine Kopie des Snapshots mit einem verletzenden Zug macht die Prüfung rot.
2. `scripts/model-test-set.mjs` — Eintrag in `INCLUDED` (Weg A, Entscheidung 5); der
   Vollständigkeits-Test erzwingt ihn über das Muster `graph.json`.
3. dieser CR.

Modell: REQ + TEST + `satisfy`/`verify` per `graph_mutate`, danach `graph_export`.

## Akzeptanzkriterien

- Der Constraint-Test ist am heutigen Modell grün.
- Die Positivkontrolle ist rot für den verletzenden Zug und nennt das verletzende Element.
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
