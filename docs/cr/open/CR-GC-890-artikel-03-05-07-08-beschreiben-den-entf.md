# CR-GC-890: Artikel 03/05/07/08 beschreiben den entfernten Executor, Artikel 02 ist deutsch

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1182 (finding)
**Erstellt:** 2026-11-03
**Item:** bok/items/ITEM-2026-1182.json (Lane: graph)

---

## Befund

Vier Artikel in `docs/articles/` beschreiben den Executor, der am 2026-10-09 aus dem Kern entfernt wurde (Tag `executor-geparkt-2026-10-09`):
- `03-graphcode-harness-goal-and-concept.md`: Zeile 31, 44 ff. (`graphcode run` als „built-in executor“)
- `05-the-advisory-roundtrip.md`: Zeile 133 (`@sigloch/se-optimizer@0.4.0`), 148–153 (Spalte „Driver“)
- `07-the-scoring-landscape.md`: Zeile 34, 46, 195, 220
- `08-glossary.md`: Zeile 41 („driver mode“)

`02-vorgaben-als-modell.md` ist deutsch, alle anderen Artikel sind englisch.

Dazu `docs/views/README.md` Zeile 40: nennt `se-view:conops`, das mit CR-GC-876 entfernt wurde.

## Ziel

Die Artikel beschreiben den heutigen Stand: zwei Clients (Claude Code, OpenCode) schreiben selbst durchs Gate. Executor-Passagen fallen weg oder werden zu einem Satz Historie mit Verweis auf den Tag. `02` wird ins Englische übersetzt. Verweise auf Dateien, die CR-GC-888 aus dem öffentlichen Repo nimmt, werden entfernt.

## Abnahme

- `grep -nE 'graphcode run|built-in executor|driver mode|se-view' docs/articles docs/views/README.md` ohne Treffer, außer einem markierten Historien-Satz.
- Jeder relative Link in `docs/articles/` zeigt auf eine öffentlich getrackte Datei.
- `02` englisch.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
