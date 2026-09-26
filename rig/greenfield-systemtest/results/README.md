# Ergebnisgraphen des Executor-Programms (2026-07-31 … 08-01) — nur noch Fixtures

Das Executor-Programm ist abgeschlossen, seine Rankings sind zurückgezogen (Truncation-Fehler,
`docs/executor-abschlussbericht.md`; graphcode-Leitlinie T-E3). Die übrigen Läufe (Graphen,
Audit-Logs, run.logs v2–v20, Proben) sind mit CR-GC-678 gelöscht und stehen in der git-Historie.

Hier bleiben nur die Graphen, die Tests und Rigs als **Eingabe** lesen:

| Datei | Leser |
|---|---|
| `gc-run-haiku45.graph.json` | `tests/nd-similarity.test.ts` |
| `gc-run-devstral-v14.graph.json` | `tests/nd-similarity.test.ts` |
| `gc-run-devstral-v9.graph.json` | `rig/minimal-whitebox/run-phase1-authoring.mjs` (A3a) |
| `gc-run-opus5.graph.json` | `rig/minimal-whitebox/run-phase1-authoring.mjs` (A3b) |
