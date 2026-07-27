# CR-GC-223 — Skills: Creation-Skills (FMEA-Render-Rename + se-irr / se-conops / se-trade)

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 5
**Graph (SSOT):** seedet (gate-only) `REQ-creation-skills`, `FUNC-skill-creations` (→ `.claude/skills/se-*.md`),
`TEST-skills-conformance` (→ `tests/skills.mcp-conformance.test.ts`), `CR-GC-223`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [document-specimens.md #1/#10/#11/#15](../../proposals/document-specimens.md)

## Problem (Why)

`se-view:irr` rendert tatsächlich **FMEA**-Inhalt (S/O/D) unter falschem Label „Initial Risk Review" — Kollision mit
`docs/records/irr.md` („Internal Readiness Review"). Es fehlen **Create**-Skills für die Urteils-Artefakte: ConOps
(operational, **vor** UC), Assumption-Review (unbewiesene Annahmen, commit-gepinnt → CRs), Trade (Spike→CR).
Determinismus-Regel: Create = Urteil = Skill (mutiert Graph) — nur das ist im Skill korrekt.

## Decision

- **Rename** `.claude/skills/se-view-irr.md` → `se-view-fmea.md` (FMEA-Render-Trigger; Label „FMEA").
- **`se-irr.md`** (Assumption Review): detektiert unbewiesene Annahmen → immutable, commit-gepinntes
  `docs/records/irr-<commit>.md` → Promotion zu CRs. Klar **nicht-INCOSE** (umbenannt von „IRR").
- **`se-conops.md`**: operational concerns (config/creds/user-mgmt/deploy/…) **vor UC**; schreibt operational `REQ`
  durchs Gate (CREATE+write), unbeantwortete Concern = blockierende Lücke.
- **`se-trade.md`**: Spike/Concept (≥2 Optionen) → Entscheidung im CR + `relation(decides / superseded-by)`
  (SP-1-Muster, **kein** neuer Element-Typ).
- `se-fmea.md` aktualisieren: realer Output-Pfad (`docs/records/failure-mode-analysis.md`), Render = `se-view-fmea`.

## Akzeptanz

- Kein Skill labelt FMEA-Render als „IRR"; `irr.md`-Kollision aufgelöst.
- `se-conops` / `se-irr` / `se-trade` mutieren **ausschließlich** durchs Gate (gate-only-writes).
- Skills-Conformance grün (kein dead-path, Liste 1:1 ge-shippt); Counts aus Registry (CR-205) — keine Count-Brüche.
- `npm test` + `build` grün.

## Dependencies

**CR-GC-220** (`fmea` / `conops` / `trade`-Render-Views existieren).
