# CR-GC-809: GVE haengt an der HostBridge statt am Export-Datei-Watcher

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-951 (finding)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-951.json (Lane: code)

---

Heute: emit.ts sendet nur invalidate ohne version; GVE beobachtet docs/graph/*.graph.json und laedt 0,9 MB voll neu (250+150 ms Debounce). Ziel: GVE abonniert host.ts /events, liest Daten aus derselben Quelle (sonst Flackern Event vor Datei), SSE-id = graphVersion (nicht Bridge-Zaehler), Reconnect bei Host-Wechsel ueber owner.lock, Vollreload bei Versionsluecke. Events versioniert, unbekannte Typen ignorieren. Delta statt Vollreload (applyDelta) erst bei gemessenem Bedarf.

---

## Einordnung

**Menge A — Viewer-Kommunikation mit einem Schreiber (Prio 1).** Reihenfolge: CR-GC-808 · CR-GC-809 → CR-GVE-356 · CR-GC-810 → CR-GVE-357 · CR-GVE-358.

Position 2 von 12. Producer zu CR-GVE-356. Der post-apply-Hook bekommt geänderte uids + graphVersion — dieselbe Stelle nutzen CR-GC-811/812, nur einmal bauen.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
