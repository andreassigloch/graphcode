# CR-GC-320: executor.ts schneiden — Schritt 1 (Prompt · Ranking · Prosa-Recovery)

**Status:** done 2026-08-08 · **angelegt 2026-08-08** · **Max Files:** 6
**Herkunft:** aus CR-GC-261 ausgegliedert. `src/executor.ts` existierte bei CR-GC-260 noch
nicht (CR-GC-278/279) und ist heute mit **1503 Zeilen** der größte Überschreiter in `src/` —
3× die Grenze, also kein Verschiebe-, sondern ein Umbau-Budget.

## Problem (Why)

`executor.ts` trägt fünf voneinander unabhängige Achsen in einer Datei:

| Achse | Zeilen | Kopplung an den Loop |
|---|---|---|
| Config-Schema (`ExecutorConfigSchema`) | 32–134 | Eingang, keine |
| System-Prompt + Runden-Injektion (`SYSTEM`, `buildRoundInjection`, `jsonCapped`, Budgets) | 135–328 | **keine** — reine Stringerzeugung aus Registry-Reads |
| Workspace-Read-Tools (`contained`) | 329–408 | Tool-Handler, keine |
| Backend/Transport (`buildToolSpecs`, `buildCallModel`) | 409–565 | Eingang, keine |
| Best-of-N-Ranking (`temperatureSpread`, `deltaSum`, `rankCandidates`) | 566–664 | **keine** — reine Funktionen über `CandidateProbe` |
| Prosa-Recovery (`extractMutateFromText`, `salvageCommands`, `extractToolCallFromText`) | 665–767 | **keine** — reine Textparser |
| Gate-Feedback + der Loop (`runExecutor`) | 768–1503 | **ist** der Loop |

Die drei fett markierten Achsen sind zustandsfrei, einzeln getestet und haben keinen
Closure-Bezug zum Runden-Loop. Sie herauszunehmen ist mechanisch.

## Decision — Schritt 1 (dieses CR)

1. **`src/executor-prompt.ts`** ← Zeilen 135–328: `SYSTEM`, `EMIT_SUFFIX`, `IDLE_NUDGE`,
   `WITHHELD_TOOLS`, `AUTHORING_TOOLS`, `INDEX_CHAR_BUDGET`, `TOOL_RESULT_CHAR_BUDGET`,
   `jsonCapped`, `buildRoundInjection` (~192 Zeilen).
2. **`src/executor-rank.ts`** ← Zeilen 566–664: `TEMPERATURE_ANCHORS`, `temperatureSpread`,
   `deltaSum`, `focusDelta`, `totalDelta`, `blockingRise`, `rankCandidates` (~99 Zeilen).
3. **`src/executor-parse.ts`** ← Zeilen 665–767: `extractMutateFromText`, `salvageCommands`,
   `extractToolCallFromText` (~103 Zeilen).

**Kein Re-Export-Barrel in `executor.ts`** (keine parallelen Pfade): die Importeure ziehen
auf das neue Modul um. Das ist genau die Dateizählung unten und der Grund, warum Schritt 1
hier endet.

**Importeure (gemessen, nur Import-Zeilen):**
- `tests/executor.test.ts` — zieht die Prompt- **und** Parse-Symbole.
- `tests/executor.bestofn.test.ts` — zieht die Ranking-Symbole.
- **Nicht betroffen:** `src/run-verb.ts`, `tests/cli.run.test.ts`,
  `tests/executor.preflight.test.ts` — die importieren nur `runExecutor` /
  `ExecutorConfigSchema` / Typen, die in `executor.ts` bleiben.

Ergebnis: `executor.ts` **1503 → ~1100**. Dateien: 3 neu + `executor.ts` + 2 Tests = **6**.

## Ehrlicher Rest — was Schritt 1 NICHT erreicht

