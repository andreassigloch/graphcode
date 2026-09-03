# CR-GC-471 — Messung in den Kern (C1c): `readiness`

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 (Commit `20a6e28`) · **Herkunft:** CR-GC-467 Entscheidung 1; vierter
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

- [x] Kein Verweis auf `projections/readiness` mehr in `src/`, `tests/`, `scripts/` (`src/README.md`: Prosa nachgezogen, Messungs-Absatz ergänzt).
- [x] Build grün; zehn der elf Tests + Ratchet grün. **Vorbestand, nicht dieser CR:**
      `readiness.completeness.test.ts` › *a FLOW without a SCHEMA holds CDR red* fällt identisch auf
      HEAD (Worktree-Gegenprobe) — der Test fingiert eine `SC-04`-Verletzung, die seit contracts
      10.0.0 nicht mehr existiert (CR-SM-271 Teil 2). Eigener CR: Test auf R-18 umstellen.
      `conformance.test.ts` war nur im Parallel-Lauf rot, isoliert 16/16 grün.
- [x] Gate: dryRun ohne Blocker, apply (graphVersion 235 → 236), Export — Diff = zwei `realRef.file` + eine `allocate`; Fit-Advisory Δ nur `scalability +0,017`.

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
