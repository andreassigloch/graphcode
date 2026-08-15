# GraphCode Under the Hood — Design Decisions and Stack

*The technical companion. What GraphCode is and why it exists is
[the story](04-the-graphcode-story.md); what it measurably buys you is
[the structure benchmark](01-structure-and-llm-needs.md). This article is the engineering detail
behind both.*

## What "governed" actually means

**One gate.** Every edit to the model — human or AI — goes through the same function. It rule-checks
the result, blocks anything that introduces a new error-level violation, and logs the author. There
is no second write path: the graph file cannot be hand-edited, and that is enforced by a pre-write
hook, not by a request in the documentation.

**One source of truth.** One store per repository, one process owning it. The committable
`graph.json` is a deterministic export of that store, never a parallel copy that can drift.

**One vocabulary.** Element types, connection types and rules come from a shared contracts package
and are imported, never forked. A new type or rule is a versioned decision, not a local edit. Without
that, every project grows its own dialect and nothing stays comparable.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Store | Kuzu — embedded graph DB, single-writer, on disk (never in-memory) | "What breaks if I change this" is a query, not a grep; one process owns one store per repo |
| Transport | MCP over stdio (the agent-host protocol) | Agent-agnostic and headless; no REST backdoor that skips the gate |
| Apply path | one `mutate()` gate | Every edit rule-checked, author-logged, blocked on new violations |
| Schemas | Zod at every boundary | Schema-first; no hand-rolled validation |
| Ontology + rules | shared contracts package — imported, never forked | New type/rule = family decision + version bump; no local dialect |
| Local execution | OpenCode + bring-your-own-key, or the built-in executor below | Two ways to run a local model — see "Two ways to run the loop" |

The current vocabulary: 13 element types, 7 connection types, 36 legal connection patterns,
72 engine rules across 8 readiness dimensions, exposed as 25 MCP tools.

## Two ways to run the loop

The tools above get called by whatever is driving the conversation — and there are two different
drivers, for two different situations.

- **An interactive assistant you already use** (Claude Code, OpenCode, or similar): the model paces
  itself. It decides what to read, in what order, when to write. This suits a model that plans well
  on its own.
- **A built-in executor** (`graphcode run` — no separate coding assistant needed): for each step, it
  hands the model exactly ONE precise instruction — which few elements are missing and what they
  should connect to, nothing else. The model doesn't plan the work; it's told the work, one
  bite-sized slice at a time.

Why both exist: a small or locally-run model does better with the second — being told exactly what
to do next, rather than left to plan a large task itself. A large, capable model often does better
with the first, left to explore on its own terms. Same store, same gate, same rules underneath
either way; only how work is handed to the model differs. The second form is the strategy
[the claims](06-claims.md) call *going local*.

## The bet: a precise query, not a compressed result

The alternative to "fetch a lot and summarize it" is "ask a question small enough that the answer is
already small". Three read tools carry that:

- **`graph_impact(id)`** → the exact downstream blast radius. Bounded, never a dump.
- **`graph_context(id)`** → the upstream definition-of-done: the node, its specification, the test
  that verifies it, the data it touches, the module that owns it. One call you can implement from.
- **`graph_expand(id)`** → deepen exactly one branch, only when the previous answer wasn't enough.

Their write-side twin is **`graph_authoring_guide(type)`**: before creating a node, the agent asks
which connections are legal for that type, instead of guessing the shape and being rejected by the
gate. That matters most for small models, which guess the mutation shape badly.

And **`graph_next_step()`** condenses the whole advisory rule set into one prioritized action, derived
from the weakest readiness dimension. Deterministic — no model involved in deciding what to do next.

## The loop

Specification through the gate → know the target by query → implement in real files → export back to
committable documents. Writes only ever go through the gate; the exported graph file is never
hand-edited.

## Scope

- **Is:** the substrate — model, store, gate, and the tools an agent reads and writes it with.
  Headless; plugs into an agent host you already use.
- **Isn't:** a code generator, a learning engine, a dashboard, or a code extractor. A viewer exists
  as a separate sibling and connects through a read-only bridge; it never gets its own write path to
  the store.

## Open

- Multi-milestone runs through to end-to-end are not yet benchmarked; the published timings are
  unnormalized wall-clock on one machine.
- Layer 5 — computing an improvement to the architecture and applying it through the same gate — is
  detection and recommendation today, not automatic rewrite.

---

*Repo: <https://github.com/andreassigloch/graphcode>. Constraints:
[`README.md`](../../README.md). Benchmark detail: [`docs/spikes/`](../spikes/). Cross-model comparison
(local vs. frontier, same driver): [`docs/executor-abschlussbericht.md`](../executor-abschlussbericht.md).*
