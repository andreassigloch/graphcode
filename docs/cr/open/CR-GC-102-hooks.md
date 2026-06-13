# CR-GC-102 — GraphCode Hook-System

**Status:** Open · **Modul:** `src/hooks.ts` · **Prio:** 1a · **Stand:** 2026-06-13
**Dependency:** CR-GC-100 · **Spec:** `docs/SPEC.md` §2.3 · bok governance §2.3 · `docs/RECOMMENDATIONS.md` R2

## Ziel

`HookSystem` mit drei Extension-Points: `pre-commit` (Validierung vor Write), `post-apply`
(Emission/Cleanup), `nightly-batch` (Aggregation/Learning-Trigger).

## Tasks

- `registerHook(type, handler)` + `runPreCommitHooks` / `runPostApplyHooks` / `scheduleNightlyBatch`.
- Storage `.graphcode/hooks/`, `preCommitTimeout` (default 5000 ms).
- **post-apply → learning-engine**: Trajectory/Outcome append-only nach `.aimprove/*.jsonl`.
- **R2 — Auto-Rebuild/-Persist bei Commit** + conflict-free Merge-Strategie fürs Graph-Artefakt
  (zusammen mit deterministischem Codec aus CR-GC-103).

## Gate (Acceptance)

- [ ] Hook-Exec-Tests: pre-commit kann Mutation blocken; post-apply läuft nach erfolgreichem Apply.
- [ ] learning-engine-Emit: Trajectory-Datei wird append-only geschrieben (Format stabil, L1).
- [ ] Hook-Ausführungsreihenfolge deterministisch (L3).

## Drift-Locks

L3 (Hook-Execution-Order stabil) · L1 (Trajectory/Outcome-Format stabil).
