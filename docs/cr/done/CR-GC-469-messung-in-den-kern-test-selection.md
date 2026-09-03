# CR-GC-469 — Messung in den Kern (C1e): `test-selection`

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467 Entscheidung 1; zweiter
Tilgungsschritt nach CR-GC-468

## Root Cause

`impactedTests` (welche Tests muss ich für diesen Change fahren) liegt in `projections`, wird aber
von `kernel/harness.ts` gebraucht — Inversion aus CR-GC-467. Es ist Messung (Graph → Auswahl),
keine Projektion. Die Datei importiert nichts Relatives.

## Änderung

- `git mv src/projections/test-selection.ts src/kernel/measure/test-selection.ts`
- Drei Importeure: `kernel/harness` (jetzt `./measure/`), `projections/report`,
  `projections/test-selection-audit` (beide zeigen jetzt nach unten). Ein Test folgt.
- Ratchet **36 → 35**.
- Gate: `realRef.file` an `SCHEMA-impacted-tests` und `SCHEMA-test-selection` (SCHEMAs tragen
  keine `allocate`). `test-selection-audit` bleibt Projektion — es *berichtet* über die Auswahl.

## Akzeptanzkriterien

- [x] Kein Verweis auf `projections/test-selection` mehr in `src/`, `tests/`, `scripts/`.
- [x] Build grün; `test-selection.audit.test.ts` + Ratchet grün; volle Suite im Pre-Commit grün.
- [x] Gate: dryRun ohne Blocker, apply (graphVersion 233 → 234), Export — Diff = genau zwei `realRef.file`; Fit-Advisory Δ = 0 in allen sechs Dimensionen.

## Dateien

1. `src/kernel/measure/test-selection.ts` (verschoben)
2. `src/kernel/harness.ts`
3. `src/projections/report.ts`
4. `src/projections/test-selection-audit.ts`

Folgen: `tests/test-selection.audit.test.ts`, `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
