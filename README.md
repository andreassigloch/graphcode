# GraphCode — governed graph substrate for coding agents

**GraphCode** gives a coding agent (Claude Code, OpenCode, …) a **governed graph** of a project's
model — requirements, tests, modules, traces — behind an **MCP-stdio** surface. The agent **KNOWS**
the elements to touch from a precise graph query instead of guessing them with grep. Code stays as
text in the repo; the **model lives in the graph**.

## Commands

All commands run **inside the target repository**:

```bash
npx @sigloch/graphcode init          # THE install. One command, one download: scaffolds .mcp.json,
                                     # GRAPHCODE.md and the store dir; the GVE viewer comes along as a
                                     # dependency, so the first start needs no network.
                                     # ↓ everything below is run FOR you or only when you need it ↓
npx @sigloch/graphcode mcp           # THE server — your agent host starts this from .mcp.json; you
                                     # normally never type it. Brings up all three: MCP-stdio, the
                                     # read-only HTTP/SSE bridge, and the GVE dashboard.
npx @sigloch/graphcode status        # is my host up, and where is MY dashboard? Read-only: asks the
                                     # viewer via api/dashboard WHICH REPO it serves instead of
                                     # guessing a port. Exit 1 if either is missing.
npx @sigloch/graphcode host          # FALLBACK only — the bridge alone, for a repo with no agent
                                     # session running. Alongside a live `mcp` it hits the store lock.
npx @sigloch/graphcode run "<intent>" # author the graph via the embedded executor — a local LLM
                                     # (LM Studio) or Anthropic BYOK drives graph_generate/mutate
                                     # directly, no coding-agent harness. Env: GRAPHCODE_LLM_BASE_URL
                                     # + GRAPHCODE_LLM_MODEL (required), GRAPHCODE_LLM_BACKEND=
                                     # openai|anthropic (default openai), GRAPHCODE_LLM_API_KEY
npx @sigloch/graphcode rewind <ref>  # recall the graph state committed at <ref> — reads the snapshot
                                     # from git object storage, so the working tree is NOT touched.
                                     # Aborts while un-exported model edits are pending (--force drops them)
npx @sigloch/graphcode upgrade       # install the latest version, refresh artifacts, stop the old host — PRESERVES the store
npx @sigloch/graphcode skills sync   # re-copy the shipped se-* skills (overwrites on version mismatch)
npx @sigloch/graphcode remove        # remove all scaffolded artifacts (restlos)
```

## Get started

**1. Scaffold** (idempotent, self-contained):

```bash
npx @sigloch/graphcode init
```

| Artifact | Purpose | Commit? |
|---|---|---|
| `.mcp.json` | Claude-schema host config — launches `npx @sigloch/graphcode mcp` | ✅ commit |
| `opencode.json` | the same server in OpenCode's schema (`mcp.graphcode`) | ✅ commit |
| `.graphcode/` | the per-repo Kuzu store (`.graphcode/kuzu`), created lazily on first run | ❌ gitignore |
| `GRAPHCODE.md` | guardrails for agents working in the repo | ✅ commit |
| `GRAPHCODE-STEERING.md` | the human's companion — the four decisions only you can make, and what `docs/views/` is | ✅ commit |
| `package.json` | gains the `@sigloch/graphcode` dependency | ✅ commit |

Both host configs are written every time and **merged**, never overwritten: a foreign MCP server
in `.mcp.json`, or your `provider` / `model` block in `opencode.json`, survives `init`, `update`
and `remove` — only the `graphcode` entry is ours.

**2. Add `.graphcode/` to `.gitignore` and reload your agent host.** Claude Code picks up
`.mcp.json`, OpenCode picks up `opencode.json`. The agent then sees a `graphcode` MCP server
exposing the tools below.

The MCP surface is the agent-agnostic contract — any MCP-stdio host works. The `se-*` **skills**
are Claude Code surface (`.claude/skills/`); an OpenCode user drives the same tools directly.

**3. Say this to your agent.** That is the whole first step — the server prints the same line on
startup:

> Lies GRAPHCODE.md, dann: `graph_readiness` — wo steht das Projekt und was ist der nächste Schritt?

On an empty repo (no model yet) start from the intent instead:

> Lies GRAPHCODE.md, dann leg mit `se:generate` los: "&lt;was das System tun soll, in einem Satz&gt;"

**4. Dashboard — already running.** `graphcode mcp` starts the GVE viewer itself, along with the
read-only `/health` + `/events` (SSE) bridge. Do **not** start a second server — ask where yours is:

