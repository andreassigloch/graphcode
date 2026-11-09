# CR-GC-879: scaffold update/remove entfernen se-Dateien, die das Paket nicht mehr ausliefert (se-view, trade aus CR-GC-756)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1116 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1116.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
