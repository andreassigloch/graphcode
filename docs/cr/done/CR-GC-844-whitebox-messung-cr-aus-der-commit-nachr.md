# CR-GC-844: whitebox-messung: CR aus der Commit-Nachricht statt aus commitRef

**Status:** ✅ Done (2026-10-23)
**Typ:** aus Item ITEM-2026-1029 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1029.json (Lane: code)

---

## Befund

`verify:full` für CR-GC-841 und CR-GC-842 war rot an `tests/whitebox-messung.test.ts`: „die Historie liefert Jobs" fand 0 Jobs.

- **Root Cause:** `jobsAusHistorie` nahm nur CRs mit dem Attribut `commitRef`. Das schreibt seit BOK-CR-060 niemand mehr; der jüngste CR damit ist CR-GC-779.
- **Folge:** die Commits, auf die ein `commitRef` zeigt, rutschten mit jedem neuen Commit an der SSOT nach hinten. Der letzte brauchbare (CR-GC-732) stand nach den Commits vom 2026-10-22 auf Platz 121, das Fenster ist 120.
- **Impact:** die Messung T-E2 (Leitlinie §9.4) bekam seit CR-GC-779 keinen neuen Job. Rot wurde der Test erst jetzt, mit dem Fenster.

## Änderung

`scripts/whitebox-messung.mjs`: der CR eines Commits kommt aus der Commit-Nachricht, `(CR-GC-NNN)`, wenn der CR im heutigen Modell steht. Den Weg über `commitRef` gibt es nicht mehr.

Ergebnis am Stand 2026-10-22: 10 Jobs, CR-GC-832 bis CR-GC-842.

## Umfang

Keine relation-Kante: die Mess-Skripte sind Messaufbau außerhalb des Produkts (CR-GC-760) und haben keinen Knoten.

## Prüfung

- `tests/whitebox-messung.test.ts`, `tests/messung.test.ts` grün.
