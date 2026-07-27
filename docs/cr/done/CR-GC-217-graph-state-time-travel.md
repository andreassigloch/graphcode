# CR-GC-217 — Graph-State Time-Travel (commit-bound snapshot)

> Renumbered from CR-GC-216 → CR-GC-217 on 2026-06-27: a concurrent session had
> already taken CR-GC-216 for `graph_realize affordance`. Same content, new number.

**Status:** DONE (2026-06-27) — Approach A slice 1 shipped + tested; slice 2 superseded by CR-GC-218
**Date:** 2026-06-27
**Decision (2026-06-27):** Approach A only. B/C/D rejected (B not planned, not deferred).
**Type:** architecture
**Depends on:** CR-GC-203 (`graph_reseed`), exporter R3 (deterministic serialization), CR-GC-214 (graph-first read-deny hook)

---

## 1. Problem (Root Cause)

We cannot recall a prior graph state that matches prior code. The serialization and
restore machinery already exist; the **binding to git history** does not:

- `docs/graph/graphcode.graph.json` is **deterministic, lossless, git-tracked**
  (elements sorted by uid, traces by `(source,type,target)`, `attrs_json` round-trip
  — exporter R3 / `REQ-deterministic-serialization`).
- `graph_export` writes **live Kuzu → snapshot**; `graph_reseed` (CR-GC-203) restores
  **snapshot → live Kuzu** in-process, behind the single writer.

Missing:
1. Nothing forces `graph_export` **at commit time** → a commit's snapshot can lag (or
   lead) its code.
2. Nothing runs `graph_reseed` **on checkout** → `git checkout <old>` moves the code
   back but the live Kuzu store stays at HEAD.

So "prior graph state" is not actually serialization loss — it's a **synchronization /
coupling gap**.

## 2. Impact

- Live Kuzu is the *runtime* SSOT but the committed snapshot is only an *ad-hoc*
  artifact → per-commit drift between code and graph.
- No deterministic "graph as of commit X" → no diffable model history in PRs, no
  rollback, no audit of when a model element appeared.
- Fixable **without** a new store, without abandoning Kuzu, without binary DB snapshots.

## 3. Chosen solution — Approach A: commit-bound snapshot ✅ DECIDED

Make the **committed snapshot the SSOT at rest**, Kuzu the derived working cache —
the same relationship git has with the working tree. Three small bindings:

1. **pre-commit hook** (`.claude/hooks` / `.git/hooks/pre-commit`): if the model
   changed, run `graph_export`, `git add docs/graph/*`; **fail the commit on
   live ≠ committed** (drift guard). → every commit carries a snapshot that fits its
   code.
