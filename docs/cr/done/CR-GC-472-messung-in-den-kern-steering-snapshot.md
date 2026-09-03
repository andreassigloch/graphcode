# CR-GC-472 — Messung in den Kern (C1b): `steering-snapshot`

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467 Entscheidung 1; letzter
Tilgungsschritt der Messungs-Gruppe nach CR-GC-468/469/470/471

## Root Cause

`takeSteeringSnapshot` (Messung des Steuerungszustands) und `computeSteeringDelta` (Differenz
zweier Messungen, rankt den Executor) liegen in `projections`; vier Inversionen aus CR-GC-467
(`executor`, `executor-rank`, `generate`, `steering`). Die Datei importiert `kernel/conformance`
und `kernel/measure/nd-similarity` — nach dem Move Geschwister.

## Schnitt — bewusst 7 Dateien

Datei + sechs Importeure = **7**, eine über der harten Grenze. Die Symbolanalyse zeigte zwei
Hälften (Snapshot ← report/steering/generate/write; Delta ← executor/executor-rank/write), die
sich in drei ≤6-CRs hätten trennen lassen. **Auftraggeber-Entscheidung 2026-09-03: der
7-Dateien-Move ist zugelassen** — mechanisch, ohne Shim, durch Build, Ratchet und volle Suite
abgesichert. Der Split bleibt als Beobachtung stehen: der Executor hängt nur am Delta.

## Änderung

- `git mv src/projections/steering-snapshot.ts src/kernel/measure/steering-snapshot.ts`; eigene
  Importe `../kernel/conformance.js` → `../conformance.js`, `../kernel/measure/nd-similarity.js`
  → `./nd-similarity.js`.
- Sechs Importeure: `loop/executor`, `loop/executor-rank`, `loop/generate`, `loop/steering`,
  `projections/report`, `surface/write` (die letzten zwei zeigen jetzt nach unten). Fünf Tests folgen.
- Ratchet **30 → 26**.
- Gate: `realRef.file` an `FUNC-take-steering-snapshot`, `FUNC-compute-steering-delta`,
  `SCHEMA-steering-snapshot`, `SCHEMA-steering-delta`; `allocate` beider FUNCs von
  `MOD-projections` nach `MOD-kernel`.

## Akzeptanzkriterien

- [x] Kein Verweis auf `projections/steering-snapshot` mehr in `src/`, `tests/`, `scripts/`.
- [x] Build grün; `steering-snapshot` (8), `steering.measurement-path` (5), Ratchet (3) grün.
      `steering.architecture-causality`: 3 Rote (T-C2 ×2, T-C4 — `graph_suggest` liefert auf der
      Fixture 0 auf `arch`) fallen **identisch auf `c826ff2`** (vor jedem C1-Move) und auf HEAD —
      Worktree-Gegenprobe. Vorbestand, nicht dieser CR; eigener Befund für CR-DRAFT-GC-466 (M3).
- [x] Gate: dryRun ohne Blocker, apply (graphVersion 236 → 237), Export — Diff = vier `realRef.file` + zwei `allocate`; Fit-Advisory Δ nur `scalability +0,018`.

## Dateien

1. `src/kernel/measure/steering-snapshot.ts` (verschoben, zwei Importe angepasst)
2. `src/loop/executor.ts`
3. `src/loop/executor-rank.ts`
4. `src/loop/generate.ts`
5. `src/loop/steering.ts`
6. `src/projections/report.ts`
7. `src/surface/write.ts`

Folgen: fünf Tests, `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
