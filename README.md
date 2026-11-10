# GraphCode — a governed project graph for coding agents

A coding agent that works from documents and grep reads far more than it needs and still guesses
what belongs together. Measured on one task: **~34,000 tokens** of spec and notes against **~250
tokens** for the same answer pulled from a project graph
([article 01](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/01-structure-and-llm-needs.md)).

GraphCode gives your agent (Claude Code, OpenCode, any MCP host) that graph: requirements, tests,
functions and modules of **your** repo, connected, and guarded by a rule gate. Code stays as text in
the repo; the model of what the code is for lives in the graph.

## What it looks like

You ask your agent *"what breaks if I change `graph_help`?"*. Instead of grepping, it calls
`graph_impact` and gets the exact answer from the graph — here from graphcode's own model:

```
graph_impact("FUNC-graph-help")  → 15 nodes
+ FCHAIN-skill-help -compose-> FUNC-graph-help
+ FLOW-query-request-agent -io-> FUNC-graph-help
+ FUNC-block-abfrage -compose-> FUNC-graph-help
+ CR-GC-847 -relation-> FUNC-graph-help        (and 7 more change requests)
Blackbox frontier: UC-deterministic-steering · FUNC-agent-loop · FUNC-block-grounding
```

The answer is complete and bounded: every chain, data flow and change request that hangs off the
function, plus the edge of the slice it did not open.

## Install

