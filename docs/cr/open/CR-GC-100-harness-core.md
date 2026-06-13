# CR-GC-100 — GraphCode Harness Core

**Status:** Open · **Modul:** `src/harness.ts` · **Prio:** 1a · **Stand:** 2026-06-13
**Dependency:** CR-195b (KuzuAdapter ✓) · **Spec:** `docs/SPEC.md` §2.1, §3, §4 · bok governance §1–§3

## Ziel

`GraphCodeHarness` lauffähig: `loadGraph` / `saveGraph` / `mutate` / `evaluateRules` / `close`
gegen lokalen Kuzu, mit dem Apply-Gate (L1/L2).

## Tasks

- **Task 0 — Build-Setup (Blocker D5):** graphcode baufähig machen. `workspace:*`-Deps auflösen
  (Entscheidung: Monorepo-Package in sigloch-modules **oder** versionierte/file-Deps im
  Standalone-Repo). `npm install` + `tsc --noEmit` grün **vor** jedem Code.
- **Task 1 — D1 Schema-SSOT:** `HarnessConfig` / `MutateCommand` / `MutateResult` aus `harness.ts`
  nach `@sigloch/contracts` (eigener `harness`-Export, **nicht** `/se`) verschieben, dort
  Version-Bump, in `harness.ts` importieren, lokale Defs löschen (keine parallelen Pfade).
- **Task 2 — `mutate()` Apply-Gate** (SPEC §3): pre-commit-Hooks → in-memory apply →
  `evaluateRules()` gegen `contracts/se` `V3_RULES` (L2, kein lokaler Parser) → `saveGraph` falls
  keine error-Violations → post-apply-Hooks → Trajectory-Emit.
- **Task 3 — Single Kuzu-Owner** (SPEC §4): genau ein Host öffnet `.graphcode/kuzu`; multi-thread
  reads/writes im Owner; kein 2. DB-Handle.
- **Task 4 — R1 Confidence:** `MutateResult` trägt Confidence/Tier-Feld (auto/suggest/block).

## Gate (Acceptance)

- [ ] `tsc` + `npm test` grün; Server/Harness instanziiert gegen Disk-Kuzu (kein `:memory:`).
- [ ] Unit: `mutate()` wendet an, gibt Violations zurück, blockt bei error-Severity.
- [ ] `evaluateRules()` nutzt `V3_RULES` (Assertion: Rule-IDs == contracts).
- [ ] D1 erledigt: keine lokalen Schema-Defs mehr in `harness.ts` (grep leer).

## Drift-Locks

L1 (ein Gate/Repo, ein Kuzu-Owner) · L2 (V3_RULES, kein paralleler Parser).
