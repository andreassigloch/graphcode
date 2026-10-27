# CR-GC-869: tsc-Fehler in tests/ beheben, Teil 1 (Teil 3 von ITEM-2026-1094)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1098 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1098.json (Lane: code)

---

Teil 3 von ITEM-2026-1094: die verbleibenden tsc-Fehler in tests/, erste Haelfte der Dateien (Liste im CR von Teil 2).

---

## Befund

Nach CR-GC-866 bis 868 meldet `tsc -p tsconfig.tests.json` 105 Fehler in 27 Testdateien (vorher 108).
Ursachen in diesem Teil:

| Ursache | Dateien | Lösung |
|---|---|---|
| Ergebnis ist JSON oder Format-E, der Test liest eine Form ohne Eingrenzung | read-tools.scope | `mitFeld(antwort, 'nodes')` prüft und grenzt ein |
| Regel-Antworten sind Befunde oder Gruppen | mcp.violation-context, evaluation.reconciliation | `nurBefunde` / `nurGruppen` prüfen und grenzen ein; zwei Casts entfallen, einer davon (`as ViolationGroup[]`) verlor `stage` seit CR-GC-750 |
| Test annotierte `MCPToolRegistry` und löschte den Typ wieder | metrics, testreport, auto-export | `ToolRegistry` bzw. `ToolRegistry['graph_export']`, `MCPTool<unknown, unknown>` entfällt |
| Kommando ohne `attributes` | graph-store | `attributes: {}` |
| Ergebnis kann `null` sein | aenderungsmeldung, rig-measured | Abbruch mit Meldung statt Zugriff auf `null` |
| `@ts-expect-error` vor einem `.mjs`-Import | aenderungsmeldung | entfällt, `allowJs` in `tsconfig.tests.json` liefert die Typen |

Neu: `tests/helpers/antwort.ts` mit `mitFeld`, `nurBefunde`, `nurGruppen`. Jede Funktion wirft,
wenn die Form nicht stimmt — eine Assertion läuft dann nicht still an `undefined` vorbei.

## Akzeptanzkriterien

- `tsc -p tsconfig.tests.json` meldet in den 10 Dateien 0 Fehler (gesamt 105 → 25).
- Die 9 Testdateien laufen grün; `verify:code` grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tsc -p tsconfig.tests.json` meldete in den 10 Dateien 80 Fehler, danach 0 (gesamt 105 → 25).
- Grün: die 9 Testdateien (96 Tests), `verify:code` (Spur VOLL, 202 Dateien).
