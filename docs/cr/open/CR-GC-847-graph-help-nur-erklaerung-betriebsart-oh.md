# CR-GC-847: graph_help nur Erklärung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1038 (finding)
**Erstellt:** 2026-10-23
**Item:** bok/items/ITEM-2026-1038.json (Lane: code)

---

## Befund

`graph_help` hat zwei Betriebsarten. Mit `token` erklärt es eine Regel, ein Panel oder ein Wort, ohne Auswertung. Ohne `token` ruft es `evaluateAll` und gibt je verletzter Regel eine erklärte Maßnahme zurück (`src/projections/report.ts`, `contextualHelp`).

Die Betriebsart ohne `token` doppelt `rules_get_violations`, und sie widerspricht ihm. Gemessen am 2026-10-23 am Selbstmodell:

| | `graph_help` ohne token | `rules_get_violations` `detail: grouped` |
|---|---|---|
| Länge (aus der Ausgabe geschätzt) | rund 13.000 Zeichen | rund 7.000 Zeichen |
| Umfang | ganzes Modell (RC-07 95, MS-03 295) | Arbeitsmenge der Sitzung (RC-07 93, MS-03 188) |
| Maßnahme | `plain`-Text je Regel | `fixHint` je Regel |

In den Sitzungsmitschnitten vom 23.09. bis 23.10. trug jeder lesbare `graph_help`-Aufruf ein `token`. Ein falscher Parametername löst trotzdem still die volle Auswertung aus (CR-GC-623).

## Änderung

- `graph_help`: `token` wird Pflicht; die Betriebsart ohne `token` und ihr `evaluateAll`-Aufruf fallen weg. Werkzeugbeschreibung und Eingabeschema ziehen nach.
- `contextualHelp` und `ContextualMeasure` löschen, samt Export in `src/index.ts`, wenn kein Nachbarpaket sie nutzt (geprüft 2026-10-23: kein Treffer unter `dev/*/src`, kein Eintrag in USAGE-MATRIX; vor dem Löschen noch einmal prüfen).
- `tests/help.contextual-dedup.test.ts` und der `contextualHelp`-Fall in `tests/help.test.ts` fallen mit weg; `tests/mcp.help.test.ts` prüft, dass ein Aufruf ohne `token` abgelehnt wird.
- `.claude/commands/se/help.md`: bei „Was soll ich tun?" `rules_get_violations` `{detail:"grouped"}` lesen; die lange Erklärung nur für die Regel holen, nach der der Nutzer fragt (`graph_help {token}`).
- Modellzug: der Fluss von FUNC-help zur Auswertung fällt weg, wenn es ihn gibt (`graph_impact` vor dem Löschen).

## Bedingung

Keine Antwort wird länger. `rules_get_violations` bleibt unverändert.

## Akzeptanz

- `graph_help` ohne `token` gibt einen Fehler mit dem Hinweis auf `rules_get_violations`.
- `grep -rn contextualHelp src tests` findet nichts.
- se:help nennt `rules_get_violations` für die Frage nach dem nächsten Schritt.
