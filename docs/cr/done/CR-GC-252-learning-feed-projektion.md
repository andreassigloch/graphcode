# CR-GC-252 — Learning-Feed = Projektion aus dem Operations-Log

**Status:** done · 2026-07-20
**Repos:** graphcode (`src/emit.ts`, `src/mcp-tools.ts`) + sigloch-modules (`@sigloch/learning-core`)
**Quelle:** AiSE-Familien-Review 2026-07 (`bok/docs/konzept/aise-family-review-2026-07/02-operations-log-and-seams.md` + `03-remediation-roadmap.md`, CR-F)
**Dependency:** sigloch-modules **CR-207** (Operations-Log im Store-Modul) — bereits gelandet (done/).

## Problem

`src/emit.ts` schreibt `trajectory.jsonl` als **parallelen** Schreibpfad neben dem Audit-/Operations-Log — zwei Wahrheiten über dieselben Mutationen, Hand-Interface ohne Zod-Schema. Der Learning-Feed ist konzeptionell eine *Projektion* des einen Logs (ein Log — Learning/Doku/Rollback), keine eigene Quelle.

## Änderung

1. `trajectory.jsonl` nicht mehr direkt in `emit.ts` schreiben — aus dem `OperationsLog` (CR-207) ableiten.
2. Zod-Schemas `Trajectory` / `Outcome` / `PublishedModels` in `@sigloch/learning-core` definieren (Schema der Projektion); `published-models.json`-Schema spezifizieren.
3. `emit.ts` konsumiert die learning-core-Schemas; Hand-Interface gelöscht.

## Betroffene Dateien (≤6)

1. `src/emit.ts` — Projektion statt Parallel-Write
2. `sigloch-modules/packages/learning-core/src/` — Zod-Schemas (Trajectory/Outcome/PublishedModels)
3. `sigloch-modules/packages/learning-core/tests/` — Schema-Tests
4. `tests/` (graphcode) — Projektion-aus-Log-Test

## Akzeptanz

- [x] Ein Seam, ein Schema: `trajectory.jsonl` entsteht nur noch als Projektion des Operations-Logs
      (`materializeTrajectory` re-projiziert den Log nach jedem `recordAudit`-Write — full rewrite,
      kein Parallel-Write; der Log ist die einzige Wahrheit).
- [x] Kein Hand-Interface mehr in `emit.ts` — `TrajectoryEntry`/`makeTrajectoryHook` gelöscht;
      `Trajectory`/`Outcome`/`PublishedModels` + `projectTrajectory` Zod aus `@sigloch/learning-core`.
- [x] graphcode-Suite grün (300/300); learning-core Projektions-Tests grün (8/8).

## Umsetzung (Ist)

- `@sigloch/learning-core/interfaces/trajectory.ts`: `TrajectorySchema`/`OutcomeSchema`/
  `PublishedModelsSchema` + `projectTrajectory(entry)` (total über unattribuierte Log-Entries →
  `consumerId ''`, wirft nie und blockiert nie den Source-of-truth-Write).
- `src/emit.ts`: `makeTrajectoryHook`/`TrajectoryEntry` entfernt; `materializeTrajectory(log, outDir)`
  projiziert den ganzen Log; `registerEmitters` registriert nur noch das Live-Update-Event.
- `src/mcp-tools.ts`: `materializeTrajectory` nach `recordAudit` verdrahtet — `repoRoot` erst zur
  Laufzeit gelesen (Host-Shim-Proxy-Invariante: Template bleibt bind-time unbound).
- SSOT-Modell: `FUNC-emit-trajectory` codeRef `makeTrajectoryHook` → `materializeTrajectory` per
  Apply-Gate re-pointet (RC-01-clean), Views neu gerendert.
- CR-254 (ast-grep Multi-Language) bleibt **backlog** — Trigger (erstes Nicht-JS/TS-Repo) nicht erfüllt.
