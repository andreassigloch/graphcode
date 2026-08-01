# graphcode — Harness Guardrails

This repo is governed by the **graphcode** graph substrate (MCP-stdio).
Installed via `npx @sigloch/graphcode init`. Lifecycle: `init | update | remove`.

## Graph-first — start here (CR-GC-207)

- **The graph is the SSOT, not the docs.** Do not ingest the doc tree to plan;
  query the live graph through the MCP tools first.
- **Entry = MCP query, never a full doc read:**
  - `graph_readiness` → project status / what is gated.
  - `graph_elements {type}` → a typed slice (REQ, FUNC, TEST, MOD, CR, …).
  - `graph_impact` / `graph_expand` → the exact blast-radius on demand —
    never dump the whole graph.
- **Concurrent writes (OCC, CR-GC-233):** every read returns `graphVersion`; pass it
  as `baseVersion` to `graph_mutate`/`graph_realize` — a stale write is rejected with
  the delta of what changed: re-read, reconcile, retry.
- **Format-E v2:** the type is a `### <TYPE>` section header, never part of the uid
  (e.g. `## Nodes` / `### MOD` / `+ MOD-harness|Harness module`). The `uid.TYPE`
  suffix and the `Name.SY.001` spelling are both **dead** — do not reproduce them.
- **`docs/SPEC.md` is bootstrap input, not authoritative — do not read it** to plan.
- **After seeding the graph, run `graph_export`** so `docs/graph/*.graph.json`
  exists as a readable SSOT for the next session (a single-writer Kuzu store is not).
- **Stuck on an on-screen token** (a rule like `R-04`, a gate like `CDR`, a panel,
  an artifact)? `se:help <token>` explains it in plain + SE terms with the exact fix;
  `se:help` (no arg) or the `graph_help` MCP tool gives ranked, explained next steps.
  This static contract is the entry; `se:help` is its live counterpart (CR-GC-230).

## Available se-* skills (CR-GC-208)

These ship in `.claude/skills/`. Invoke them via the **Skill tool** instead of
planning the same work ad-hoc — each is MCP-driven against the live graph. Run
`npx @sigloch/graphcode skills sync` to refresh them when this package updates.

| skill | purpose |
| --- | --- |
| `se-conops` | Concept of Operations (CREATE) — surface operational concerns (config/creds/user-mgmt/deploy) BEFORE use cases and write them as operational REQ through the gate |
| `se-fmea` | Perform a state-of-the-art FMEA (AIAG-VDA 7-step) on a system, subsystem, or component and integrate findings into the SE-graph + spec |
| `se-irr` | Assumption Review — detect unproven assumptions, pin them in a commit-stamped record, promote the load-bearing ones to CRs (CREATE, gate-only) |
| `se-plan` | Generate the implementation/integration plan — derive the CR build order from the graph's depends-on DAG, cut CRs (≤5 files) whose content is the graph_context slice (not written scope), enforce an io-integration test + submodule build per CR, and write MS/CR/relation through the gate |
| `se-retro` | Post-project retro — compute the 6 graphcode KPIs (graph-vs-grep, tool usage, token/LOC, plan conformance, gate health, binding coverage) and interpret them |
| `se-review` | Readiness gate check — blockers and next steps |
| `se-status` | Show SE project status — readiness, violations, top fixes |
| `se-test-ui` | Design UI tests that verify RENDERED INTENT (the mockup), not DOM presence. Use before writing or reviewing any test for a view/component/renderer, or when a UI CR is about to close. Encodes the anti-false-green rules from the 2026-07-08 blind-render retrospective. |
| `se-test` | The general red-first rule — design any test so you have seen it fail for the right reason before you trust it green. Use before writing or reviewing a test, or when a CR is about to close on "tests green". The UI-specific method is se-test-ui. |
| `se-trade` | Trade Study (CREATE) — evaluate ≥2 options for a Spike/Concept, record the decision in a CR with relation(decides / superseded-by) edges (SP-1 pattern, no new element type) |
| `se-view:arch` | Architecture allocation view (SDD) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:changelog` | Change Log view (CR history) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:conops` | Concept of Operations view (actors/system/use-cases) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:fmea` | FMEA view — failure-mode risk elements (S/O/D, Action Priority), mitigation coverage, verification gaps |
| `se-view:icd` | Interface Control Document — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:implplan` | Implementation Plan view (MS/CR structure) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:intplan` | Integration & Test Plan view — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:nfr` | NFR Register — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:rtm` | Requirements Traceability Matrix — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:testconcept` | Test Concept (pyramid + computed E2E gap) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:testmatrix` | Test Matrix / VCRM — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se-view:trade` | Trade Study view (decisions + superseded options) — deterministic render, thin trigger of the CR-GC-220 exporter |
| `se:author-req` | Author a REQ together with its verifying TEST concept in one gated batch — the REQ-with-test invariant |
| `se:author-uc` | Author a UC node terse and low-jargon — Actor–Verb–Object–Outcome, ≤25 words, ≤2 grounded technical terms — and gate-mutate it with its compose trace |
| `se:close-violations` | Drive the governed graph to zero error-violations — propose ranked verify/satisfy edges, confirm fit, gate-mutate, repeat |
| `se:generate` | Kaltstart-Generierung eines Systemmodells aus Prosa-Intention — readiness-getriebener Loop über graph_generate, Kandidaten durchs Gate (dryRun-Verdict + fitAdvisory), Handoff auf graph_suggest |
| `se:help` | Explain any dashboard item — a rule, gate, panel, artifact, or token — for both audiences (SE without our ontology, user without SE), or give contextual next steps |

## What is here

- `.graphcode/` — the per-repo Kuzu store (`.graphcode/kuzu`). On-disk, single-owner.
  Never edited by hand; the store inits lazily on first `graphcode mcp`.
- **Parallel sessions share ONE model (CR-GC-235):** the first `graphcode mcp` wins the
  store election and becomes the host (`.graphcode/host.sock`); later sessions proxy to
  it transparently — same tools, one gate, one write channel per store/worktree.
- `.mcp.json` (Claude schema) + `opencode.json` (OpenCode schema) — both tell the
  agent host to launch the server via `npx -y @sigloch/graphcode mcp`. Merged, never
  overwritten: foreign MCP servers and your `provider`/`model` block survive.
- `.claude/skills/se-*.md` — the SE skills (fmea/review/status + the views), MCP-driven.
  Claude Code surface; on other hosts drive the MCP tools directly.
- `.claude/hooks/deny-*.sh` + `.claude/settings.json` — PreToolUse enforcement:
  gate-only writes, no binary source, no stale-prose reads (CR-GC-214). Your own
  hooks/settings keys are preserved on `update` and restored on `remove`.

## Rules

- One store = Kuzu, single-writer, exactly one owner process per repo.
- One transport = MCP-stdio. No Express/REST in the core.
- One apply-gate = `mutate()` — every edit (human or AI) goes through it; the
  `deny-graph-write` hook blocks hand-edits of the graph SSOT.
- SE ontology + rules come from `@sigloch/contracts/se` — import, never fork.

## Lifecycle

- `npx @sigloch/graphcode update` — refresh both host configs + this file, preserve the store.
- `npx @sigloch/graphcode remove`  — remove all scaffolded artifacts (incl. `.graphcode/`).
