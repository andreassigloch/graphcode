# Ergebnisgraphen des Executor-Programms (2026-07-31 … 08-01)

Alle Läufe: gleicher Intent („Multiuser-fähige Web-App aus dem graphcode
harness…"), embedded Executor (`graphcode run`), 48 Runden sofern nicht anders
vermerkt. Auswertung: `docs/executor-abschlussbericht.md`. `logs/` enthält die
run.logs (Turns, Rejections, Defers, End-Stats) — auch der abgebrochenen Läufe
ohne Export (v1–v5, v7, v8, v10, v13).

| Datei | Modell | Konfiguration | Kurzbefund |
|---|---|---|---|
| v6 | devstral | 12 Rd., 4,7k-Kontext, authoring-Toolset | 14 El — Expand-Durchbruch (30er-Batch) |
| v7b | devstral | 24 Rd., + Lese-Budget-Nudge | 10 El — 1-Fund-Fokus zu klein (Negativ-Beleg) |
| v9 | devstral | 24 Rd., 16k-Kontext + Salvage | 38 El — 12 FUNC, 1 MOD |
| v11 | devstral | 48 Rd., + Stagnations-Detektor | 38 El — 9 REQ/10 TEST, aber 43/48 Rd. stagniert |
| v12 | devstral | 48 Rd., + Defer (CR-281) + temp 0.2 | 82 El — alle Dimensionen, Stagnation x3 |
| v13b | devstral | 48 Rd., Minimal-Rendering (CR-282) | 22 El — **Negativ-Beleg** Minimal-Prompt |
| v14 | devstral | 48 Rd., volles Rendering, temp 0.15 | 85 El — inkl. 6 MOD, 4 MS, 1 CR |
| haiku45 | Haiku 4.5 | 48 Rd., anthropic-Backend | **86 El — Top-Graph** (5 Errors, protokolltreu) |
| opus5 | Opus 5 | 48 Rd., anthropic-Backend | 57 El, 81 Rejections — Emissions-Regime beschneidet Frontier |
