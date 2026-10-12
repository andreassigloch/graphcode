# CR-GC-796: Store: beschaedigte Datei wird beim Oeffnen nicht neu aufgebaut (REQ-store-recovery, S 9)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-855 (bug)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-855.json (Lane: code)

---

GraphStore.open() baut einen Store nur bei Schema-Versatz neu auf (src/kernel/graph-store.ts:86-103). Ist die Kuzu-Datei beschaedigt und der Fingerabdruck passt, wirft storage.initialize() oder load(); open() gibt die Sperre frei und reicht den Fehler weiter (:99-107). REQ-store-recovery (Gegenmassnahme zu REQ-risk-store-unreadable, S 9) verlangt den Neuaufbau aus dem committeten Snapshot. Kein Test prueft eine beschaedigte Datei; TEST-store-recovery ist ungebunden. Umfang: Reproduktion als Test (beschaedigte Store-Datei auf Platte), Neuaufbau im selben Weg wie bei Schema-Versatz, TEST-store-recovery binden. Quelle: FMEA zweiter Lauf, FM-04; CR-GC-794 Befund 1.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
