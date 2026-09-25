# CR-GC-664: Executor: fast jede Runde beginnt mit graph_elements {type:UC} — die Fund-Liste zeigt keine UC-Uebersicht

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-567 (finding)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-567.json (Lane: code)

---

## Befund

gcrun-120..122: die erste Werkzeug-Abfrage einer Runde ist in 24 von 36 Runden
`graph_elements {type:UC}`. Die Fund-Liste (CR-GC-652) zeigt UCs nur, wenn sie Besitzer des Funds sind.

## Umsetzung

Die Fund-Liste traegt eine Zeile „UCs im Modell: uid (Name), …" — gedeckelt auf 20, keine Zeile je
Knoten, keine Beschreibung. Die Knoten sind dort ohnehin geladen.

## Dateien (3)

`src/loop/executor-inventory.ts`, `tests/executor.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Am echten Store: die Uebersicht steht in der Fund-Liste, der UC nicht als Kontextzeile.
- [ ] Rig (gcrun, N=3) gegen gcrun-120..122: `graph_elements {type:UC}` je Lauf deutlich weniger.
      Gemeinsam mit CR-GC-663 (anderer Zaehler).
