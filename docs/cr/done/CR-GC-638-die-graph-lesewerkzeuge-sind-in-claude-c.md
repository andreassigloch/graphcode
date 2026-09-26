# CR-GC-638: Die graph_*-Lesewerkzeuge sind in Claude-Code-Sitzungen deferred: ihr Schema ist nicht geladen, ein Aufruf verlangt vorher ToolSearch, waehrend Bash immer bereitliegt. Gemessen am Referenz-Change: 2 ToolSearch-Aufrufe insgesamt, beide fuer graph_mutate (Schreiben, wo es keinen Ersatz gibt) - fuers Lesen gewinnt grep, weil es keinen Vorlauf kostet. Die Werkzeugtabelle in CLAUDE.md koennte die ToolSearch-Abfrage mitliefern

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-521 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-521.json (Lane: code)

---

## 1 Befund

Claude Code laedt MCP-Werkzeuge deferred: in der Sitzung steht nur der Name, ein Aufruf ohne
vorheriges `ToolSearch` scheitert an der fehlenden Schema-Definition. `Bash`/`grep` liegen immer
bereit. Am Referenz-Change (Item ITEM-2026-521) fielen 2 ToolSearch-Aufrufe, beide fuer
`graph_mutate` — beim Schreiben gibt es keinen Ersatz, beim Lesen gewinnt grep, weil es keinen
Vorlauf kostet. Die Tabelle „Ask the graph" in `CLAUDE.md` empfiehlt 10 Lese-Werkzeuge, sagt aber
nicht, wie man sie in einem Zug verfuegbar macht.

Server-Name und damit Praefix: `graphcode` in `.mcp.json` dieses Repos und im Scaffold
(`mcpConfigContent`, `opencodeConfigContent`) — die Werkzeuge heissen `mcp__graphcode__<name>`.

## 2 Zielbild

Direkt unter der Tabelle steht eine `ToolSearch select:`-Zeile, die alle von der Tabelle empfohlenen
Leser in **einem** Aufruf laedt. Ein Test haelt sie ehrlich: jeder Name existiert im MCP-Register,
keiner ist ein Schreiber (`NON_CONSULTING_TOOLS`), und jedes Lese-Werkzeug der Tabelle steht drin.

## 3 Umfang

| Datei | Aenderung |
|---|---|
| `CLAUDE.md` | ToolSearch-Zeile unter der Werkzeugtabelle |
| `src/surface/mcp-tools.ts` | `NON_CONSULTING_TOOLS` exportiert (Schreiber-Menge fuer den Test, keine Verhaltensaenderung) |
| `tests/claude-md.toolsearch.test.ts` | neu: Praefix, Register-Existenz, keine Schreiber, Tabelle vollstaendig geladen |
| dieser CR | |

**Nicht im Umfang: `GRAPHCODE.md` (Consumer).** Es hat die Tabelle nicht — CR-GC-612 hat Werkzeugnamen
dort bewusst entfernt, `tests/vorspann.test.ts` haelt „nennt KEIN Werkzeug beim Namen" und das Budget
< 6.000 Zeichen (Stand nach CR-GC-690: 5.988). Eine ToolSearch-Zeile (~420 Zeichen) sprengt beides.

## 4 Akzeptanz

1. Red first: der neue Test ist ohne die Zeile rot (3/3).
2. Jeder Name der Zeile beginnt mit `mcp__graphcode__`, existiert in `bindToolsToHarness` und ist
   kein Schreiber; jedes Lese-Werkzeug der Tabelle ist geladen.
3. `npm run build` gruen, volle Suite gruen (bekannt rot: `tests/rig-measured.test.ts`).

## 5 Ergebnis (2026-09-26)

- Zeile in `CLAUDE.md`: `ToolSearch select:` mit den 10 Lesern der Tabelle (`graph_impact`,
  `graph_expand`, `graph_context`, `graph_elements`, `graph_tests`, `rules_evaluate`,
  `rules_get_violations`, `graph_readiness`, `graph_suggest`, `graph_metrics`).
- `tests/claude-md.toolsearch.test.ts` 3/3 rot ohne Zeile, danach gruen.
- **Offen (Consumer):** Consumer-Repos bekommen die Zeile nicht. Kandidat ohne Konflikt mit CR-GC-612:
  die MCP-Server-`instructions` (von Claude Code immer in den Kontext geladen), oder eine Ausnahme
  der 612-Regel fuer genau diese Lade-Zeile plus Budget-Anhebung — Entscheidung des Auftraggebers,
  als Item anzulegen.
- **Offen (Wirkung):** ob die Zeile das Lese-Verhalten aendert, zeigt erst die naechste Messung
  (ToolSearch- vs. grep-Aufrufe je Change, `se-retro`-KPI graph-vs-grep).
- **Kongruenz:** benannte Ausnahme — kein Modell-Zug in dieser Lane (kein Graph-Schreibrecht).
