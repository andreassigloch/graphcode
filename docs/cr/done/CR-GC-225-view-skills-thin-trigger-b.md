# CR-GC-225 — Skills: View-Skills → Thin-Trigger (Gruppe B)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 5
**Graph (SSOT):** seedet (gate-only) `REQ-view-thin-trigger` (geteilt mit CR-224), `FUNC-skill-view-trigger`
(→ `.claude/skills/se-view-*.md`), `TEST-skills-conformance` (existing), `CR-GC-225`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Fortsetzung von CR-GC-224 für die Plan-/Log-/Create-Render-Views. Gleiche Begründung: nicht-deterministisches
Agent-Rendern ist ein Parallelpfad zu den deterministischen Views.

## Decision

- Gruppe B auf Thin-Trigger: `se-view-implplan`, `se-view-intplan`, `se-view-changelog`, `se-view-conops`, `se-view-trade`.
- Anmerkung: `conops` / `trade` rendern die **nach** dem Create (CR-GC-223) im Graph liegende Struktur; `implplan`
  rendert die von `se-plan` (CR-GC-209) erzeugten MS/CR; `intplan` ist reiner Render (originiert nichts).

## Akzeptanz

- Jeder Gruppe-B-Skill triggert ausschließlich die deterministische View; identischer Output bei Re-Run.
- Skills-Conformance grün; `npm test` grün.

## Dependencies

**CR-GC-220** (Views), **CR-GC-223** (conops/trade Create), **CR-GC-209** (se-plan für implplan). Schwester: **CR-GC-224**.
