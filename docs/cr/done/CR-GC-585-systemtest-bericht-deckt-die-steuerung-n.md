# CR-GC-585: Systemtest-Bericht deckt die Steuerung nicht ab: Kanal-Wirkung, Zeitlinie, Navigation Graph vs Datei (grep/glob), Effizienz je Element und Endstand der Freigabe wurden in Runde 7/8 mit Wegwerf-Skripten erhoben — gehoert in report.mjs

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-434 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-434.json (Lane: graph)

---

## 1 Befund

Die Fragen, an denen jede Optimierungsrunde haengt — hat ein Kanal gewirkt, kam er vor oder nach
der Entscheidung, navigiert der Agent ueber den Graphen oder ueber grep/glob, was kostet ein
Element, warum kein done — beantwortete `report.mjs` nicht. In Runde 7/8 wurden sie mit fuenf
Wegwerf-Skripten im Scratchpad erhoben, jedes mit eigenem Stream-Parser. Der Systemtest misst
damit nicht, was er optimieren soll.

## 2 Umsetzung

- `rig/greenfield-systemtest/steuerung.mjs`: `leseStrom` (auf `zeilen()` aus turn-analyse.mjs —
  ein Parser, dedupliziert je tool_use-id), `kanalWirkung`, `zeitlinie`, `navigation`,
  `effizienz`, `endstand`, `steuerungsBericht`.
- `report.mjs`: neuer Abschnitt "Steuerung — hat sie gesteuert?" fuer jeden Lauf mit Strom
  (Claude-Code-Arm; Fokus graphcode ueber MCP, der Executor folgt spaeter).
- Navigation klassiert Dateizugriffe nach Ziel: Auftrag und Doku sind legitim, Sichten heisst
  "Graph ueber Markdown gelesen", Werkzeug-Quelltext heisst "der Guide hat etwas nicht gesagt".
- Abnahme `tests/systemtest-rig.test.ts`: synthetischer Strom auf Platte, jede Kennzahl von Hand
  abzaehlbar, inkl. doppeltem Strom-Ereignis (CR-GC-567).

Gegen die Handzaehlung aus Runde 7 abgeglichen (Fokus 12/12, 18/19, 16/21; Proben 6/6/8;
workOrder 4/7/7; Graph-Anteil 0,59 / 0,60 / 0,31, Lauf 9 nach CR-GC-581: 0,86).

## 3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Die fuenf Fragen stehen im Standardbericht, nicht in Skripten | erfuellt |
| 2 | Ein Parser (turn-analyse), getestet gegen einen bekannten Strom | erfuellt |
| 3 | Reproduziert die Handzaehlung von Runde 7 | erfuellt |

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme.
