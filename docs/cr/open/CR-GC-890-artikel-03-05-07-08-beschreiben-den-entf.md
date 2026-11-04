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

## Ergebnis (2026-11-04)

- **03:** Stack-Zeile „Local execution“ und Abschnitt „Two ways to run the loop“ ersetzt durch „Who runs the loop“: ein Weg (Coding-Assistent über MCP), ein lokales Modell folgt dem `vorschlag` je Schreibzug; der Executor als ein Satz Historie mit Tag `executor-geparkt-2026-10-09`.
- **05:** war schon als Historie markiert; nur der Verweis auf die umbenannte Überschrift in 03 nachgezogen.
- **07:** „der Driver“ ist heute das Modell im Assistenten; die gemessenen Läufe als Läufe des früheren Executors benannt; Verweis auf den Executor-Bericht (liegt seit CR-GC-888 privat) entfernt.
- **08:** „driver mode“ als historisch markiert; „turn“ in Vergangenheit; „instruction“ neu definiert.
- **02:** ins Englische übersetzt; den Platzhalter „Titelbild (folgt)“ gestrichen.
- **docs/views/README.md:** `se-view:conops` (entfernt mit CR-GC-876) ersetzt durch `graph_export`.
- **Abnahme:** `grep -nE 'graphcode run|built-in executor|driver mode|se-view'` trifft nur noch markierte Historie (03 Z. 45, 05 Tabelle und Abschnitt „Prompt anatomy“, 07 Z. 35, 08 Glossar). Alle relativen Links in `docs/articles/` lösen auf. 02 englisch.
- **Tests:** `verify:full CR-GC-890` 1701/1701, Schlupf 0.
- **Nicht gepusht.**
