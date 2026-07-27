# CR-GC-242 — Ship an `se-test-ui` skill + the red-first rule

**Status:** Implemented · 2026-07-08
**Paket:** `@sigloch/graphcode` (shipped skills, `.claude/skills/`)
**Quelle:** graph-view-edit 2026-07-08 blind-render retrospective (IRR
`docs/records/irr-session-2026-07-08.md`) + follow-up. Reference implementation authored in the
consumer repo (`graph-view-edit .claude/skills/se-test-ui/SKILL.md`, commit `97d566a`) but
`graphcode skills sync` overwrites consumer skills — so the guidance cannot persist there. It has
to ship from this package.

## Problem

graphcode ships ~24 `se-*` skills (author, review, retro, irr, the view renderers) but **none
covers test *design***. The 2026-07-08 retro of graph-view-edit surfaced a whole failure class
the family has no skill or forcing-function for:

- Dozens of unit-tested modules shipped **orphaned** — imported by nothing, reachable by no
  gesture — yet green (every assertion called the exported function directly).
- UI assertions checked **DOM presence** (`.isVisible()` on an unstyled `<span>`), never rendered
  pixels. 12 views rendered blind (0-height canvas, default gray nodes) undetected end-to-end.
- **`TEST` nodes were `concept:true`** with no `testRef` — so the VCRM reported "56/56 verified"
  tracing to nothing, and **`graph_readiness` itself reported compliance 1.0 over a hollow
  product**. The 2026-07-05 IRR (A13) had predicted exactly this and was not gated on.

The common root is **false-green**: a green test that was never observed failing for the right
reason. graphcode's `CLAUDE`/guardrails already say "no fake tests" — the gap is *operational,
not declarative*: nothing forces the discipline, and there is no UI-specific method to follow.

## Decision

Ship two things from this package so they reach every consumer via `graphcode skills sync`:

1. **`.claude/skills/se-test-ui.md`** (flat form, like `se-review.md`; realized as a prompt-FUNC
   per `conformance.ts` — file-exists). Content (reference impl in the source above):
   - **Red-first rule** (the operational forcing function): name the failure mode → assert at the
     highest rung that observes it → **observe it red for that exact reason** before trusting
     green. A bug-test must fail on the broken code; a regression guard must fail when the fix is
     reverted.
   - **Assertion ladder**: painted pixels > computed style > rendered geometry > DOM presence
     (presence is necessary, never sufficient).
   - **Four silent seams** (CSS-load / selector-scope / canvas-token / structural-chrome) — each
     detaches styling invisibly; the canvas-token trap (Cytoscape `<canvas>` resolves neither CSS
     nor `var(--token)`) is the recurring one.
   - **Mockup = acceptance criterion**: golden-master the render against `docs/mockups/*`; do not
     re-specify in prose what a template already shows.
   - **Reachability tier**: assert `gesture → handler → command/state → rendered effect`, not the
     unit in isolation.
   - **UI-CR definition-of-done gate**: a screenshot was read (or a `toHaveScreenshot`/paint
     baseline exists); the `TEST` node is `concept:false` with a resolvable `testRef`.

2. **The general red-first rule** is not UI-specific — it belongs in the shipped guardrail too.
   Either a minimal sibling **`.claude/skills/se-test.md`** (name-the-failure → highest-rung
   assertion → red-first → bind `testRef`), or a two-line addition to the scaffolded
   `GRAPHCODE.md`/`CLAUDE` guardrail template. Recommendation: the sibling skill (invocable is a
   stronger forcing function than prose).

## Related (out of scope — separate CRs if pursued)

The skill is guidance; the durable fix is a **forcing function in the model**:

- **`se:author-req`** should refuse to author a `TEST` `concept:true` without a `testRef`
  (R-19 at authoring time, not only as an `it.todo` stub at export). A REQ isn't verifiable until
  its test points at a file.
- **`graph_readiness` / implGate** anti-vacuous-green extension (cf. CR-GC-221): a REQ whose only
  covering `TEST` nodes are `concept:true`/unresolved should surface as a gate warning, so
  "verified" can't be asserted over unbound tests.

## Scope / Files

- `.claude/skills/se-test-ui.md` — new (content from the reference impl).
- `.claude/skills/se-test.md` — new (optional; general red-first) OR guardrail-template edit.
- Graph seed: the new prompt-FUNC(s) + a `verify`/`satisfy` trace so `conformance` (prompt-FUNC
  file-exists) covers them.
- `scripts`/scaffold skills-sync list if it enumerates shipped skills explicitly.

## Acceptance

- [x] `npx @sigloch/graphcode skills sync` installs `se-test-ui.md` **and** `se-test.md` into a
      fresh consumer's `.claude/skills/` — scaffold copies every `se-*.md`; both start with `se-`
      (scaffold/sync test green, no explicit enumeration to bump).
- [x] `graphcode` conformance green for the new prompt-FUNC(s) (file-exists) — `FUNC-test-ui` +
      `FUNC-test` seeded (prompt codeRef → the skill files); `conformance.test.ts` green.
- [x] The skill body contains: red-first, the assertion ladder, the four seams, mockup-as-criterion,
      the reachability tier, and the UI-CR DoD gate (`se-test-ui.md`).
- [x] Both skills reference a live MCP tool (`graph_tests` / `graph_readiness`) → `skills.mcp-conformance` green.
- [~] Re-running `skills sync` in graph-view-edit replaces the locally-authored copy with the shipped
      one — consumer-side action; the shipped `se-test-ui.md` is the superset of the reference impl
      (`graph-view-edit …/se-test-ui/SKILL.md`, generalized off repo-specific paths).

## Umsetzung (Ist)

- **`.claude/skills/se-test-ui.md`** (flat form) — generalisiert aus der Referenz-Impl (Cytoscape/gve →
  „canvas/WebGL resolves no CSS" als benanntes Beispiel), alle sechs Pflicht-Inhalte.
- **`.claude/skills/se-test.md`** (sibling) — die allgemeine Red-First-Regel + Anti-Pattern
  (orphan/proxy/vacuous-green); Empfehlung des CR (Skill statt Guardrail-Prosa) umgesetzt.
- **Graph:** `FUNC-test-ui` + `FUNC-test` (prompt-codeRef), je `allocate`→`MOD-skills` +
  `satisfy`→`REQ-code-governed-quality` — via `graph_mutate` (Gate, auto-apply, 0 Violations),
  dann `graph_export`. Committed JSON: 340 nodes / 714 edges. Kein Hand-Edit (deny-hook).
- **Kein** Version-Bump nötig: Skill-Count wird dir-derived geprüft (CR-GC-205), Conformance
  registry-derived.
