# CR-GC-664: Executor: fast jede Runde beginnt mit graph_elements {type:UC} — die Fund-Liste zeigt keine UC-Uebersicht

**Status:** ⛔ Zurueckgenommen nach Messung (2026-09-25)
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
- [x] Rig — Ziel verfehlt, zurueckgenommen: (gcrun, N=3) gegen gcrun-120..122: `graph_elements {type:UC}` je Lauf deutlich weniger.
      Gemeinsam mit CR-GC-663 (anderer Zaehler).

## Rig-Messung und Entscheidung (2026-09-25, `results-runde19-gcrun-663-664.json`, gcrun-140..142)

Gemeinsam gemessen mit CR-GC-663:

| | 660+661 | 663+664 |
|---|---:|---:|
| `read_file material/auftrag.md` (3 Laeufe) | 35 | 32 |
| `graph_elements {type:UC}` (3 Laeufe) | 32 | 33 |
| Aufrufe je Runde | 3,3–4,0 | 3,3–3,8 |
| Tokens ein / Laufzeit | 197k / 215 s | **272k / 305 s** |
| Readiness req / uc | .83 / .80 | .89 / .88 |

**Ziel verfehlt, zurueckgenommen.** Das Modell liest den Auftrag und fragt die UCs auch dann ab, wenn
beides im Prompt steht — kein Informationsmangel, eine Gewohnheit (vgl. CR-GC-653: Hinweise aendern
das Verhalten nicht). Der mitgegebene Auftrag kostet dafuer 4,8k Zeichen in jedem Aufruf (+38 %
Eingabe). Die hoehere Readiness liegt im Bereich, den schon 658/659 erreichte (.89/.85), und ist
diesen CRs nicht zuzuschreiben. Code auf den Stand vor `8b7ea5a` zurueckgesetzt.
