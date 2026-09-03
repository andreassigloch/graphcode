# CR-GC-468 — Messung in den Kern (C1a): `nd-similarity`

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Entscheidung 1 („Messung
gehört in den Kern, unter das Gate"); erster von fünf Tilgungsschritten der Altlast

## Root Cause

`nd-similarity` (Ähnlichkeitsmatrizen, Near-Duplicate-Erkennung) liegt in `projections`, wird aber
vom Gate gebraucht: `kernel/evaluation.ts` importiert es — eine der 40 Inversionen aus CR-GC-467.
Es ist keine Projektion (Graph → Artefakt), sondern Messung (Graph → Zahl). Die Datei selbst
importiert nichts aus `projections` — sie kann ohne neue Inversion wandern.

## Änderung

- `git mv src/projections/nd-similarity.ts src/kernel/measure/nd-similarity.ts` — `measure/` ist
  die Ebene *im* Kern (Speicher · Messung · Gate), nicht ein sechstes Modul.
- Fünf Importeure umgestellt: `kernel/evaluation`, `loop/executor`, `loop/suggest`,
  `loop/target-profile`, `projections/steering-snapshot` (dessen Import zeigt jetzt nach unten).
  Zwei Tests folgen dem Pfad. **Kein Shim, kein Re-Export am alten Ort** — kein paralleler Pfad.
- Ratchet (`tests/import-boundaries.test.ts`): die vier `→ projections/nd-similarity`-Einträge
  gestrichen, **40 → 36**.
- **Modell durchs Gate** (`graph_mutate` über den Host-Socket, dryRun vor apply):
  `realRef.file` nachgezogen; `allocate` von `MOD-projections` nach `MOD-kernel` — das Modell
  sagt, wo der Code liegt. Die `compose`-Kante aus `FUNC-block-antrieb` (Wertbaum) bleibt: MOD
  und FUNC sind zwei Bäume (CR-GC-467).

## Schnitt

Datei + fünf Importeure = **6 Dateien** (Grenze). Test-Pfade und die Ratchet-Liste sind
mechanische Folgen desselben Moves, kein eigener Scope. `steering-snapshot`, `readiness`,
`fit-advisory`, `test-selection` folgen in C1b–C1e; `steering-snapshot` hat sechs Importeure und
ist damit der eine Schritt, der die Grenze um eins überschreitet — dort wird vorher gefragt.

## Akzeptanzkriterien

- [x] Kein Verweis auf `projections/nd-similarity` mehr in `src/`, `tests/`, `scripts/`.
- [x] `npm run build` grün; `nd-similarity.test.ts`, `evaluation.near-duplicate.test.ts`,
      `import-boundaries.test.ts` grün; volle Suite im Pre-Commit grün.
- [x] Ratchet 40 → 36, die vier gestrichenen Einträge existieren nicht mehr (Test 3 grün).
- [x] Gate: dryRun ohne Blocker (graphVersion 232 → 233), apply, SSOT-Export — `git diff docs/graph/`
      zeigt genau `realRef.file` und die `allocate`-Kante, sonst nichts. Fit-Advisory meldet
      `modifiability −0,06` (Knoten wandert ins größere Modul) — erwartet, kein Urteil über den Zug
      (CR-GC-467: der Vektor kennt keine Import-Kanten).

## Dateien

1. `src/kernel/measure/nd-similarity.ts` (verschoben)
2. `src/kernel/evaluation.ts`
3. `src/loop/executor.ts`
4. `src/loop/suggest.ts`
5. `src/loop/target-profile.ts`
6. `src/projections/steering-snapshot.ts`

Folgen desselben Moves: `tests/nd-similarity.test.ts`, `tests/evaluation.near-duplicate.test.ts`,
`tests/import-boundaries.test.ts`, `docs/graph/graphcode.graph.json` (Export), dieser CR.
