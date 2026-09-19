# CR-GC-555: das Rig fährt `graphcode run` — dritter Executor

**Status:** 🟢 Done (2026-09-19)
**Typ:** aus Item ITEM-2026-361 (finding)
**Erstellt:** 2026-09-19
**Item:** bok/items/ITEM-2026-361.json (Lane: code)

---

## 1. Root Cause

Das Rig hat zwei Executoren, `claude -p` und `opencode`. Beide sprechen den MCP-Server
direkt. **`graphcode run` ist keiner davon** — und genau dort liegt die Steuerungsmaschinerie:
Rundenprompt aus `graph_generate`, `WITHHELD_TOOLS`, kuratiertes Toolset, Gate-Rückkanal mit
Reparatur, Preflight-Autovervollständigung, Best-of-N, Phasen-Gate mit Handoff auf
`graph_suggest`.

Gemessen an den beiden Läufen von heute: der `claude -p`-Arm setzte 16 von 19 Mutationen
**ohne ein einziges vorheriges Werkzeug** ab und rief `graph_suggest` null Mal. Ein
Handprobelauf über `graphcode run` zeigte im selben Korpus vor jeder Mutation
`graph_generate`, `graph_authoring_guide`, `graph_elements`, `graph_get_edges` — plus eine
Reparatur nach Gate-Ablehnung und zehn Preflight-Vervollständigungen.

Das Rig misst also nicht das Produkt, sondern einen Agenten, der zufällig dieselben Werkzeuge
hat.

## 2. Impact

**Was bricht:** jede Aussage des Rigs über „den Auto-Modus" meint bisher `claude -p` und nicht
`graphcode run`. Die Zahlen sind nicht falsch, aber sie beantworten eine andere Frage als die,
für die das Rig gebaut wurde.

**Was nicht bricht:** die beiden bestehenden Arme bleiben unverändert und vergleichbar; dieser
Zug ergänzt einen dritten, er ersetzt keinen.

## 3. Fix

Dritter Executor `gcrun` neben `claude` und `opencode`. Kein zweiter Runner: derselbe
`initWorkspace` → `seedSystem` → Executor → `captureArtifacts` → `runMetrics`-Pfad, nur ein
anderer Zweig in der Executor-Weiche.

Der Intent-Text ist ein eigener: `buildPrompt()` weist das Modell an, `graph_next_step` zu
rufen — im Executor-Loop ist dieses Werkzeug **vorenthalten**, der Loop baut seine
Rundenprompts selbst. Ein Intent, der Werkzeuge vorschreibt, die es nicht gibt, wäre eine
eingebaute Fehlleitung.

### Dateien (4)

| # | Datei |
|---|---|
| 1 | `rig/greenfield-systemtest/run.mjs` — Arm `gcrun`, `authorViaGraphcodeRun`, `buildIntent` |
| 2 | `rig/sigllm-spezifikation/lauf-gcrun.env` — neu, der Aufruf |
| 3 | `rig/sigllm-spezifikation/README.md` — der dritte Arm und was er misst |
| 4 | `docs/cr/open/…` → `done/` |

## 4. Nachweis

- [x] Der Arm lief durch: 49 Elemente, 12 Runden, 51 Turns, 13 Minuten, `runs/gcrun-0/` mit
      `graph.json`, `readiness.json`, `audit.jsonl`, `run-raw.log`, `usage.json`.
- [x] `usage.json` trägt die Zahlen aus dem Statistikblock — 359521/39672 Token, Kosten 0
      (lokal; eine erfundene Kostenzahl wäre schlimmer als keine).
- [x] **Der Unterschied ist gemessen.** `claude -p`: 16 von 19 Mutationen ohne ein einziges
      vorheriges Werkzeug. `graphcode run`: 6 von 10 mit `graph_generate` +
      `graph_authoring_guide` + `graph_elements` + `graph_get_edges` davor. `graph_generate`
      erscheint im `claude -p`-Lauf **null Mal** — es ist dort vorenthalten.
- [x] `RESULTS_FILE=results-sigllm-gcrun.json` getrennt, die beiden alten Korpora unberührt.

**Der Loop greift, gemessen:** 6 Mutationen angewandt, **2 nach Gate-Ablehnung repariert**,
14 Preflight-Vervollständigungen, 15 Preflight-Blocks, 3 Dry-Run-Proben. Nichts davon gibt es
auf den `claude -p`-Armen.

**Was auch hier NICHT passiert:** `graph_suggest` läuft wieder null Mal, und keine Mutation
trägt `editSource: 'suggestion-template'`. Der Grund ist jetzt aber ein anderer und ein
benannter: `graph_suggest` liegt hinter dem **Handoff**, und der verlangt alle acht
Readiness-Dimensionen über Schwelle. Dieser Lauf kam auf 1/8. Die Vorlagen sind nicht
umgangen — sie sind planmäßig noch nicht an der Reihe.
