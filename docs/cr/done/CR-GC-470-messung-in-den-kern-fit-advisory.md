# CR-GC-470 — Messung in den Kern (C1d): `fit-advisory`

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467 Entscheidung 1; dritter
Tilgungsschritt nach CR-GC-468/469

## Root Cause

`computeFitAdvisory` (der ℝ⁶-Vektor vorher/nachher je Mutation) liegt in `projections`, wird aber
vom Gate gebraucht — `kernel/harness.ts` legt es jedem `MutateResult` bei. Drei Inversionen aus
CR-GC-467 (`harness`, `executor`, `executor-rank`). Es ist Messung: das Gate urteilt damit,
`metrics` zeigt es nur an. Die Datei importiert `kernel/conformance` — nach dem Move ein
Geschwister-Import, keine Inversion.

## Änderung

- `git mv src/projections/fit-advisory.ts src/kernel/measure/fit-advisory.ts`; eigener Import
  `../kernel/conformance.js` → `../conformance.js`.
- Vier Importeure: `kernel/harness` (`./measure/`), `loop/executor`, `loop/executor-rank`,
  `projections/metrics` (zeigt jetzt nach unten). Zwei Tests folgen.
- Ratchet **35 → 32**.
- Gate: `realRef.file` an `FUNC-fit-advisory` und `SCHEMA-fit-advisory`; `allocate` des FUNC von
  `MOD-projections` nach `MOD-kernel`.

## Akzeptanzkriterien

- [x] Kein Verweis auf `projections/fit-advisory` mehr in `src/`, `tests/`, `scripts/`.
- [x] Build grün; `metrics.test.ts`, `steering.convergence-witness.spike.test.ts`, Ratchet grün;
      volle Suite im Pre-Commit grün.
- [x] Gate: dryRun ohne Blocker, apply (graphVersion 234 → 235), Export — Diff = zwei `realRef.file` + eine `allocate`; Fit-Advisory Δ nur `scalability +0,009`.

## Dateien

1. `src/kernel/measure/fit-advisory.ts` (verschoben, ein Import angepasst)
2. `src/kernel/harness.ts`
3. `src/loop/executor.ts`
4. `src/loop/executor-rank.ts`
5. `src/projections/metrics.ts`

Folgen: zwei Tests, `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
