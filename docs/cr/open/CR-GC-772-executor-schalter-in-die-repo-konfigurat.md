# CR-GC-772: Executor-Schalter in die Repo-Konfiguration, GRAPHCODE_CLIENT_LLM entfaellt

**Status:** 🟠 Open
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

## Vom Autor zu entscheiden, bevor gebaut wird

**Gilt der Schalter je Repo oder je Client?**

| | je Repo (`graphcode.config.jsonc`) | je Client (Host-Datei, wie heute) |
|---|---|---|
| Ein Schalter, ein Ort | ja | zwei Dateien je Repo |
| Claude Code und OpenCode am selben Repo | beide bekommen dieselbe Werkzeugliste | jeder seine eigene |
| Passt zu „lokal immer OpenCode, Frontier immer Claude Code" | nur, wenn ein Repo nie beides zugleich nutzt | ja |

Beispiel: `energymanager` wurde mit Claude Code geführt und soll lokal mit OpenCode weiterlaufen. Mit einem
Repo-Schalter auf „nur Delegation" verlöre dort auch Claude Code `graph_mutate`.

Vorschlag: **je Client bleiben, aber umbenennen** — der Schalter sagt dann, was er tut
(`GRAPHCODE_WRITE_PATH=direct|delegate`), und die Voreinstellung ist `direct`. Der Repo-Abschnitt
`executor` bleibt die Stelle, an der das Modell des Executors steht.

## Umfang (bei beiden Varianten)

`src/surface/tool-profile.ts`, `src/surface/mcp-server.ts`, `src/surface/scaffold-templates.ts`, bei der
Repo-Variante zusätzlich `src/surface/delegate.ts`; `README.md`; `tests/mcp.tool-profile.test.ts`,
`tests/cli.scaffold.test.ts`, `tests/mvp-e2e.test.ts`; Modellknoten `FUNC-tool-profile`.

## Akzeptanz

- Rot zuerst.
- Kein zweiter Schalter: die alte Variable wird nicht still weitergelesen. Steht sie noch in einer Host-Datei,
  startet der Host mit einer Meldung, die den neuen Schalter nennt — oder `update` schreibt sie um; welche
  der beiden, steht nach der Entscheidung oben fest.
- Die fünf Probe-Repos mit konfiguriertem Executor sind benannt behandelt.
- `npm run verify:code`, vor dem Schließen `npm run verify:full CR-GC-772`.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