~1100 ist weiterhin über 500. Der verbleibende Block ist der Loop selbst: `runExecutor`
(813–1503) mit den Closures `loadGraphSnapshot`, `runPreflight` und der Tool-Call-Behandlung
(~455 Zeilen) plus dem Runden-Loop (~186). Diese Closures teilen `stats`, `registry`,
`trace` und `config` — sie herauszuziehen verlangt eine Factory (`createTurnRunner(deps)`)
und ist damit **Refactoring, kein Verschieben**: eigene Risikolage, eigener CR, eigene
Begründung. Das wird hier bewusst **nicht** mitgemacht und **nicht** stillschweigend
offengelassen.

**Entscheidung nach Schritt 1 nötig (nicht vorweggenommen):** entweder Schritt 2 als
Turn-Runner-Extraktion, oder — wie bei `harness.ts` in CR-GC-261 — der Loop wird als
begründete Ausnahme in `src/README.md` festgeschrieben.

## Akzeptanz

- [x] Reines Verschieben: keine Signatur-, Ausgabe- oder Semantik-Änderung in den drei
      neuen Modulen. **Per `diff` gegen `HEAD:src/executor.ts` verifiziert** — identisch bis
      auf die `export`-Präfixe, die der Modulschnitt erzwingt, und die in die Modul-Header
      gefalteten Abschnitts-Banner.
- [x] Keine Test-**Assertion** geändert — nur Import-Zeilen (Präzedenz CR-GC-260).
      Nachweis: `git diff -U0 tests/` enthält außerhalb der Import-Blöcke keine Zeile.
- [x] Kein Re-Export der verschobenen Symbole aus `executor.ts`.
- [x] Alle drei neuen Module < 500; `executor.ts` **1503 → 1127** (gemessen).
- [x] `npm run build` + `npm test` vollständig grün (85 Dateien / 622 Tests).

## Ergebnis (gemessen)

| Datei | Zeilen |
|---|---|
| `src/executor.ts` | 1503 → **1127** |
| `src/executor-prompt.ts` | 207 |
| `src/executor-rank.ts` | 106 |
| `src/executor-parse.ts` | 108 |

Sichtbarkeit ist die einzige Abweichung vom reinen Verschieben: `EMIT_SUFFIX`, `IDLE_NUDGE`,
`WITHHELD_TOOLS` und `AUTHORING_TOOLS` waren modul-privat und mussten exportiert werden, damit
`executor.ts` sie importieren kann — beim Modulschnitt unvermeidbar. `salvageCommands`,
`blockingRise`, `TIER_RANK` und `GuideSlice` bleiben privat: sie werden nur innerhalb ihres
eigenen neuen Moduls benutzt.

## Nebenbefund (nicht Teil dieses CR)

Der MCP-Server-Prozess dieses Repos (`node dist/cli.js mcp`, gestartet 04:12) war **älter als
der heutige Publish** von `@sigloch/contracts` 3.2.0 / `graph-api-core` 2.1.0 und hielt den
alten Regelstand im Speicher — erkennbar daran, dass er R-21 auf
`FUNC-graph-export-snapshot → FUNC-reseed` meldete, während der frische lokale Code dort 0
liefert. Sein `graph_export` hat prompt die RTM-Ebenengruppierung (CR-GC-317/318) und die
Rolled-up-Integrationsabdeckung wieder herausgerendert. Repariert durch `node
scripts/export-graph.mjs` mit dem frischen lokalen `dist` — derselbe Stale-Prozess-Fehler, der
in dieser Session schon einmal `docs/views/spec.md` wiederbelebt hatte. **Der Server muss nach
einem Paket-Update neu gestartet werden**; das ist bisher nirgends erzwungen.

## Nicht in diesem CR

- `runExecutor`, die Preflight-/Turn-Closures, der Runden-Loop (s. „Ehrlicher Rest").
- Config-Schema, Workspace-Read-Tools, Backend/Transport — schneidbar, aber sie sprengen
  das 6-Dateien-Limit; erst nach der Entscheidung zu Schritt 2 bewerten.
- `src/harness.ts` → CR-GC-261. `src/viewer/help-content.ts` → bewusst keine Aktion.
