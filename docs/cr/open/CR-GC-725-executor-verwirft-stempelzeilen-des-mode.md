# CR-GC-725: Executor verwirft Stempelzeilen des Modells: eine @analysisFreshness-Zeile verlaesst den Batch vor dem Gate (executor-gate.ts), den Stempel setzt allein der Executor, wenn das Artefakt steht (CR-GC-724). Executor-Teil von ITEM-2026-684; local-1 setzte fuenf Stempel ohne Artefakt

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-695 (finding)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-695.json (Lane: code)

---

## Befund

Seit CR-GC-724 setzt der Executor den Stempel einer Analyse, wenn ihr Artefakt steht. Ein Batch des Modells
mit einer `@analysisFreshness`-Zeile ging aber weiter unverändert ans Gate und schloss den Task — der Weg,
auf dem `local-1` fünf Stempel ohne Artefakt setzte.

## Umsetzung

`src/loop/executor-gate.ts`: `ohneStempelzeilen` nimmt jede `@analysisFreshness`-Zeile aus dem Format-E-Text,
an der einen Stelle, die beide Pfade (Ein-Kandidat, Best-of-N) passieren — nach den Fragezeilen, vor dem
Gate. Die Spur nennt die Zahl der entfernten Zeilen. Kein Hinweis ans Modell: der Stempel kommt in keinem
Prompt des Executors vor.

## Abnahme

`tests/task-analysen.test.ts`: ein Batch, der nur den Stempel schreibt, lässt den Task offen (kein Stempel
am SYS, `taskStempel` leer, Spur vermerkt die Entfernung); `ohneStempelzeilen` nimmt nur die Stempelzeile.

## Nicht in diesem CR

Der Client-Weg mit `graph_mutate` (Profil cloud, Skills) setzt den Stempel weiter selbst — ITEM-2026-684.

## Umfang laut Graph

`FUNC-gate-client`, `REQ-analyse-artefakt-vor-stempel`. Zwei Dateien.
