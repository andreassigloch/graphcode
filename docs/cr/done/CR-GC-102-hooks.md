# CR-GC-102: Hook-System — pre-commit / post-apply / nightly

**Status:** Done (2026-06-17) · **Modul:** `src/hooks.ts` (Graph: `MOD-hooks`)
**Refs:** ADR-001 §4 (Learning-Emission, Live-Event) · bok `graphcode-governance.md` §2.3
**Graph:** `CR-GC-102 -relation→ MOD-hooks` (+ REQs unten) · **Dependency:** CR-GC-100 · **Max Files:** 5

## Problem (Why)
Das Gate braucht Erweiterungspunkte: Validierung **vor** dem Write (pre-commit), Emission/Cleanup **nach** dem
Apply (post-apply → Live-Update-Event fürs Dashboard + Trajectory für die Learning-Engine), und Aggregation
(nightly). Ohne deterministische, blockierbare Hooks fehlt die Kopplung an Viewer (Ziel b) und Learning.

## Entscheidung
Drei Extension-Points mit **stabiler Ausführungsreihenfolge** (L3); `preCommitTimeout` (default 5000ms).
post-apply emittiert **genau ein** Live-Update-Event (SSE invalidate) — alle Write-Pfade einheitlich, keine
parallelen Pfade. Trajectory/Outcome append-only nach `.aimprove/*.jsonl` (Format stabil, L1).

## Scope (realisiert vorhandene Graph-Knoten)
FUNC: `FUNC-emit-trajectory`, `FUNC-emit-update-event` (→ `MOD-hooks`).
REQ: `REQ-hook-extension-points`, `REQ-precommit-timeout`, `REQ-hook-order-deterministic`,
`REQ-trajectory-emit`, `REQ-mutation-emits-event`, `REQ-versioned-cache`, `REQ-auto-persist-merge`.

## Akzeptanzkriterien (Graph: TEST-Knoten)
`TEST-live-view` grün (jede Mutation → genau ein Event, korrekte domains) ·
`TEST-learning-emit` grün (append-only, Format stabil) · pre-commit kann Mutation blocken · Hook-Order deterministisch.

## Dependencies
CR-GC-100 (Harness/Gate).
