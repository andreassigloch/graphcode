# CR-GC-810: viewer_show: Agent setzt Ansicht, Fokus und Vorschau-Overlay im Viewer

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-952 (idea)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-952.json (Lane: code)

---

MCP-Tool viewer_show {view, focus?, select?, preview?, repo}. graphcode liest dashboard.url, POST an GVE /api/navigate, SSE-Event navigate. GVE: viewer-store navigate(), ?focus= URL-Param, Wirkketten-Fokus (chain-focus.mjs) von aussen erreichbar. preview = dryRun-Batch als Overlay (reiner Anzeigezustand, kein Schreibzugriff); Annahme in Modus 1 im Chat, Agent wendet an. Repo-Kennung: GVE verwirft Befehle fremder Worktrees. graphengine hatte das nicht (nur TUI /view).

---

## Einordnung

**Menge A — Viewer-Kommunikation mit einem Schreiber (Prio 1).** Reihenfolge: CR-GC-808 · CR-GC-809 → CR-GVE-356 · CR-GC-810 → CR-GVE-357 · CR-GVE-358.

Position 4 von 12. Producer zu CR-GVE-357 (Tool viewer_show). Unabhängig von CR-GC-809.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
