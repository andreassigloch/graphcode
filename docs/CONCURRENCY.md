# Concurrency & recall — safe, simple operation (CR-GC-218 · MS-7 ladder CR-GC-232..235)

**The model, in one line:** the store is to `docs/graph/*.graph.json` what the working tree
is to a commit — a **derived, per-worktree cache**, never shared mutable state. Concurrency is
handled the way git handles it: immutable shared history + a per-actor working copy.

## The two failures this closes
- **Recall while writing** — one agent restores an old graph state while another keeps mutating.
- **Two agents on one repo** — two Claude Code / OpenCode sessions working the same repo at once
  (the real, recurring collision: number clashes + swept uncommitted work).

Both had one root cause: **one shared mutable live store + one shared working tree**.

## What we do — O1 + O2 + O3 (no O4)
1. **O1 — a worktree per agent (`scripts/gcw.mjs`).** `.graphcode` is gitignored and repo-root-
   relative, so **every git worktree gets its OWN Kuzu store automatically** — full isolation, no
   shared mutable state, and "recall" is just `git checkout` + a local reseed. The store auto-seeds
   from that worktree's committed graph on first `graphcode mcp`. `gcw <branch>` creates the worktree
   (retrying `.git/config.lock` contention — [claude-code#34645](https://github.com/anthropics/claude-code/issues/34645))
   and prints how to launch an agent there. For Claude Code subagents, pass `isolation: "worktree"`.
2. **O2 — store-ownership lock (`src/store-lock.ts`), now an ELECTION (CR-GC-235).** The lock still
   enforces the locked `REQ-single-kuzu-owner` at runtime — an atomic `O_EXCL` lockfile with the
   owner's pid/host, reclaimed only on positive evidence the owner is gone (same host + dead PID, or
   an old corrupt file), never while it might be live. What changed with CR-GC-235: for `graphcode mcp`
   the loser of the lock race no longer **dies** (`StoreOwnershipError`) — it **degrades to a client**:
   - **Winner = host**: owns store + gate, serves its own session via MCP-stdio AND a local Unix
     socket (`.graphcode/host.sock`) for later sessions (`src/host-shim.ts`).
   - **Loser = client**: a thin stdio→socket proxy — the same tool surface, every call forwarded to
     the host, every write through the ONE gate (O3-serialized + OCC, CR-GC-233). Two Claude
     sessions (or parallel subagents) on the same directory now work on **one** model — divergence
     inside a model cannot arise; merging stays reserved for **intentional** branches (CR-GC-234).
   - **Host death**: the proxy reconnects once, then attempts ONE re-election (the stale-lock
     reclaim makes the dead host's lock winnable) and continues as host; otherwise a clear
     `HostGoneError`. A fresh `graphcode mcp` start after a host kill wins the election — no dead state.
   - Agents keep speaking **MCP-stdio** either way; the socket is an internal shim hop, not a second
     API surface (no HTTP — Phase B, streamable HTTP, is a separate future family decision).
   A DIRECT second `GraphCodeHarness` on an owned store (library use, not `graphcode mcp`) is still
   refused loudly — the election lives above the harness, the invariant below it is untouched.
3. **O3 — write serialization (harness).** A `reseed` never interleaves with a `mutate` (nor two
   mutates): both run through one in-process FIFO write-mutex, so no writer sees a half-cleared store.

## The MS-7 ladder on top (CR-GC-232..235)
- **CR-GC-232 — durable command log**: every gated batch lands in `.graphcode/audit.jsonl`
  (beside the store, like the lock) with its `MutateCommand[]` — the replay + delta source.
- **CR-GC-233 — OCC**: reads return `graphVersion`; writes carry `baseVersion`; a stale write is
  rejected with the delta of applied batches since — re-read, reconcile, retry. Never a silent lost update.
- **CR-GC-234 — `graph_merge`**: intentional branch reintegration = replaying the branch's command
  log after the fork point through the existing gate; conflicts are gate violations (report:
  applied/conflicted/skipped, `dryRun` preview) — never a `graph.json` text merge.
- **CR-GC-235 — one write channel**: the host election above; one host per store (= per worktree).

## Why NOT O4 (per-worktree-derived store path sharing one repo dir)
O4 would key the store to a worktree id while sharing one working directory — that **changes the
locked "one owner per repo" constraint** and needs a family review. It is unnecessary: O1 already
gives per-worktree isolation *because the store lives in the working dir*, without touching the constraint.

## Prior art — checked, neither solves it (2026-07)
- **CodeGraph** (colbymchenry) — read-only (SQLite+FTS5 WAL, multi-reader). No writers → no
  write-concurrency problem to solve. N/A.
- **claude-flow / ruflo** (ruvnet) — has the *same* bug class
  ([ruflo#1257](https://github.com/ruvnet/ruflo/issues/1257): "database is locked" under concurrent
  agents; MCP handlers don't serialize writes). Its fix is SQLite **WAL + busy_timeout + retry-with-
  backoff** — which graphcode's locked single-writer Kuzu constraint rejects (Kuzu is not multi-
  connection WAL). Its approach does not transfer; the worktree-per-agent pattern (which Claude Code
  itself uses, running `git worktree lock` on an agent's worktree) is the aligned answer.

## Quick reference
```
gcw <branch>                       # new isolated worktree + its own store; prints launch steps
git worktree remove <dir>          # when the agent is done
```
A second `graphcode mcp` on a store another process owns becomes a **client** of that host (stderr
names the owning pid + socket) — both sessions work on the one model. A direct second harness
instance (library use) still fails fast naming the owner. If you are certain no other graphcode is
running, delete `.graphcode/owner.lock`.
