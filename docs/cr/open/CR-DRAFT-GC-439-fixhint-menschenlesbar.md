# CR-GC-439 — Das Dashboard druckt Agenten-Anweisungen an Menschen

**Status:** Draft
**Datum:** 2026-08-27
**Herkunft:** Anhangsbefund 1 aus CR-GC-402 (`docs/cr/done/CR-DRAFT-GC-402-dashboard-zweite-wahrheit.md`),
dort bewusst NICHT mitumgesetzt.

## Problem

`recommendationsPanel()` reicht `fixHint` unverändert durch, und das Panel zeigt sie:

> „Add attributes.testRefs [{file, case?, tool, level?}, …] with at least one entry"

Das ist eine Anweisung an eine Maschine, adressiert an einen Menschen. Dasselbe
Register-Problem hat `graph_help`: es liefert `plain`, `se` und `prompt` in EINER
Antwort, und die Steering-Datei schickt den *Menschen* dorthin.

Folge in der Praxis: die Kundenvorführung zeigt bewusst die gedruckten Dokumente
statt des Dashboards.

## Soll

- Mensch-Oberflächen zeigen nur die `plain`-Schicht.
- `fixHint` bekommt ein menschenlesbares Gegenstück — **oder** das Panel zeigt statt
  der Anweisung die Entscheidung, die ansteht.
- Kein zweiter Regeltext-Katalog: das Gegenstück gehört dorthin, wo `fixHint`
  entsteht (contracts), nicht in den Viewer.

## Dateien (Kandidaten, vor Umsetzung schneiden)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/contracts/src/se/…-rules.ts` | menschenlesbares Gegenstück zu `fix_hint` (Feld + Versions-Bump) |
| sigloch-modules | `packages/graphcode-client/src/panels.ts` | `recommendationsPanel` reicht die Plain-Schicht durch |
| graphcode | `src/viewer/help.ts` / `help-content.ts` | Mensch-Fläche liefert `plain`, nicht alle drei Schichten |
| graph-view-edit | `src/dashboard/Dashboard.jsx` | Anzeige der Plain-Schicht |

## Offene Entscheidung

Menschenlesbares Gegenstück **am Regelbefund** (contracts, wandert überallhin mit)
oder **Umformulierung an der Oberfläche** (kein Contracts-Bump, aber ein zweiter
Textort). Erst entscheiden, dann schneiden.