```bash
npx @sigloch/graphcode status
graphcode status — auth-service  (/Users/you/dev/auth-service)
  MCP-Host    OK             pid 40001, seit 2026-08-19T09:12:03.000Z
  Dashboard   OK             http://localhost:4318/
```

`status` reads `docs/views/dashboard.url` (GVE writes its actual bound address there on startup,
removes it on shutdown) and then asks that instance `api/dashboard` **which repo it serves**. The
address itself is stable per repo — GVE derives it from the repo path (43000–43999) — so your
bookmark keeps working across restarts; the identity check stays as the safety net for the rare
collision, where Vite bumps and a neighbour's viewer could end up on the address yours left behind.
Only an instance serving THIS repo is reported as yours. Opt out with `GRAPHCODE_NO_GVE=1`; the bridge port comes from `GRAPHCODE_HOST_PORT` in
`.mcp.json` `env`, which `init`/`update` scaffolds per repo.

**Lifecycle — the host lives exactly as long as your session (CR-GC-370..372).** Closing the
editor (or anything that ends the stdio client) shuts the host down in order: viewer → HTTP
bridge → `host.sock` → store lock. Reopening therefore wins a REAL election instead of proxying a
host whose editor is gone, and brings its dashboard back at the same address. Three guards behind
that: a viewer that dies mid-session is restarted (1 s / 3 s / 10 s, then it says so and stops
trying); the store lock carries a heartbeat, so a lock without a pulse for 90 s is free even if its
PID is alive (PID reuse after a reboot, a hung host); and a host whose lock was taken over notices
at its next beat and ends its session rather than becoming a second writer.

**5. To upgrade:** run `graphcode upgrade` — one command: installs the latest version, lets THAT build refresh `.mcp.json`,
`GRAPHCODE.md` and skills, never touches the store.

## Using it — the agent loop (over MCP)

The agent drives the whole loop through MCP tools — every write goes through the **one Apply-Gate**
(`mutate()`): rule-checked, author-logged, blocked on new violations.

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

All 25 MCP tools, grouped by role — this table is complete, and a test asserts the count against the
live registry so it cannot silently fall behind the code.

| Role | Tool | What it does |
|---|---|---|
| **read** | `graph_elements` | filtered slice of the graph, never a full dump |
| | `graph_get_node` | one node with its attributes |
| | `graph_get_edges` | the traces of one node |
| | `graph_impact` | the exact blast-radius: who breaks if I change this (KNOW, not grep) |
| | `graph_expand` | deepen one branch on demand |
| | `graph_context` | the definition-of-done pack for ONE node — spec closure in one call |
| **write** | `graph_mutate` | the write path — through the Apply-Gate (human or AI, same gate) |
| | `graph_realize` | bind model to code: `realRef` on a FUNC/SCHEMA, `testRefs` on a TEST |
| | `graph_merge` | additive merge (adds only) — the non-destructive import path |
| | `graph_reseed` | in-process reseed from the committed SSOT, with an automatic backup |
| **measure** | `rules_evaluate`, `rules_get_violations` | run the SE rules read-only |
| | `graph_readiness` | the readiness report: dimensions, phase gates, blocking errors |
| | `graph_metrics` | per-module architecture metrics **plus the thresholds they were judged against** |
| | `graph_next_step` | the single highest-leverage next action, derived from readiness |
| **generate** | `graph_generate` | the cold-start driver: seed → expand → handoff, as a state machine |
| | `graph_suggest` | rank candidate fixes by how far they move the graph toward your target |
| | `graph_authoring_guide` | the legal edges for a given element type, before you write |
| **test evidence** | `graph_test_ingest` | feed a test run's results back into the graph |
| | `graph_test_report` | the report over those results |
| | `graph_tests` | which tests exist, and what they are bound to |
| **export** | `graph_export` | re-export the live graph to `docs/graph` + `docs/views` |
| **audit** | `audit_trail`, `audit_stats` | mutation history — every gate write logged |
| **help** | `graph_help` | explain any rule ID, gate, or dashboard token (read-only) |

`graph_realize`, `graph_test_ingest`/`graph_test_report`/`graph_tests` are the answer to the obvious
objection that a model can drift from its code: the binding is an attribute the rules check (R-19,
R-20), and "done" means a test result landed in the graph, not that someone ticked a box.

### Bringing an existing project in

You do not have to start from an empty graph. Two import paths ship, with **deliberately different
semantics** — the difference is safety-relevant, not cosmetic:

