# CR-GC-224 — Skills: View-Skills → Thin-Trigger (Gruppe A)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 6
**Graph (SSOT):** seedet (gate-only) `REQ-view-thin-trigger`, `FUNC-skill-view-trigger` (→ `.claude/skills/se-view-*.md`),
`TEST-skills-conformance` (existing), `CR-GC-224`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** Q1-Entscheidung „Convert, but keep skill as thin trigger".

## Problem (Why)

Die `se-view:*`-Skills rendern heute selbst (agent-formatiert = nicht-deterministisch) — **Parallelpfad** zu den
deterministischen Views aus CR-GC-220. Entscheidung (User): Views werden Code; der Skill bleibt als **Thin-Trigger**,
der die deterministische Export-View aufruft (Discoverability erhalten, **kein** Agent-Formatieren).

## Decision

- Gruppe A auf Thin-Trigger umschreiben: `se-view-arch`, `se-view-icd`, `se-view-rtm`, `se-view-nfr`,
  `se-view-testconcept`, `se-view-testmatrix`. Jeder Skill ruft **nur** die zugehörige deterministische View
  (Export / MCP-Render) auf und gibt sie aus — keine eigene Query-Formatierung.
- Kein toter Pfad, kein Parallel-Renderer (keine parallelen Pfade).

## Akzeptanz

- Jeder Gruppe-A-Skill triggert ausschließlich die deterministische View; identischer Output bei Re-Run.
- Skills-Conformance grün; `npm test` grün.

## Dependencies

**CR-GC-220** (Views existieren). Schwester: **CR-GC-225** (Gruppe B).