Node ≥ 22 and an agent host: [Claude Code](https://claude.com/claude-code) or
[OpenCode](https://opencode.ai). graphcode has no interface of its own; your agent is the client.
Run inside **your** repository:

```bash
npx @sigloch/graphcode init
```

1. `init` writes the host configs (`.mcp.json`, `opencode.json`), `GRAPHCODE.md` (rules for the
   agent), `GRAPHCODE-STEERING.md` (the four decisions only you make) and adds `@sigloch/graphcode`
   to `package.json`, then installs it with your package manager (npm, pnpm or yarn, chosen by the
   lockfile) — the host configs start it from `node_modules`. It ends by printing the next steps;
   `--json` prints the result as JSON instead. If neither `claude` nor `opencode` is on `PATH`,
   the steps say so and name the install command for each.
2. Add `.graphcode/` to `.gitignore`. It holds the local graph store.
3. Reload your agent host. Claude Code reads `.mcp.json`, OpenCode reads `opencode.json`; the agent
   now sees a `graphcode` MCP server.
4. Say this to your agent:

   > Read GRAPHCODE.md, then call `graph_readiness` — where does the project stand, and what is the next step?

   On a repo without a model yet, start from your intent instead:

   > Read GRAPHCODE.md, then start `se:generate`: "<what the system should do, for whom, in one sentence>"

**Cloned a repo that already uses graphcode?** Skip `init`: run `npm install` and open your agent
host. The store builds itself on first start from the committed model (`docs/graph/*.graph.json`).

## Five words you need

| Word | Meaning |
|---|---|
| **REQ** | a requirement — what the system must do or must hold |
| **TEST** | the test that proves a REQ; a REQ without one is rejected at the gate |
| **FUNC** | a function — an implementable unit, bound to code by `realRef` |
| **MOD** | a module — where functions live (a package, a directory) |
| **gate** | the one write path: every change is checked against the rules before it lands |

The rest — use cases, function chains, flows, the rule IDs like `R-19` — is in the
[glossary](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/08-glossary.md).
Any token on screen is explained by `se:help <token>`.

## Where to read on

| You want | Read |
|---|---|
| the decisions only you make | `GRAPHCODE-STEERING.md` in your repo, written by `init` |
| why a graph beats documents, with numbers | [01 — structure and LLM needs](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/01-structure-and-llm-needs.md) |
| why agents build the wrong thing | [02 — specification as a model](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/02-vorgaben-als-modell.md) |
| design decisions and stack | [03 — under the hood](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/03-graphcode-harness-goal-and-concept.md) |
| how one edit lands | [05 — the advisory roundtrip](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/05-the-advisory-roundtrip.md) |
| the method, for systems engineers | [09 — the systems engineer view](https://github.com/andreassigloch/graphcode/blob/master/docs/articles/09-the-systems-engineer-view.md) |
| all articles | [docs/articles/](https://github.com/andreassigloch/graphcode/tree/master/docs/articles) |
| graphcode's own model, as an example | [docs/views/](https://github.com/andreassigloch/graphcode/tree/master/docs/views) (generated documents) |

## Commands

All commands run inside the target repository. After `init` you rarely type any of them.

```bash
npx @sigloch/graphcode init          # scaffold host configs, GRAPHCODE.md, skills, hooks; add the dependency
npx @sigloch/graphcode status        # is my host up, and where is my dashboard?
npx @sigloch/graphcode upgrade       # install the latest version, refresh scaffolded files, keep the store
npx @sigloch/graphcode rewind <ref>  # recall the graph committed at <ref>; the working tree is not touched
npx @sigloch/graphcode skills sync   # re-copy the shipped se-* skills
npx @sigloch/graphcode remove        # remove everything init scaffolded
npx @sigloch/graphcode mcp           # the server itself — your agent host starts it, not you
npx @sigloch/graphcode host          # fallback: the read-only bridge alone, when no agent session runs
```

`init`, `upgrade` and `remove` **merge** the host configs: another MCP server in `.mcp.json`, or your
`provider`/`model` block in `opencode.json`, survives — only the `graphcode` entry is touched.

## Using it — the agent loop

The agent drives the loop through MCP tools. Every write goes through the **one gate**: rule-checked,
author-logged, blocked on new violations.

1. **Specify** — `graph_mutate` adds requirements, tests, modules and their connections. A REQ with
   no verifying TEST is **rejected** — drift cannot land.
2. **Know, not grep** — `graph_impact(id)` returns the exact blast radius as a bounded slice, never a
   full dump. `graph_expand` deepens one branch on demand.
3. **Implement** — `graph_mutate` updates the node as code lands; the change persists to disk.
4. **Export** — `graph_export` writes the commit-able model: `docs/graph/<name>.graph.json` (the
   single source of truth) plus deterministic documents in `docs/views/`. Never hand-edit the graph JSON.

`<name>` is the unscoped `package.json` name, or the directory name.

### MCP tools

All 23 MCP tools, grouped by role — this table is complete, and a test asserts the count against the
live registry so it cannot silently fall behind the code.

| Role | Tool | What it does |
|---|---|---|
| **read** | `graph_elements` | filtered slice of the graph, never a full dump |
| | `graph_get_node` | one node with its attributes |
| | `graph_get_edges` | the traces of one node |
| | `graph_impact` | the exact blast-radius: who breaks if I change this (KNOW, not grep) |
| | `graph_expand` | deepen one branch on demand |
| | `graph_context` | the definition-of-done pack for ONE node — spec closure in one call |
| **write** | `graph_mutate` | the write path — through the Apply-Gate (human or AI, same gate); also binds model to code: `~ FUNC-x` + `@realRef {…}`, `@testRefs [...]` on a TEST |
| | `graph_merge` | replay a branch worktree's command log onto this store (semantic rebase); the node merge is Format-E `M source + target` via `graph_mutate` |
| | `graph_reseed` | in-process reseed from the committed SSOT, with an automatic backup |
| **measure** | `rules_evaluate`, `rules_get_violations` | run the SE rules read-only |
| | `graph_readiness` | where the project stands: the marks SRR/PDR/CDR/TRR/Bau, findings per stage, blocking errors |
| | `graph_metrics` | per-module architecture metrics **plus the thresholds they were judged against** |
| **generate** | `graph_generate` | the cold-start driver: seed → expand → handoff, as a state machine |
| | `graph_suggest` | rank candidate fixes by how far they move the graph toward your target |
| | `graph_authoring_guide` | the legal edges for a given element type, before you write |
| **test evidence** | `graph_test_ingest` | feed a test run's results back into the graph |
| | `graph_test_report` | the report over those results |
| | `graph_tests` | which tests exist, and what they are bound to |
| **export** | `graph_export` | re-export the live graph to `docs/graph` + `docs/views` |
| **audit** | `audit_trail`, `audit_stats` | mutation history — every gate write logged |
| **help** | `graph_help` | explain any rule ID, gate, or dashboard token (read-only) |

The `realRef`/`testRefs` binding and the three test-evidence tools answer the obvious objection that
a model can drift from its code: the binding is an attribute the rules check (R-19, R-20), and
"done" means a test result landed in the graph, not that someone ticked a box.

### Bringing an existing project in

You do not have to start from an empty graph. Two import paths ship, with **deliberately different
semantics**:

| Skill | Source | Semantics |
|---|---|---|
| `se:import-code` | an existing TypeScript codebase | deterministic extraction — **no LLM**. Produces functions, modules, flows and schemas, never use cases or requirements (nobody can read intent out of code). **Reseed, not merge**: the imported part is replaced, a backup is written first. |
| `se:import-doc` | a document (PDF / Markdown / text) | two-stage: you see the skeleton and decide the element types in chat, then an LLM extract goes through the gate like any other write. **Merge (adds only)** — nothing existing is removed. |

Use `import-code` to bootstrap a brownfield repo's architecture, then `import-doc` to bring the
specification in on top.

### Generated documents

The SE document family is rendered from the graph, deterministically — same graph, same bytes.
After every applied change graphcode writes each document to `docs/views/`; `graph_export` writes
them on demand.

| File in `docs/views/` | Document |
|---|---|
| `rtm.md` | Requirements Traceability Matrix |
| `architecture.md` | Architecture allocation (SDD) |
| `icd.md` | Interface Control Document |
| `nfr.md` | NFR register |
| `testconcept.md` · `testmatrix.md` | test concept (pyramid + computed E2E gap) · VCRM |
| `intplan.md` · `implplan.md` | integration & test plan · implementation plan (MS/CR) |
| `conops.md` | Concept of Operations (ISO 29148 §5.2.4) |
| `fmea.md` | FMEA — failure modes, S/O/D, action priority |
| `changelog.md` | change log from the CR history |

Because they are generated, "the document is incomplete" and "the gate is still open" are the same
fact with the same cause — there is no separate documentation debt.

## Dashboard

`graphcode mcp` starts the GVE viewer and a read-only HTTP/SSE bridge along with the MCP server. Do
not start a second one — ask where yours is:

```bash
npx @sigloch/graphcode status
graphcode status — auth-service  (/Users/you/dev/auth-service)
  MCP-Host    OK             pid 40001, seit 2026-08-19T09:12:03.000Z
  Dashboard   OK             http://localhost:4318/
```

The address is stable per repo (derived from the repo path, 43000–43999), so a bookmark keeps
working. Opt out with `GRAPHCODE_NO_GVE=1`.

The host lives exactly as long as your agent session: closing the editor shuts down viewer, bridge
and store lock in order, and reopening brings the dashboard back at the same address.

## What it is / is not

- **Is:** a graph store, an MCP tool surface and one write gate. Agent-agnostic, headless, one
  embedded store per repo.
- **Is not:** a code generator, a learning engine, a code extractor, or the viewer itself — the
  dashboard is a separate package (GVE) that graphcode starts for you.

## Constraints (locked)

- **One store = Kuzu**, embedded, single-writer, on disk (`.graphcode/kuzu`) — never in-memory.
- **One transport = MCP over stdio** — no REST in the core.
- **One gate = `mutate()`** — every edit, human or AI, goes through it; the author is only logged.
- **Ontology and rules come from `@sigloch/contracts`** — imported, never forked. A new element
  type, connection type or rule needs a version bump there.

## Local development (this repo)

```bash
npm install        # everything from the registry — no private repo needed
npm run build      # tsc → dist/
npm test           # vitest — real disk Kuzu, no mocks
```

The five `@sigloch/*` dependencies (`contracts`, `graph-api-core`, `graph-cypher-wasm`,
`learning-core`, `se-steering`) are published packages, so a clone builds and tests without any
sibling checkout. `npm run link:siblings` switches them to local checkouts (`npm link`, reversed by
`npm install`). Migrating an old graph across the contracts 10.x major:
[docs/project/migrate-req-kinds.md](https://github.com/andreassigloch/graphcode/blob/master/docs/project/migrate-req-kinds.md).

graphcode's own model is [`docs/graph/graphcode.graph.json`](https://github.com/andreassigloch/graphcode/blob/master/docs/graph/graphcode.graph.json);
its claims and definition of done are in the
[guideline](https://github.com/andreassigloch/graphcode/blob/master/docs/graphcode_leitlinie.md) (German). graphcode is
part of a larger toolchain; some design-history documents reference governance documents that are
not public.

## License

MIT — see [LICENSE](https://github.com/andreassigloch/graphcode/blob/master/LICENSE).
