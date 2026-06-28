# GraphCode — governed graph substrate for coding agents

**GraphCode** is a headless harness that gives a coding agent (Claude Code, OpenCode, …) a
**governed graph** of a project's model — requirements, tests, modules, traces — behind an
**MCP-stdio** surface. The agent **KNOWS** the elements to touch from a precise graph query
instead of guessing them with grep. Code stays as text in the repo; the **model lives in the graph**.

- **IS:** Bridge + Store + MCP tools + Apply-Gate. Agent-agnostic, OpenCode-executed, one Kuzu store per repo.
- **IS NOT:** a generator (→ aimprove), a learning engine (→ learning-core), a viewer/dashboard, or an extractor (→ graphify).

## Quick start — set up GraphCode in a new repo

Run this **inside the target repository** (the new family member you're building):

```bash
npx @sigloch/graphcode init
```

`init` is self-contained and idempotent. It scaffolds:

| Artifact | Purpose | Commit? |
|---|---|---|
| `.mcp.json` | tells the agent host to launch `npx @sigloch/graphcode mcp` | ✅ commit |
| `.graphcode/` | the per-repo Kuzu store (`.graphcode/kuzu`), created lazily on first run | ❌ gitignore |
| `GRAPHCODE.md` | guardrails for agents working in the repo | ✅ commit |
| `package.json` | gains the `@sigloch/graphcode` dependency | ✅ commit |

Then add `.graphcode/` to `.gitignore` and **reload your agent host** (Claude Code / OpenCode) so it
picks up `.mcp.json`. The agent will see a `graphcode` MCP server exposing the tools below.

**Lifecycle:**

```bash
npx @sigloch/graphcode update   # refresh .mcp.json + GRAPHCODE.md, PRESERVE the store
npx @sigloch/graphcode remove   # remove all scaffolded artifacts (restlos)
```

## The agent loop (over MCP)

Once the server is running, the agent drives the whole loop through MCP tools — every write goes
through the **one Apply-Gate** (`mutate()`): rule-checked, author-logged, blocked on new violations.

1. **Spec** — `graph_mutate` adds requirements/tests/modules + traces through the gate. A REQ with no
   verifying TEST (or unresolved by a MOD) is **rejected** — drift can't land.
2. **KNOW, not grep** — `graph_impact(id)` returns the *exact* blast-radius (the incoming dependents:
   the tests and modules that touch the changed node) as a bounded Format-E slice, never a full dump.
   `graph_expand` deepens one branch on demand.
3. **Implement** — `graph_mutate` updates node status as code lands; the change persists to disk Kuzu.
4. **Re-export** — `graph_export` serializes the live graph to commit-able docs: canonical
   `docs/graph/<member>.graph.json` (the SSOT) + deterministic `docs/views/*.md` (GENERATED headers).
   This is the single sync path — never hand-edit the graph JSON.

The member name (`<member>.graph.json`) is derived from the repo's `package.json` name (unscoped),
falling back to the repo directory name.

### MCP tools

| Tool | Role |
|---|---|
| `graph_elements`, `graph_get_node`, `graph_get_edges` | read slices of the graph |
| `graph_impact`, `graph_expand` | precise blast-radius / progressive deepening (KNOW) |
| `graph_mutate` | the write path — through the Apply-Gate (human or AI, same gate) |
| `graph_export` | re-export the live graph to `docs/graph` + `docs/views` |
| `rules_evaluate`, `rules_get_violations` | run the SE rules (`V3_RULES`) read-only |
| `audit_trail`, `audit_stats` | mutation history (every gate write logged) |
| `graph_help` | explain any dashboard token / give ranked, explained next steps (read-only) |

## Help — explain any item, for both audiences

Every on-screen token is explained in three layers (plain · in SE terms · the exact fix),
for a systems engineer who doesn't know this encoding **and** a user with no SE background:

- **`se:help <token>`** — explain a rule (`R-04`), gate (`CDR`), panel, or artifact (`fmea`).
- **`se:help`** (no argument) — ranked, explained next steps from the live readiness + violations.
- **`graph_help`** — the read-only MCP tool the skill is a thin surface over.

The plain/SE wording is authored once (`src/viewer/help-content.ts`); titles, severity, and the
owning gate are derived from `V3_RULES` + readiness, so help never drifts from the live model.

## Viewer integration — coming soon

GraphCode is headless and is **not** itself a viewer. It does, however, ship the read-only
**data layer** an external live viewer/renderer (`graph-view-edit`) plugs into — this surface is
**provisional** and stabilizes when that renderer lands:

- `host` (`graphcode host`) — owns the single Kuzu store and serves `/health` + `/events` (SSE).
  Read-only: no mutating HTTP verb is reachable; the write path stays MCP-stdio.
- panel shapers (`readinessPanel`, `impactPanel`, `artifactsPanel`, …) — pure read-only
  view-models over the MCP tools; the renderer consumes these and fills the render mount-slot.
- live-update events — every gate mutation emits one update event the host broadcasts over SSE.

Until the renderer ships, treat these exports as experimental.

## Local development (this repo)

```bash
npm install        # resolves the @sigloch/* workspace (file:) deps
npm run build      # tsc → dist/
npm test           # vitest — real disk Kuzu, no mocks
npm run bundle     # esbuild → self-contained dist (for publish; runs on prepack)
```

> Note: building/testing **from source** requires the `@sigloch/*` sibling packages (linked as
> `file:` devDependencies). The **published** npm package is self-contained — esbuild inlines those
> siblings into `dist/`, so consumers of `@sigloch/graphcode` never need them.

## Constraints (locked)

- **One store = Kuzu**, embedded, single-writer, on disk (`.graphcode/kuzu`) — never `:memory:`.
- **One transport = MCP-stdio** — no Express/REST in the core.
- **One Apply-Gate = `mutate()`** — every edit (human or AI) goes through it; the author is only logged.
- **SE ontology + `V3_RULES` from `@sigloch/contracts/se`** — imported, never forked. A new
  ElementType/TraceType/rule requires a family review + version bump.

## Model & docs

GraphCode owns the **implementation** plus its own graph model. The graph SSOT for graphcode's
own model is [`docs/graph/graphcode.graph.json`](docs/graph/graphcode.graph.json); the founding
charter and constraints are in [`docs/adr/ADR-001`](docs/adr/ADR-001-graphcode-goal-and-constraints.md).
GraphCode is part of a larger internal toolchain; some design-history documents reference private
governance docs that are not part of this repository.

## License

MIT — see [LICENSE](LICENSE).
