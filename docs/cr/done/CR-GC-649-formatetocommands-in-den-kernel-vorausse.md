# CR-GC-649: formatEToCommands nach loop — Voraussetzung fuer den Executor-Preflight auf Format-E

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-547 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-547.json (Lane: code)

---

## Befund

Voraussetzung fuer CR-GC-650 (Executor emittiert Format-E): der Executor-Preflight
(`src/loop/preflight.ts`) muss einen Format-E-Batch in `MutateCommand[]` uebersetzen, um ihn
vor dem Gate zu pruefen — heute reicht er Format-E ungeprueft durch (Zeile 131). Die EINE
Abbildung (`formatEToCommands`, CR-GC-630) lag in `src/surface/`, und `loop` darf nicht nach
oben importieren (`tests/import-boundaries.test.ts`).

## Umsetzung

Reiner Umzug nach `src/loop/format-e-commands.ts`, kein Verhaltenswechsel.

**Warum `loop` und nicht `kernel`:** `loop` ist die tiefste Schicht, die alle drei Verbraucher
erreichen (graph_mutate und bootstrap in `surface`, Preflight in `loop`). Der Kernel braucht die
Funktion nicht, und `MOD-kernel` traegt laut R-04 bereits 18 Vertraege an seiner Grenze.

Modell-Zug: `FUNC-decode` — `realRef` auf den neuen Pfad, `allocate` MOD-surface → MOD-loop
(`workOrder` nannte genau diese eine Datei). Gate: tier `suggest`, nur die schon bestehenden
RD-04-Warnungen; ℝ⁶-Delta ≤ 0,002.

## Dateien (9)

`src/loop/format-e-commands.ts` (verschoben), `src/surface/write.ts`, `src/surface/bootstrap.ts`,
`tests/bootstrap.test.ts`, `tests/mutate.formate-ops.test.ts`, `tests/helpers/format-e.ts`,
`tests/engpass-ein-leser.test.ts` (erlaubter Leser), `tests/test-selection.audit.test.ts` (Pfad),
`scripts/spike-engpass-known-answer.mjs` (Kontrolle K2 auf `b037983` gepinnt — HEAD wandert,
eine Kontrolle darf das nicht).

## Akzeptanzkriterien

- [x] `npm run build` gruen; import-boundaries gruen (keine neue Schuld).
- [x] Die Format-E-, Bootstrap-, Engpass- und Testauswahl-Tests gruen (9 Dateien, 96 Tests).
- [x] Testauswahl fuer den neuen Pfad liefert denselben Handschnitt wie vorher (test-selection.audit).
