# CR-GC-884: applyCommands wandert nach graph-api-core, dazu die Abbildung von nodes/edges auf elements/traces: Host und Viewer nutzen dieselbe Funktion

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1150 (finding)
**Erstellt:** 2026-11-01
**Item:** bok/items/ITEM-2026-1150.json (Lane: code)

---

**Bezug:** `graph-view-edit/docs/project/konzept-live-update.md`. Gegenstück zu CR-SM-427.

## Zielbild

`graphcode` importiert `applyCommands` aus `graph-api-core` und löscht `src/kernel/apply-commands.ts` samt Modellbindung (`/se-umbau`). Kein zweiter Pfad bleibt stehen.

## Akzeptanz

- [x] `grep applyCommands src/kernel` findet nur noch Aufrufer.
- [x] Gate-Tests grün, `realRef` der betroffenen FUNC umgehängt.

---

## Umsetzung 2026-11-01

**Abweichung vom Zielbild:** `src/kernel/apply-commands.ts` bleibt (siehe CR-SM-427). Der Exporter nutzt `toExportedGraph` aus `graph-api-core`, seine eigene Abbildung ist gelöscht; `GraphDelta` kommt von dort. `GraphDeltaSchema` bleibt hier, weil `SCHEMA-graph-delta` darauf gebunden ist (RC-03, RC-08).

## Umfang

`src/projections/exporter.ts`, `src/kernel/graph-store.ts`
