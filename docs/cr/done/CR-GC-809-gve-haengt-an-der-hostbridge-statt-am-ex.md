# CR-GC-809: GVE haengt an der HostBridge statt am Export-Datei-Watcher

**Status:** ✅ Done (2026-11-02)
**Typ:** aus Item ITEM-2026-951 (finding)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-951.json (Lane: code)

---

Heute: emit.ts sendet nur invalidate ohne version; GVE beobachtet docs/graph/*.graph.json und laedt 0,9 MB voll neu (250+150 ms Debounce). Ziel: GVE abonniert host.ts /events, liest Daten aus derselben Quelle (sonst Flackern Event vor Datei), SSE-id = graphVersion (nicht Bridge-Zaehler), Reconnect bei Host-Wechsel ueber owner.lock, Vollreload bei Versionsluecke. Events versioniert, unbekannte Typen ignorieren.

**Stand 2026-11-01:** Der Bedarf ist gemessen, das Delta kommt. Vorgaben und Messwerte: `graph-view-edit/docs/project/konzept-live-update.md`; bei Widerspruch gilt das Konzept. Für diesen CR heißt das: (1) Das Event trägt `graphVersion` plus die Wirkung als Format-E, serialisiert aus dem `GraphDelta` von `applyCommands`, inklusive Kaskaden und Merges. `applyCommands` wandert nach `graph-api-core`. (2) Es geht erst nach `recordAudit` raus, weil der post-apply-Hook die neue Version noch nicht kennt (`tool-context.ts:370`). (3) Die Bridge `/events` läuft ohne `GRAPHCODE_HOST_PORT`. (4) Der Host liefert den ganzen Graphen samt `graphVersion` für Start und Versionslücke. CR-GC-808 ist dafür keine Voraussetzung.

---

## Einordnung

**Menge A — Viewer-Kommunikation mit einem Schreiber (Prio 1).** Reihenfolge: CR-GC-808 · CR-GC-809 → CR-GVE-356 · CR-GC-810 → CR-GVE-357 · CR-GVE-358.

Position 2 von 12. Producer zu CR-GVE-356. Der post-apply-Hook bekommt geänderte uids + graphVersion — dieselbe Stelle nutzen CR-GC-811/812, nur einmal bauen.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umsetzung 2026-11-01

Das Event trägt Version und Wirkung als Format-E. **Abweichungen vom Stand-Vermerk:** (1) Es geht aus dem post-apply-Hook, nicht nach `recordAudit`: Writes sind serialisiert, die Version steht vorher fest, und ein Fehlschlag im Audit endet beim nächsten Event im ganzen Lesen. (2) Das Abo läuft über `host.sock` (`__subscribe`, `live-feed.ts`), nicht über die HTTP-Bridge; `/events` bleibt opt-in. (3) Den ganzen Graphen liefert der erste Eintrag des Abos, ohne neues Tool. Grenze: `MAX_DELTA_CHANGES` = 5.000.

## Umfang

`src/surface/live-feed.ts`, `src/surface/emit.ts`, `src/surface/host-shim.ts`, `src/surface/mcp-server.ts`, `src/surface/tool-context.ts`, `src/kernel/hooks.ts`, `src/kernel/gate.ts`, `tests/live-feed.test.ts`
