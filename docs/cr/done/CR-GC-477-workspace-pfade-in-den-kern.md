# CR-GC-477 — Die Pfade des Arbeitsbereichs gehören dem Kern (C3a)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang C3; Fortsetzung
von CR-GC-475 (`KUZU_DIR`)

## Root Cause

`GRAPHCODE_DIR` (`.graphcode`) und `TRAJECTORY_FILE` (`trajectory.jsonl`) sind in
`surface/scaffold-templates.ts` definiert — dort, wo `init` sie zuerst brauchte. Zwei
Projektionen (`export`, `trajectory`) holen sie von dort: Projektion importiert Oberfläche, zwei
Inversionen aus CR-GC-467. `scaffold-templates` selbst benutzt die Konstanten nur in einem
Kommentar. Der Ort des Arbeitsbereichs ist Kern-Wissen — CR-GC-475 hat `kernel/workspace.ts`
dafür angelegt.

## Änderung

- `kernel/workspace.ts`: `GRAPHCODE_DIR`, `TRAJECTORY_FILE`; `KUZU_DIR` wird `${GRAPHCODE_DIR}/kuzu`
  (derselbe String, jetzt aus einer Quelle).
- `surface/scaffold-templates.ts`: die zwei Definitionen raus — kein Re-Export, kein zweiter Weg.
- Importeure: `surface/tool-context` (`GRAPHCODE_DIR`), `surface/scaffold` (beide, mehrzeiliger
  Import — vom ersten Grep übersehen, vom Compiler gefunden), `projections/export`
  (`TRAJECTORY_FILE`), `projections/trajectory` (beide) — aus `kernel/workspace`.
- Ratchet **18 → 16**.

## Akzeptanzkriterien

- [x] Kein `GRAPHCODE_DIR`/`TRAJECTORY_FILE` mehr in `scaffold-templates.ts`; Build grün.
- [x] `cli.scaffold` (44), `auto-export*`, `trajectory*`, Ratchet grün; volle Suite im Pre-Commit grün.
- [x] Kein Modellknoten trägt einen `realRef` auf `scaffold-templates.ts` — kein Gate-Batch nötig.

## Dateien

1. `src/kernel/workspace.ts`
2. `src/surface/scaffold-templates.ts`
3. `src/surface/tool-context.ts`
4. `src/projections/export.ts`
5. `src/projections/trajectory.ts`
6. `src/surface/scaffold.ts`

Folgen: `tests/import-boundaries.test.ts`, dieser CR.
