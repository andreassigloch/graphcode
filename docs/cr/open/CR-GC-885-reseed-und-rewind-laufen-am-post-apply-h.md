# CR-GC-885: reseed und rewind laufen am post-apply-Hook vorbei: ohne Datei-Watcher erfaehrt der Viewer nichts davon

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1151 (bug)
**Erstellt:** 2026-11-01
**Item:** bok/items/ITEM-2026-1151.json (Lane: code)

---

**Bezug:** `graph-view-edit/docs/project/konzept-live-update.md`, Abschnitt „Nebenwirkungen“. Gegenstück zu CR-GVE-392.

## Befund

`harness.reseed` ruft `applyReseed` direkt auf. `runPostApplyHooks` feuert nur in `gate.ts`. `graphcode rewind` und `graph_reseed` lösen also kein Event aus. Heute fällt das nicht auf, weil der Datei-Watcher den Viewer weckt, sofern die Datei sich ändert.

## Zielbild

Nach `reseed` sendet der Host ein eigenes Event `reset` mit `graphVersion`. Zu klären: Steigt `graphVersion` bei einem Reseed?

## Akzeptanz

- [x] Roter Test zuerst: Reseed am Host erzeugt genau ein Event `reset`.
- [x] Die Version verhält sich so, dass der Viewer den Stand als neu erkennt.

---

## Umsetzung 2026-11-01

`harness.reseed` feuert die neue Hook-Phase `post-reset`, `emit.ts` sendet genau ein Event `reset`. **Entscheidung:** `graphVersion` steigt beim Reseed nicht; der Viewer erkennt den neuen Stand am Typ `reset`.

## Umfang

`src/kernel/hooks.ts`, `src/kernel/harness.ts`, `src/surface/emit.ts`, `tests/live-feed.test.ts`
