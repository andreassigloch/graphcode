# CR-GC-478 — Hilfe ist eine Projektion (C3b)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang C3; nach CR-GC-477

## Root Cause

`projections/report.ts` — der Readiness-Report — rendert Hilfetexte (`helpEntry`,
`contextualHelp`) und das Format-E-Beispiel (`formatEExampleFor`) und importiert sie aus
`surface`: zwei Inversionen aus CR-GC-467. Die vier Dateien `help.ts` (269 Zeilen),
`help-content.ts` (714), `panels.ts` (40), `authoring-example.ts` (35) sind reiner Inhalt und
Nachschlagen — Graph/Regel → Text. **Kein** Transport, kein MCP, kein CLI: außer dem Barrel und
`report` importiert sie niemand in `surface`. Sie lagen dort, weil das `graph_help`-Tool sie
zuerst brauchte; das Tool ist Oberfläche, der Text ist Projektion.

## Änderung

- `git mv` der vier Dateien nach `src/projections/`; ihre eigenen Importe bleiben gültig
  (`../kernel/measure/readiness` gleiche Tiefe, `./help-content`, `./panels` Geschwister).
- `index.ts`: Re-Export-Pfade (help, help-content, panels). `report.ts`: `./help.js`,
  `./authoring-example.js`. Fünf Tests folgen dem Pfad.
- Ratchet **16 → 14**.
- Gate (Remap): `realRef.file` aller Knoten auf die vier Dateien; FUNCs, die an `MOD-surface`
  hängen, nach `MOD-projections`.

## Akzeptanzkriterien

- [x] Kein Verweis auf `surface/(help|help-content|panels|authoring-example)` mehr in `src/`,
      `tests/`, `scripts/`; Build grün.
- [x] `help*`, `panels`, `mutate.formate-name`, `readiness.model`, Ratchet grün; volle Suite im
      Pre-Commit grün.
- [x] Gate: Remap über alle vier Dateien — **0 Knoten** tragen einen `realRef` darauf; kein Batch,
      SSOT unverändert.

## Dateien

1. `src/projections/help.ts` (verschoben)
2. `src/projections/help-content.ts` (verschoben)
3. `src/projections/panels.ts` (verschoben)
4. `src/projections/authoring-example.ts` (verschoben)
5. `src/index.ts`
6. `src/projections/report.ts`

Folgen: fünf Tests, `tests/import-boundaries.test.ts`, SSOT-Export, dieser CR.
