# CR-GC-218 — Concurrent-agent isolation & safe graph recall

**Status:** DONE (2026-07-02). Implemented **O1 + O2 + O3** per §6 (worktree wrapper
`scripts/gcw.mjs`; store-ownership lock `src/store-lock.ts` wired into the harness;
in-process reseed/mutate serialization). **O4 NOT done** — it changes the locked
`ein-Owner-pro-Repo` constraint and stays family-review-gated. Prior art checked
(§ below): codegraph is read-only (N/A); claude-flow/ruflo has the same bug and patches
it with SQLite WAL+retry, which single-writer Kuzu rejects. See `docs/CONCURRENCY.md`.
(Original draft text preserved below for the audit trail.)
**Type:** architecture / concurrency
**Related:** CR-GC-217 (graph-state time-travel — recall foundation, shipped). This CR
supersedes CR-217's deferred "slice 2" (CLI verbs / auto-reseed-on-checkout): once
agents work in per-worktree checkouts, recall is just `git checkout` + a local reseed.

---

## 1. Problem

Two concerns, one root cause:
- **Recall while writing:** one agent restores an old graph state while another keeps
  mutating the model.
- **Parallel agents on one repo:** two agents (Claude Code instances, OpenCode
  sessions) working the same repo at once.

Both go wrong today because there is **one shared mutable live store + one shared
working tree**. Git's concurrency model works precisely because it *never* shares
mutable state.

## 2. Live evidence (this very session, 2026-06-27)

While CR-217 was being implemented, a concurrent agent session on the same repo:
- took **CR-GC-216** for `graph_realize affordance` (forcing CR-217 to renumber from 216);
- its later commit swept CR-217's **uncommitted** graph-store mutations into its own commit;
- then committed a **second `CR-GC-217`** (`graph-authoring-guide`) on top of CR-217's
  `graph-state-time-travel` → two files shared number 217 (since resolved: `graph-authoring-guide` renumbered to **CR-GC-231**).

i.e. the failure is real and recurring (number collisions + swept uncommitted work),
caused by a shared working directory, not by anything inside a single MCP process.

## 3. Root cause + the git principle

The committed `docs/graph/*.graph.json` is already the right thing: immutable,
deterministic, diffable history (= git's object store). The defect is that the **live
Kuzu store is a global singleton per repo** instead of a per-actor derived cache.

Git solves concurrent restore+write with three properties we should inherit:
1. **Immutable shared history** — commits are append-only; "restore" moves a pointer,
   never mutates shared data.
2. **Per-actor working copy** — each worktree has its own checkout; your `git checkout`
   never touches mine.
3. **Reconciliation at merge, not at write** — divergence resolved explicitly (3-way).

The store should be to the JSON what the working tree is to a commit: a **derived,
per-worktree cache** — never shared mutable state.

## 4. Options (with pros/cons)

| # | Option | Code | Pro | Con |
|---|---|---|---|---|
| O0 | Status quo (shared store + dir) | none | — | the recurring pain (this CR §2) |
| O1 | **Worktree per concurrent agent** (discipline + `gcw` wrapper) | ~none | removes the actual collision; pure git | relies on habit; nothing enforces it |
| O2 | **Store-ownership lock** — MCP refuses to open a store another process already owns | small | turns *silent* clobber into a *loud* safe refusal; guarantees one owner | doesn't enable parallelism, only protects against it |
| O3 | **MCP serializes mutate/reseed** (block writes during a reseed) | small | clean in-process coordination | only valid *if* one owner is guaranteed (needs O2); cannot manage cross-instance / working-tree collisions |
| O4 | **Worktree-derived store path** (store keyed to worktree id) | medium | full isolation; recall == git recall; enables true parallel writers + merge | edits the locked `ein-Owner-pro-Repo` constraint → **family review**; disk proliferation; path-derivation edge cases; merge becomes a workflow step |
| — | Multi-writer / MVCC graph DB | large | true concurrency | violates locked single-writer Kuzu — rejected |

**"Can the MCP just manage it?" (O3) — half-right.** With exactly one shared MCP
server it is already the serialization point (single-writer mutate; in-process reseed),
and an explicit "block writes during reseed" lock is easy. But that only covers
**in-process logical races**. The collision in §2 was **cross-instance** (separate
servers / shared working tree + git) — outside any single MCP process. So O3's payoff
**requires O2 as its precondition** (guarantee one owner first).

## 5. Tooling reality — neither agent auto-isolates

Isolation must come from git; you set it up, the tools don't do it for you.

| Scenario | Auto-isolated? | Reality |
|---|---|---|
| Claude Code subagent (Agent/Task tool) | opt-in only | default shares parent's dir; pass `isolation: "worktree"` for its own |
| 2nd Claude Code instance (2nd VS Code window / terminal, same repo) | **no** | shares the one working tree — the §2 collision; `EnterWorktree` is manual |
| OpenCode parallel sessions | **no** | logically separate (own SQLite history) but share the filesystem; internal worktree module + `directory` param + community plugins exist, but no CLI flag / no auto per-session worktree (feature request sst/opencode#12896) |

Sources: opencode.ai/docs/cli, opencode.ai/docs/server, github.com/sst/opencode/issues/12896,
plugins felixAnhalt/opencode-worktree-session & kdcokenny/opencode-worktree. Claude Code
rows from the Agent tool's own `isolation: "worktree"` option.

## 6. Recommendation (when revisited)

Phased, least-complexity-first:
1. **O1 now-equivalent:** a `gcw <branch>` wrapper (`git worktree add` + launch the
   agent there); always pass `isolation: "worktree"` to subagents.
2. **O2 (best ROI):** store-ownership lock — refuse a second writer on the same store.
3. **O3 layered on O2:** MCP blocks writes during a reseed.
4. **O4 only if same-time multi-writer on the model is actually needed** — review-gated
   (touches a locked constraint).

## 7. Decision now

**Do nothing.** Interim mitigation: manually run any second agent in its own
`git worktree` (or a separate clone). Revisit this CR if the parallel-agent pain
continues.

## 8. Open coordination item (not for this CR)

~~Two committed files share `CR-GC-217` (`graph-state-time-travel` vs
`graph-authoring-guide`).~~ **RESOLVED (2026-06-28):** the later `graph-authoring-guide`
was renumbered to the next free number, **CR-GC-231**; the shipped `graph-state-time-travel`
keeps `CR-GC-217`. Graph-SSOT provenance tags (`docs/graph/graphcode.graph.json`) reference
only the time-travel CR, so they stay `CR-GC-217`.