2. **post-checkout + post-merge hook**: run `graph_reseed` from the committed snapshot
   → live Kuzu matches the checked-out code. Skip the reseed when the snapshot hash is
   unchanged (avoid churn on branch switches that don't touch the model).
3. **CI guard**: `graph_export --check` (export to a temp file, diff against the
   committed snapshot) fails the build — backstop for `git commit --no-verify`.

**Recall** = `git checkout <sha>` (auto-reseed via hook), or inspect read-only via
`git show <sha>:docs/graph/graphcode.graph.json`. **Rollback** = checkout + reseed,
or `graph_reseed --path <that file>`.

### Pros
- Reuses existing deterministic export + in-process reseed — minimal new surface.
- Snapshot is text/JSON → **model deltas are diffable in PRs**, reviewable per commit.
- Git is the single history mechanism for both code and graph; branches/merges carry
  the graph atomically with the code.
- Respects the locked Kuzu constraint: the snapshot is a *serialization*, not a second
  DB handle / second store.
- Per-commit granularity — exactly what was asked.

### Cons + mitigations
- **Hook bypass** (`--no-verify`) → CI `--check` guard is the backstop.
- **Reseed cost per checkout** → only reseed when the committed snapshot hash differs
  from the last-applied hash (cache a marker in `.graphcode/`).
- **Merge conflicts in the JSON** on concurrent model edits → deterministic ordering
  limits spurious churn; genuine semantic conflicts *should* surface (correct
  behavior). Optional: a `merge=union`-style driver or post-merge re-export pass.
- **Monolithic file** → large diffs on large graphs. Optional later: shard by
  ElementType. Out of scope for v1.
- **pre-commit latency** from export → bounded; export is already fast (perf.batch-seed).

## 4. Alternatives (rejected or deferred)

### B. Event-sourced replay (audit-trail → state at SHA) — *rejected (not planned)*
Tag every `mutate()` audit entry with the git SHA; recall state at X by replaying the
audit trail up to the last mutation ≤ X onto an empty store.
- **Pro:** per-*mutation* granularity; audit trail already exists; full provenance.
- **Con:** replay determinism is fragile — rule-engine version drift (R-18/R-19/R-20)
  re-evaluates old data differently; needs periodic checkpoints anyway → converges to
  A; does not branch with git; larger build. A is the checkpoint, B is the WAL — do A
  first, add B only if per-mutation recall is required.

### C. Binary Kuzu snapshot committed per commit — *reject*
- **Pro:** exact restore, no reseed compute.
- **Con:** violates `deny-binary-source`; non-diffable (no model-delta review); repo
  bloat / LFS; **not deterministic across Kuzu versions** (format drift breaks old
  snapshots). Reseed-from-JSON yields the same result more cheaply.

### D. Separate `graph-history` branch keyed by code SHA — *reject (variant only)*
- **Pro:** keeps code PRs free of graph-JSON churn.
- **Con:** re-introduces the decoupling this CR fixes — graph no longer travels
  atomically with code; two refs to keep in sync. Mention only as a future diff-noise
  mitigation, not the primary mechanism.

## 5. Decisions (resolved 2026-06-27)

1. **SSOT-at-rest inversion — ACCEPTED.** `REQ-graph-is-ssot` is amended from *live
   Kuzu is the runtime SSOT* to: *live Kuzu is the runtime SSOT; the committed snapshot
   (`docs/graph/graphcode.graph.json`) is the SSOT at rest / history of record.*
   Consistent with "graph_export = canonical sync path." This amendment must be carried
   into `bok` SSOT on the next family review (do not fork the requirement here).
2. **Drift enforcement strength — (a) auto-export + `git add` in pre-commit, paired
   with a CI `--check` hard-guard.** Pre-commit keeps the snapshot in sync without
   manual steps; CI is the backstop for `--no-verify`. The fail-and-tell variant (b) is
   not used.
3. **Event-sourced replay (B) — not planned.** Per-commit granularity is sufficient;
   revisit only if sub-commit recall is ever required.

## 6. Implementation sketch (file budget ≤ 6, on decision)

1. `.git/hooks/pre-commit` (or `.claude/hooks/*` + installer in `scripts/`) — export +
   add + drift guard.
2. `.git/hooks/post-checkout` + `.git/hooks/post-merge` — conditional reseed.
3. `scripts/install-graph-hooks.sh` — idempotent installer (hooks are not auto-tracked).
4. `src/exporter.ts` or `src/cli.ts` — add `graph_export --check` (export-to-temp +
   diff, exit non-zero on drift) for CI.
5. CI workflow step — run `--check`.
6. `tests/graph-timetravel.test.ts` — mutate → commit (export) → mutate again →
   checkout prior → reseed → assert counts/ids == committed snapshot (real disk Kuzu,
   no mocks).

## 7. Acceptance criteria

- [ ] Every new commit's `docs/graph/graphcode.graph.json` byte-matches a fresh
      `graph_export` of the code at that commit (CI `--check` green). *(slice 2)*
- [x] `git checkout <prior-sha>` + `graph_reseed` leaves live Kuzu equal to that
      commit's snapshot (node/edge counts + ids) — proven by the round-trip test.
- [ ] Reseed is skipped when the snapshot hash is unchanged (no needless churn). *(slice 2)*
- [ ] `--no-verify` commit that drifts the snapshot is caught by CI. *(slice 2)*
- [x] Test in `tests/` proves the round-trip on real disk Kuzu
      (`tests/graph-timetravel.test.ts`).

## 8. Implementation status (2026-06-27)

### Single-writer adjustment to decision §5.2
Decision §5.2 chose *auto-export + git add* in pre-commit. The locked
`REQ-single-kuzu-owner` makes **auto-export from the hook infeasible while the MCP
server runs**: the server owns the only Kuzu writer handle, so a hook subprocess
cannot open the store to export. Root-cause-honest resolution: the gate leaves a
**single-writer-safe file marker** (`.graphcode/EXPORT_PENDING`, gitignored) on every
`mutate()`; `graph_export`/`graph_reseed` clear it. The pre-commit hook reads the
marker (never Kuzu) and **fails-and-tells** on un-exported drift, while still
**auto-staging** the already-exported `docs/graph` + `docs/views`. So §5.2(a)'s
auto-`git add` holds; the un-exported case degrades to §5.2(b) fail-and-tell — the
only form single-writer allows locally.

### Slice 1 — SHIPPED (5 files)
1. `src/export-marker.ts` (new) — `set/clear/isExportPending(repoRoot)`; marker under
   gitignored `.graphcode/`.
2. `src/harness.ts` — `mutate()` sets the marker after persist; `reseed()` clears it.
3. `src/mcp-tools.ts` — `graph_export` clears the marker after a successful write.
4. `scripts/githooks/pre-commit` — block on `EXPORT_PENDING`, refuse empty snapshot,
   auto-stage `docs/graph` + `docs/views`. Installed via
   `git config core.hooksPath scripts/githooks` (set in this repo).
5. `tests/graph-timetravel.test.ts` — real-disk-Kuzu round-trip: mutate→marker set,
   export→marker clear, reseed-older-snapshot→exact recall + clean state.

Model: added through the gate (graph_mutate → graph_export) — `UC-graph-time-travel`,
`REQ-graph-snapshot-per-commit`, `REQ-graph-state-recall`, `TEST-graph-time-travel`
(testRef → the round-trip test), with `verify`/`satisfy`/`compose` traces (no
outstanding rule violations). Build + full suite green (164 tests).

Recall today: `git checkout <sha>` → `graph_reseed` (MCP, in-process, single-writer-safe).

### Slice 2 — DEFERRED (needs approval; new CR when scoped)
Ergonomics on top of the shipped foundation:
- `graphcode export [--check]` + `graphcode reseed` CLI verbs (one-shot, open Kuzu;
  clean error when the server holds the writer) — enables CI + no-server use.
- `post-checkout` / `post-merge` hooks — auto-reseed when no server runs / prompt when
  one does; skip when the snapshot hash is unchanged.
- CI step running `graphcode export --check` — backstop for `git commit --no-verify`.
