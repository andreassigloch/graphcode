# CR-GC-471 — Messung in den Kern (C1c): `readiness`

**Status:** open · **Angelegt:** 2026-09-03 · **Herkunft:** CR-GC-467 Entscheidung 1; vierter
Tilgungsschritt nach CR-GC-468/469/470

## Root Cause

`computeReadiness` / `computePhaseReadiness` — die Dimensionswerte, aus denen das Gate seinen
`steeringDelta` bildet und `graph_readiness` antwortet — liegen in `projections`. Zwei
Inversionen aus CR-GC-467 (`kernel/evaluation`, `loop/generate`). Readiness ist die Messung, mit
der der Kern urteilt; `report` und `help` zeigen sie an. Die Datei importiert nichts Relatives.

## Änderung

- `git mv src/projections/readiness.ts src/kernel/measure/readiness.ts`
- Fünf Importeure: `index.ts` (Paket-Oberfläche — Symbole bleiben, nur der Pfad wandert),
  `kernel/evaluation` (`./measure/`), `loop/generate`, `projections/report`, `surface/help`
  (die letzten drei zeigen jetzt nach unten). Elf Tests folgen dem Pfad — mechanisch.
- Ratchet **32 → 30**.
- Gate: `realRef.file` an `FUNC-compute-phase-readiness` und `SCHEMA-phase-readiness`; `allocate`
  des FUNC von `MOD-projections` nach `MOD-kernel`.

## Akzeptanzkriterien

- [ ] Kein Verweis auf `projections/readiness` mehr in `src/`, `tests/`, `scripts/`.
- [ ] Build grün; die elf readiness-/help-/steering-Tests + Ratchet grün; volle Suite im
      Pre-Commit grün.
- [ ] Gate: dryRun ohne Blocker, apply, Export — Diff = zwei `realRef.file` + eine `allocate`.

## Dateien

1. `src/kernel/measure/readiness.ts` (verschoben)
2. `src/index.ts`
3. `src/kernel/evaluation.ts`
4. `src/loop/generate.ts`
5. `src/projections/report.ts`
6. `src/surface/help.ts`

Folgen: elf Testdateien (Pfad), `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
Damit ist die Grenze von sechs Dateien exakt erreicht; `steering-snapshot` (C1b, sechs
Importeure + Datei = 7) ist der eine verbleibende Schritt darüber.
