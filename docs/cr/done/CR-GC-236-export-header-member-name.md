# CR-GC-236 — Export-Header: Member-Name statt hartkodiertem "graphcode"

**Status:** done · 2026-07-05
**Quelle:** graph-view-edit Konzept-Review — Views eines Fremd-Repos tragen falsche Titel/SSOT-Pfade.

## Problem

`generatedHeader()` (`src/exporter.ts`) hartkodiert Titel-Präfix (`graphcode — …` / `GraphCode — Modell-Spezifikation`) und SSOT-Pfad (`docs/graph/graphcode.graph.json`). In einem Consumer-Repo mit `graph_export {name:'graph-view-edit'}` behaupten alle 16 Views den falschen SSOT (`graphcode.graph.json` statt `graph-view-edit.graph.json`) und den falschen Systemnamen.

## Änderung

`generatedHeader(title, subtitle)` bekommt den Export-Namen (bzw. `scope.systemId`) durchgereicht:
- Titel-Präfix = Member-/System-Name, nicht "graphcode".
- "Source of truth:"-Zeile + `> GENERATED from …` = tatsächlicher `docs/graph/<name>.graph.json`-Pfad des laufenden Exports.
- Determinismus unverändert (Name ist Teil des Export-Inputs, keine Zeit/Zufallsquelle).

## Betroffene Dateien (≤6)

1. `src/exporter.ts` — `generatedHeader` + Aufrufer (Signatur um `name` erweitern)
2. `src/exporter-views.ts` — Aufrufer der 12 Projektionen
3. bestehende Exporter-Tests — Goldmaster/Assertions auf Header-Zeilen nachziehen

## Akzeptanz

- [x] `graph_export {name:'X'}` → alle Views: Titel `X — …`, SSOT-Zeile `docs/graph/X.graph.json`
- [x] graphcode-eigener Export unverändert (`name` default = systemId "graphcode"; die 12 SE-Views sind byte-identisch, nur die 4 Foundation-Views verlieren das hartkodierte "GraphCode"-Präfix)
- [x] Byte-Determinismus: gleicher Graph + gleicher Name → identische Bytes
