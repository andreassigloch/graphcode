# CR-GC-371 — Das Dashboard wird beaufsichtigt, nicht nur gestartet

**Status:** done · **Angelegt:** 2026-08-19 · **Geschlossen:** 2026-08-19

## Problem

`maybeStartGve` lief einmal, in `electAndBoot`. Stirbt der Viewer danach — Vite-Absturz,
jemand nimmt ihm den Port, OOM, ein hartes `kill -9` —, bemerkt das niemand: der Host
lebt, der Store ist gesund, `graphcode status` meldet „MCP-Host OK / Dashboard läuft
nicht", und die einzige Aktion, die den Viewer zurückbrachte, war ein Neustart der
ganzen Agent-Session. Genau in diesem Zustand stand das Repo am 2026-08-19.

## Umsetzung

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `src/gve.ts` **(neu)** | Start + Aufsicht aus `mcp-server.ts` herausgelöst (473 → 335 Zeilen). `superviseGve()` startet den Viewer neu, wenn er unerwartet endet: Wartezeiten 1 s / 3 s / 10 s, dann Aufgabe mit ehrlicher stderr-Zeile. Ein Viewer, der ≥ 60 s lief, setzt das Budget zurück. `stop()` (Sessionende) unterdrückt jeden Neustart. |
| 2 | `src/mcp-server.ts` | `electAndBoot` nutzt `superviseGve`; der Lifecycle hält den Handle statt des rohen Kindprozesses. Tote Imports entfernt. |
| 3 | `tests/gve-supervision.test.ts` **(neu)** | Neustart nach Tod, Grenze nach drei Versuchen, Budget-Reset nach stabiler Laufzeit, kein Neustart nach `stop()`, kein Handle bei Opt-out. |
| 4 | `tests/gve-autostart.test.ts` | Import auf `../src/gve.js` gezogen (Verschiebung, keine Kopie). |

## Abschluss

Suite grün, Build grün. E2E im Wegwerf-Repo: Viewer mit `kill -9` beendet →
`gve: dashboard exited (SIGKILL) — restarting in 1s` → neuer Viewer, `dashboard.url`
wieder da. `SIGTERM` auf den Host beendet ihn endgültig, ohne Neustartversuch.

### Warum eine Grenze und kein endloser Neustart

Ein Viewer, der dreimal in Folge sofort stirbt, hat ein Problem, das ein vierter Start
nicht löst — belegter Port, kaputte Installation. Eine Neustartschleife würde es
verschleiern statt melden. Der Budget-Reset nach 60 s stabiler Laufzeit verhindert die
Gegenrichtung: eine tagelange Session soll nicht an drei über Tage verteilten Abstürzen
verhungern.
