# CR-GC-638: Die graph_*-Lesewerkzeuge sind in Claude-Code-Sitzungen deferred: ihr Schema ist nicht geladen, ein Aufruf verlangt vorher ToolSearch, waehrend Bash immer bereitliegt. Gemessen am Referenz-Change: 2 ToolSearch-Aufrufe insgesamt, beide fuer graph_mutate (Schreiben, wo es keinen Ersatz gibt) - fuers Lesen gewinnt grep, weil es keinen Vorlauf kostet. Die Werkzeugtabelle in CLAUDE.md koennte die ToolSearch-Abfrage mitliefern

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-521 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-521.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
