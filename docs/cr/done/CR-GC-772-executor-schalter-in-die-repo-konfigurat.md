# CR-GC-772: Executor-Schalter in die Repo-Konfiguration, GRAPHCODE_CLIENT_LLM entfaellt

**Status:** ✅ Done (2026-10-09)
**Typ:** aus Item ITEM-2026-802 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-802.json (Lane: code)

---

## Herkunft

Teil 2 von CR-GC-770, abgetrennt an der Dateigrenze (Teil 1 hat das Modell geschnitten; zusammen wären es
zwölf Dateien).

## Befund

Der Schalter für den geparkten Executor-Weg heißt `GRAPHCODE_CLIENT_LLM` und steht je Client in der
Host-Datei (`.mcp.json`, `opencode.json`). Er fragt nach der Art des Modells, wählt aber den Schreibweg:
`local` schneidet die Werkzeugliste auf `graph_delegate` und drei Leser, `cloud` lässt sie ganz.

Zwei Dinge, die beim Lesen des Codes klar wurden:

- Das Werkzeug `graph_delegate` gibt es schon heute immer dann, wenn die Repo-Konfiguration einen Abschnitt
  `executor` hat — auch im Profil `cloud`. Der Schalter entscheidet also nicht, OB delegiert werden kann,
  sondern ob der Client NUR delegieren darf.
- Der Abschnitt `executor` wird in graphcode geprüft (`DelegateConfigSchema`, `src/surface/delegate.ts`),
  nicht in contracts. Ein neues Feld dort braucht kein Familien-Review.

## Entschieden (Autor, 2026-10-09)

Je Client bleiben, umbenennen: `GRAPHCODE_WRITE_PATH=direct|delegate`, Voreinstellung `direct`.

Grund gegen den Repo-Schalter: Claude Code und OpenCode am selben Repo bekämen dieselbe Werkzeugliste;
bei `energymanager` verlöre Claude Code das direkte Schreiben.

## Umgesetzt

- `src/surface/tool-profile.ts`: `writePathFromEnv`, Werte `direct` und `delegate`. Steht die alte Variable
  noch in der Umgebung, startet der Host nicht und nennt den neuen Schalter und `graphcode update`.
- `src/surface/scaffold-templates.ts`: beide Host-Dateien bekommen `GRAPHCODE_WRITE_PATH: direct`. `update`
  schreibt einen alten Wert um (`cloud` wird `direct`, `local` wird `delegate`) und entfernt den alten Schlüssel.
- `src/surface/mcp-server.ts`, `README.md`, zwei Dokumente unter `docs/`.
- Der Dateititel dieser CR nennt noch die verworfene Repo-Variante.

## Tests

Rot zuerst, elf Fälle in `tests/mcp.tool-profile.test.ts` und `tests/cli.scaffold.test.ts`: neuer Name und neue
Werte, alte Variable als Fehler, `update` übersetzt beide alten Werte.

## Folge für bestehende Repos

Ein Repo, das graphcode aktualisiert, braucht `graphcode update` (macht `upgrade` mit). Ohne das startet der
Host nicht, solange die alte Variable in der Host-Datei steht. Betroffen sind alle Repos mit graphcode; die
fünf mit konfiguriertem Executor (`agentdiary-local`, `-local-3`, `-local-run1`, `todo-probe-c`, `todo-probe-d`)
behalten nach `update` ihren Weg als `delegate`.
