# CR-GC-503: harness.ts: der Graph-Zustand hat viele Schreiber in einer Klasse

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-035 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-035.json (Lane: code)

---

BEFUND: FLOW-graph-state hat 9 Produzenten, 7 davon in src/kernel/harness.ts (816 Zeilen): loadGraph, persist, reseed, seedFromJson, mutate, close, open. Verwandt: ITEM-2026-027 (grosse Dateien).
ZIEL: Zustand und Lebenszyklus bei EINEM Besitzer, Gate und Abfrage davon getrennt, harness.ts unter 500 Zeilen. Modell: graph-state hat einen Produzenten.
