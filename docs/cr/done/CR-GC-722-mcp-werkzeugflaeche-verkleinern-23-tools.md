# CR-GC-722: MCP-Werkzeugflaeche verkleinern: 23 Tools = 32.029 Zeichen tools/list, die OpenCode je Anfrage laedt (fester Sockel lokal ca. 21.500 Tokens). Gemessen 2026-08-29..09-30: Claude Code 2.745 Aufrufe, OpenCode/qwen 196. (1) Service-Operationen aus der MCP-Liste in CLI-Verben: graph_merge (0 Aufrufe, kein Aufrufer, kein Skill), graph_reseed (1), audit_trail (1), audit_stats (0) = -5.204 Zeichen. (2) Spike Zusammenfuehrung: rules_evaluate + rules_get_violations sind ein Werkzeug mit Umfang-Parameter (gleiche Form, nur Arbeitsmenge vs. Modell); graph_expand Tiefe 1 liefert dieselben Kanten wie graph_get_edges(uid) und wurde 4x gerufen; graph_get_node bleibt (einziger Prosa-Kanal, meistgerufenes Tool in OpenCode 68/196); graph_help/graph_authoring_guide und graph_test_report/ingest nicht deckungsgleich. (3) Werkzeugprofil am MCP-Server nach Vorbild Executor-toolset authoring: Kern 10 Tools = 15.411 Zeichen (48 %). (4) Texte: graph_mutate 4.685 Zeichen (formatE-Sprachdoku 2.441), detail-Parameter 1.400 Zeichen doppelt, Default full in 98 von 100 Aufrufen ueberschrieben. Offen: Token-Zahl ist geschaetzt, A/B mit opencode gegen qwen fehlt

**Status:** ✅ Done (2026-10-01)
**Typ:** aus Item ITEM-2026-687 (finding)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-687.json (Lane: code)

---

## Befund

Ein Client ohne Nachlade-Mechanik (OpenCode) trägt die ganze `tools/list`-Antwort in jeder Anfrage.
Gemessen über einen In-Memory-MCP-Client am gebauten Server: 23 Werkzeuge, 32.029 Zeichen — davon
11.196 Werkzeugbeschreibungen, 13.696 Parameterbeschreibungen, 7.137 Schema-Gerüst. Vier
Parametertexte stellten 5.626 Zeichen: `graph_mutate.formatE` (2.246), `detail` an beiden
Regel-Werkzeugen (je 1.230), `graph_mutate.violations` (920). Sie trugen neben der Bedienung die
Herkunft der Regeln (CR-Nummern, Messwerte, Begründungen).

## Dieser CR: nur Punkt (4) des Items — die Texte

- `src/surface/write.ts`: `formatE`, `violations`, `dryRun`, `baseVersion` nennen, was der Schreiber
  zum Schreiben braucht. Jede Bedienregel bleibt (Sektionen, Präfixe, Binden, Kanten-Patch, Fan-out,
  Name, Lösch-und-Schreib-Verbot); Herkunft und Messwerte entfallen.
- `src/projections/report.ts`: `detail` nennt die drei Formen in vier Zeilen.
- `tests/mcp.agent-agnostic.test.ts`: Fall (d), Sperrklinke auf die Nutzlast (≤ 28.300 Zeichen).

Ergebnis: 32.029 → 28.210 Zeichen (−12 %); `graph_mutate` 4.685 → 2.660.

## Nicht in diesem CR

- **Default `detail: full` bleibt.** In 98 von 100 gemessenen Aufrufen wurde er überschrieben, aber
  an ihm hängen 16 Testaufrufe, der Skill `se:close-violations` (liest `context.candidate_targets`)
  und die Zusage aus CR-GC-309. Ein Default-Wechsel ist eine Schnittstellenänderung, kein Textschnitt.
- Punkt (1) Service-Operationen in CLI-Verben und Punkt (2) Zusammenführungen: Folge-Item.
- Punkt (3) Werkzeugprofil: CR-GC-723.

## Umfang laut Graph

`FUNC-bind-tools` (die gebundene Werkzeugfläche), `REQ-mcp-tool-registry`. Testspur aus
`graph_tests({changeSet:[FUNC-bind-tools, FUNC-deduce-tests]})`: 11 Dateien, alle aufgelöst.
