# CR-GC-723: Werkzeugprofil je LLM-Art am MCP-Server: Variable GRAPHCODE_LLM=local|cloud (Scaffold schreibt local in opencode.json, cloud in .mcp.json). local = graph_delegate + Leser graph_elements, graph_get_node, graph_context, Leser-Beschreibung auf den ersten Satz; kein graph_mutate (ein Schreibweg: der Executor im Host). cloud = volle Liste. Entscheid Autor 2026-10-01, Messung in ITEM-2026-687 (Liste heute 32.029 Zeichen, OpenCode laedt sie je Anfrage). Abnahme: A/B-Lauf OpenCode gegen qwen

**Status:** ✅ Done (2026-10-01)
**Typ:** aus Item ITEM-2026-688 (idea)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-688.json (Lane: code)

---

## Befund

OpenCode lädt die ganze `tools/list`-Antwort in jede Anfrage: 28.210 Zeichen nach CR-GC-722, bei
einem festen Prompt-Sockel der qwen-Sitzungen von rund 21.500 Tokens. Dazu der Entscheid vom
2026-09-28: ein lokales Modell verarbeitet die Gate-Rückmeldungen nicht selbst, es gibt die
Modellarbeit an den Executor im Host ab (`graph_delegate`, CR-GC-714).

## Entscheid (Autor, 2026-10-01)

- **Lokal schreibt nur über `graph_delegate`.** Kein `graph_mutate` im lokalen Profil — zwei
  Schreibwege nebeneinander wären eine Wahl, die das lokale Modell falsch trifft. Reicht das Profil
  nicht, zeigt es der Chatverlauf.
- **Die Variable nennt die LLM-Art, nicht den Client.** OpenCode ist heute gleich lokal, aber die
  Bedingung hängt an `local | cloud`.

## Umsetzung

- `src/surface/tool-profile.ts` (neu): `GRAPHCODE_CLIENT_LLM` = `local | cloud`; nicht gesetzt =
  `cloud`, unbekannter Wert = Fehler. `applyToolProfile` ist eine Sicht auf die eine Registry:
  `local` = `graph_delegate` (ungekürzt, es trägt sein Protokoll) + die Leser `graph_elements`,
  `graph_get_node`, `graph_context` mit der Beschreibung auf den ersten Satz.
- `src/surface/mcp-server.ts`: `serveStdio` prüft das Profil **vor** der Wahl (kein Store-Lock bei
  Fehlstart) und schneidet nur die stdio-Sicht dieses Clients; `host.sock` trägt die volle Registry.
- `src/loop/executor-backend.ts`: `ersterSatz` exportiert — eine Kürzungsregel für Executor und Profil.
- `src/surface/scaffold-templates.ts`: `.mcp.json` bekommt `cloud`, `opencode.json` `local`; ein von
  Hand gesetzter Wert überlebt `update`.
- `tests/mcp.tool-profile.test.ts` (neu), `tests/cli.scaffold.test.ts`, `tests/mvp-e2e.test.ts`,
  `README.md`.

**Name der Variable:** `GRAPHCODE_CLIENT_LLM`, nicht `GRAPHCODE_LLM` wie im Titel — `GRAPHCODE_LLM_*`
ist bereits der Namensraum des Executor-Backends (`graphcode run`).

Ergebnis: lokales Profil 4 Werkzeuge, 3.303 Zeichen (volle Liste 28.210). Smoke am echten Prozess
(`node dist/cli.js mcp`): local mit Executor listet die vier Werkzeuge, `graph_elements` antwortet,
`graph_mutate` ist „not found“; local ohne Executor und ein ungültiger Wert brechen mit Klartext ab.

## Bewusst offen

- **Abnahme A/B gegen qwen fehlt.** Ob OpenCode mit vier Werkzeugen eine Spezifikation und Code
  zustande bringt, ist nicht gemessen — nur, dass der Server das Profil korrekt ausliefert.
- **Ein OpenCode-Start ohne `executor`-Abschnitt scheitert jetzt** (nach `update`/Rollout), mit der
  Meldung, was fehlt. Gewollt: ohne Executor hätte das lokale Profil keinen Schreibweg.
- **Skills und `GRAPHCODE.md` nennen weiter `graph_mutate`.** Die OpenCode-Kopien der Skills
  (CR-GC-721) weisen das lokale Modell auf ein Werkzeug, das es nicht mehr hat.
- **Modell:** `FUNC-tool-profile` übergibt an `FUNC-serve-stdio` ohne gemeinsame FCHAIN (R-21,
  Warnung) — dieselbe bestehende Lücke wie bei `FUNC-bind-tools`.

## Umfang laut Graph

`FUNC-tool-profile` (neu), `FUNC-serve-stdio`, `FUNC-harness-cli`, `REQ-tool-profile-by-llm` (neu),
`TEST-tool-profile` (neu). Testspur aus `graph_tests({changeSet:[FUNC-serve-stdio, FUNC-harness-cli,
FUNC-bind-tools]})`: 9 Dateien.