| Skill | Source | Semantics |
|---|---|---|
| `se:import-code` | an existing TypeScript codebase | deterministic extraction via graphify — **no LLM**. Produces FUNC/MOD/FLOW/SCHEMA, never use cases or requirements (nobody can read intent out of code). **RESEED, not merge**: the graph is replaced, and a backup is written automatically first. |
| `se:import-doc` | a document (PDF / Markdown / text) | two-stage: the skeleton is shown to you, you decide the element types in chat, then an LLM extract goes through the Apply-Gate like any other write. **MERGE (adds only)** — nothing existing is removed. |

Use `import-code` to bootstrap a brownfield repo's architecture layer, then `import-doc` to bring the
specification in on top of it.

### Generated documents

The SE document family is rendered from the graph, deterministically — same graph, same bytes. Each
has a skill that renders it into `docs/views/`:

| Skill | Document |
|---|---|
| `se-view:rtm` | Requirements Traceability Matrix |
| `se-view:arch` | Architecture allocation (SDD) |
| `se-view:icd` | Interface Control Document |
| `se-view:nfr` | NFR register |
| `se-view:testconcept` · `se-view:testmatrix` | test concept (pyramid + computed E2E gap) · VCRM |
| `se-view:intplan` · `se-view:implplan` | integration & test plan · implementation plan (MS/CR) |
| `se-view:conops` | Concept of Operations (ISO 29148 §5.2.4) |
| `se-view:fmea` | FMEA — failure modes, S/O/D, action priority |
| `se-view:trade` | trade studies — decisions and superseded options |
| `se-view:changelog` | change log from the CR history |

Because they are generated, "the document is incomplete" and "the gate is still open" are the same
fact with the same cause — there is no separate documentation debt to track.

`se-retro` computes the six KPIs over a finished stretch of work (graph-vs-grep, tool usage,
token/LOC, plan conformance, gate health, binding coverage).

### Help — explain any item, for both audiences

Every on-screen token is explained in three layers (plain · in SE terms · the exact fix),
for a systems engineer who doesn't know this encoding **and** a user with no SE background:

- **`se:help <token>`** — explain a rule (`R-04`), gate (`CDR`), panel, or artifact (`fmea`).
- **`se:help`** (no argument) — ranked, explained next steps from the live readiness + violations.
- **`graph_help`** — the read-only MCP tool the skill is a thin surface over.

The plain/SE wording is authored once (`src/viewer/help-content.ts`); titles, severity, and the
owning gate are derived from `V3_RULES` + readiness, so help never drifts from the live model.

## What it is / is not

- **IS:** Bridge + Store + MCP tools + Apply-Gate. Agent-agnostic, headless, one Kuzu store per repo.
- **IS NOT:** a generator (→ aimprove), a learning engine (→ learning-core), a viewer/dashboard, or an extractor (→ graphify).

## Viewer integration

GraphCode is headless and is **not** itself a viewer — it ships the read-only **data layer**, and
`graph-view-edit` (GVE) is the renderer that consumes it. The elected host **spawns GVE for you**
(see *Get started* step 4); these are the pieces it wires up:

- the read-only HTTP/SSE bridge — owns the single Kuzu store and serves `/health` + `/events`.
  No mutating HTTP verb is reachable; the write path stays MCP-stdio.
- panel shapers (`readinessPanel`, `impactPanel`, `artifactsPanel`, …) — pure read-only
  view-models over the MCP tools; the renderer consumes these and fills the render mount-slot.
- live-update events — every gate mutation emits one update event the host broadcasts over SSE.

The bound address is announced in `docs/views/dashboard.url`, never a fixed port. The shared view
catalog (which documents exist, under which filename) lives in `@sigloch/graphcode-client` so the
viewer can list them without depending on the exporter.

## Local development (this repo)

```bash
npm install        # everything from the registry — no private repo needed
npm run build      # tsc → dist/
npm test           # vitest — real disk Kuzu, no mocks
```

The five `@sigloch/*` dependencies (`contracts`, `graph-api-core`, `graph-cypher-wasm`,
`learning-core`, `se-steering`) are published packages, so a clone builds and tests without any
sibling checkout. To work against a local checkout of those packages instead, run
`npm run link:siblings` (`npm link`, reversible with `npm install`).

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
[`docs/articles/`](docs/articles/) is the plain-language introduction; the numbers it cites come
from [`docs/spikes/`](docs/spikes/) (raw benchmark runs, reproducible via [`rig/dummy-slicer/`](rig/dummy-slicer/)).
GraphCode is part of a larger internal toolchain; some design-history documents reference private
governance docs that are not part of this repository.

## License

MIT — see [LICENSE](LICENSE).
