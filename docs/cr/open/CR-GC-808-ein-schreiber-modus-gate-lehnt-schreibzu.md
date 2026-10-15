# CR-GC-808: Ein-Schreiber-Modus: Gate lehnt Schreibzugriffe nicht erlaubter Clients ab

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-950 (idea)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-950.json (Lane: code)

---

Harness-Config listet erlaubte Schreiber (consumerId). Modus 1 = nur Agent, GVE nur lesend; Modus 2 (spaeter) = GVE-Chat ist Lead. Durchgesetzt im Gate, nicht per Konvention. Mehr-Schreiber spaeter nur andere Konfiguration. Herkunft: Abgleich graphengine-Kommunikationskonzept 2026-10-15.

---

## Einordnung

**Menge A — Viewer-Kommunikation mit einem Schreiber (Prio 1).** Reihenfolge: CR-GC-808 · CR-GC-809 → CR-GVE-356 · CR-GC-810 → CR-GVE-357 · CR-GVE-358.

Position 1 von 12. Unabhängig, kann zuerst. Liefert die Liste erlaubter Schreiber, die CR-GVE-361 (Modus 2) nur umstellt.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
