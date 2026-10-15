# CR-GC-811: OCC je Element statt je Graph (Voraussetzung fuer ITEM-2026-958, Mehr-Schreiber spaeter)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-954 (idea)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-954.json (Lane: code)

---

occReject (tool-context.ts) lehnt heute bei jeder Aenderung seit baseVersion ab. Granularitaet: Knoten per uid, Kanten per Schluessel (nicht Endpunkte, sonst kollidiert jede Kante am SYS). Optional Lesemenge (read set) neben der Schreibmenge. Geloeschter Endpunkt faengt das Gate. Kein contracts-Bump noetig (staleDelta.changedUids reicht). Nicht mehr nur zurueckgestellt: ITEM-2026-958 nutzt dieselbe Pruefung als Dirty-Zustand fuer vorberechnete Vorschlaege - auch bei einem einzigen Schreiber.

---

## Einordnung

**Menge B — vorberechnete REQ-Vorschläge (Prio 2).** Reihenfolge: CR-GC-811 → CR-GC-812 → CR-GVE-359. Setzt aus Menge A voraus: CR-GC-809 (geänderte uids im post-apply-Hook), CR-GVE-357 (Vorschau-Overlay).

Position 7 von 12. Erster CR der Menge B. Die Prüfung je Element ist zugleich der Dirty-Zustand von CR-GC-812 und die Grundlage für CR-GVE-360.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
