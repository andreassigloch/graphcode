# CR-GC-880: Antwortweg: Ausnahme Nachbarkette (CR-SM-423) in Hilfetext, se-vorbereitung und se-laufzeit nachziehen

**Status:** ✅ Done (2026-10-29)
**Typ:** aus Item ITEM-2026-1120 (finding)
**Erstellt:** 2026-10-29
**Item:** bok/items/ITEM-2026-1120.json (Lane: code)

---

## Befund

sigloch-modules CR-SM-423 änderte die Rechnung des Antwortwegs: Ein Fluss mit `sync` von einer Funktion außerhalb der
Kette hindert nicht, wenn Erzeuger und wartendes Glied beide in einer anderen Kette liegen. Hilfetext und Skills
sagten weiter „hindert immer“. `se-vorbereitung` schickte den Autor deshalb zu einem Umbau („die Funktion wird Glied“),
den die Rechnung nicht mehr verlangt.

Der Test `skill-laufzeit-antwortweg` zeigte die Grenze der Regel: Wartet das Glied bei jedem Aufruf auf den Erzeuger,
fehlt dieser auf dem Weg. Andreas entschied: die Regel bleibt, der Fall wird sichtbar (CR-SM-424, Feld
`answerPathSkipped`).

## Änderung

| Datei | Änderung |
|---|---|
| `.claude/commands/se-vorbereitung.md` | Version 8. Schritt 3: Ausnahme Nachbarkette; je Fluss aus `answerPathSkipped` den Code lesen (Verteiler → kein Zug; Warten bei jedem Aufruf → Erzeuger wird Glied; ungebunden → ungeprüft). Bericht nennt das Ergebnis |
| `.claude/commands/se-laufzeit.md` | Version 3. Ausnahme und `answerPathSkipped` mit Verweis auf `se-vorbereitung` |
| `src/projections/tool-help.ts` | Hilfe zu `graph_metrics` nennt Ausnahme und `answerPathSkipped` |
| `tests/skill-laufzeit-antwortweg.test.ts` | Fall „außerhalb ohne gemeinsame Kette“ wieder ohne gemeinsame Kette; neuer Test für den übersprungenen Fluss; Version 3 |
| `tests/skill-vorbereitung-felder.test.ts` | Version 8 |

Mit `graphcode update` erreichen die Skills jedes Repo, weil die Version gestiegen ist.

## Test

`skill-laufzeit-antwortweg`, `skill-vorbereitung-felder`, `help`, `metrics`: 61 Tests grün.
