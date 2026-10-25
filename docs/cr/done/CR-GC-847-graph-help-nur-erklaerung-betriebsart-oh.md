# CR-GC-847: graph_help nur Erklärung

**Status:** ✅ Done (2026-10-25)
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

## Ergebnis (2026-10-25)

- `graph_help`: `token` ist Pflicht im Eingabeschema. Ohne `token` lehnt die MCP-Grenze den Aufruf ab; die Meldung nennt `rules_get_violations({detail:"grouped"})`. Der `evaluateAll`-Aufruf ist weg, die Antwort ist immer ein `HelpEntry`.
- Gelöscht: `contextualHelp`, `ContextualMeasure`, `MAX_EXAMPLE_ELEMENTS` (nur von dort genutzt) samt Export in `src/index.ts`; `tests/help.contextual-dedup.test.ts`; die zwei `contextualHelp`-Fälle in `tests/help.test.ts`. Vor dem Löschen geprüft: kein Treffer unter `dev/*/src`, `sigloch-modules/packages/*/src`, kein Eintrag in USAGE-MATRIX.
- Tests: `tests/mcp.help.test.ts` und `tests/tool-description-params.test.ts` prüfen das strenge Schema (dasselbe, das die MCP-Grenze parst): `{}` scheitert, der Fehler nennt `rules_get_violations`. Vorher rot (3 Fälle), nachher grün.
- se:help: „Was soll ich tun?" liest `rules_get_violations` `{detail:"grouped"}`; `graph_help {token}` nur für die Regel, nach der der Nutzer fragt.
- Modellzug: `FLOW-rule-findings`, `FLOW-conformance-findings`, `FLOW-graph-state` gehen nicht mehr in `FUNC-graph-help`; `FCHAIN-skill-help` enthält `FUNC-rules-tool`; `TEST-help-contextual-dedup` gelöscht; Beschreibungen von FUNC-graph-help, FUNC-se-help, FLOW-help-answer, FCHAIN-skill-help, TEST-help-tool nachgezogen.
- Akzeptanz `grep -rn contextualHelp src tests`: Treffer nur noch in `tests/fixtures/perf-basis.graph.json` — Beschreibungstexte erledigter CRs im eingefrorenen Messmodell (CR-GC-665: nur mit Neu-Basis der Schwellen ändern). Im Code und in den Tests kein Treffer.
- Smoke: Host per stdio gestartet, 23 Werkzeuge; `graph_help {}` → Fehler mit Hinweis auf `rules_get_violations`, `graph_help {token:"R-04"}` → HelpEntry.
- `verify:full CR-GC-847`: 191 Dateien, 1610 Tests grün, Schlupf 0.
