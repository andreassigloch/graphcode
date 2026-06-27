# The GraphCode Harness — Goal and Concept

## Pitch

An AI coding assistant spends most of its effort just figuring out *where it is* — opening
files, searching for names, guessing how things connect. **GraphCode gives it the map:** a
structured model of what the project must do (requirements), how that's proven (tests), what
implements it (modules), and how they connect. The agent asks the map a precise question and
gets back exactly the relevant part — instead of reading everything and hoping.

Code stays as normal text files. The graph holds the *model* — intent, rules, connections. Code
is the *what*; the graph is the *why and how-it-fits*.

## Goal

Make AI coding cheaper, more reliable, and runnable on smaller models — by feeding the agent
precise structure instead of whole documents.

- **KNOWS, not guesses.** Asked to change a function, the agent gets the exact set of tests and
  modules that touch it — not a pile of search hits.
- **Nothing rots.** Every change — human or AI — passes one checkpoint that rule-checks it and
  rejects anything that breaks the model (e.g. a requirement with no test).
- **Small models suffice.** A precise bundle instead of a 600k-token pile means a laptop model
  can do the job — a 27B local model, from a 667-token bundle (see
  [the structure benchmark](01-structure-and-llm-needs.md)).

## What "governed" means

**One gate** — the single function every edit goes through; human and AI pass the same checks,
and every write is logged with its author (a full audit trail). **One source of truth** — the
map lives in one place, re-exported deterministically; no second copy to drift.

## Scope

- **Is:** the substrate — map, store, gate, and the tools the agent reads/writes it with.
  Headless; plugs into your existing agent.
- **Isn't:** a code generator, a learning engine, a dashboard, or a code extractor.

---

## For the nerds

### Stack

| Layer | Choice | Why |
|---|---|---|
| Store | Kuzu — embedded graph DB, single-writer, on disk (never in-memory) | "Blast radius" is a query, not a grep; one process owns one store per repo |
| Transport | MCP over stdio (the agent-host protocol) | Agent-agnostic, headless; no REST backdoor that skips the gate |
| Apply path | one `mutate()` gate | Every edit rule-checked, author-logged, blocked on new violations |
| Schemas | Zod at every boundary | Schema-first; no hand-rolled validation |
| Ontology + rules | shared contracts package — imported, never forked | New type/rule = family decision + version bump; no local dialect |
| Local exec | OpenCode + bring-your-own-key | Lean local path; matched cloud on tool count with a smaller window |

### The bet: precise query, not result compression

Don't fetch a big result and compress it — ask a question small enough that the answer already
is small.

- `graph_impact(id)` → exact downstream blast-radius (the dependents), bounded, never a dump.
- `graph_context(id)` → the upstream Definition-of-Done: node + spec + verifying test + data +
  owning module. One call to implement from.
- `graph_expand` → deepen one branch, only when needed.

Loop: spec through the gate → KNOW by query → implement in real files → re-export to committable
docs. Writes go only through the gate; the graph file is never hand-edited.

### Numbers

- **~667 tok** graph bundle replaced **~34k tok** of spec-reading for the same milestone (~50×
  less); **0 spec reads**.
- A **27B local model** implemented it correctly from that bundle — recall 1.0, deterministic,
  192 s; the same model under a heavy harness overflowed at 22k context.
- The spec was deliberately corrupted; the model stayed correct because it never had to read it.

### Open

Multi-milestone-to-E2E not yet benchmarked; timings are unnormalized wall-clock; small models
still need an authoring helper so they don't have to guess the exact mutation shape.

---

*Repo: <https://github.com/andreassigloch/graphcode>. Constraints SSOT:
[`README.md`](../../README.md) + locked-decisions doc. Benchmark detail:
[`docs/spikes/`](../spikes/).*
