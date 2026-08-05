# Claims — graphcode in Q&A Form

**Claim:** with a deterministic ground truth, LLM output becomes predictable and auditable.

## Why was it built?

LLMs are still statistical "next word" prediction machines. The usual fixes for unreliable output
don't scale: bigger models buy accuracy at a steeply rising price, agents monitoring agents multiply
the error rate instead of catching it, and more "thinking" effort buys shrinking gains at exploding
token cost. And the better the model gets, the less reliably it follows instructions — a capable model
takes the clever shortcut to "get the job done" instead of the one you asked for.

## What issue does it solve?

Using LLMs in a regulated context is hard when output is only probably correct. Rising token cost,
politically motivated model cut-offs, and wasted compute all point at the same need: a sustainable,
deterministic way to check LLM output — for anyone who can't live with a 95%-correct answer.

## What is the approach?

A graph represents your software architecture against a predefined ontology — a pure, deterministic
ground truth. The agent checks its own implementation against hard rules, pulls only the context it
needs, gets a defined integration order, and more — all by database query, not statistical search.
Packaged as an add-on to Claude Code or OpenCode.

## What are the benefits?

A clear, always-current overview of your codebase, checkable visually and by algorithm — structure and
architecture quality alike. That overview enables automatic optimization. A smaller model benefits
most: small prompts plus traceable, structural checks on its output let it act as well as — or better
than — a much larger one, local or hosted (measured at project scale, not just per function — see
below).

## Does the local/small-model claim hold up under load?

Yes, with a nuance worth stating precisely. A 48-round trial ran the identical driver — same gate, same
readiness-driven loop, zero code branching between models — against a local 24B open model (devstral)
and two frontier models (Claude Opus 5, Claude Haiku 4.5), each authoring a full system graph from one
prompt.

- **Local matched frontier scope.** devstral reached 85 elements / 148 traces across every dimension,
  including the process layer (milestones, change requests) — for $0.
- **The smallest model won outright.** Haiku 4.5 produced the largest, cleanest graph (86/154, 5
  residual violations) for $1.58 in 15 minutes — beating Opus 5, which under the same driver produced
  the *smallest* graph of the three (57/81, 81 rejected batches) for $11.85.
- **Why Opus lost.** Its usual edge comes from working its own way — explore, then build, its own
  judgment on order. A tight, structured loop takes exactly that away. The same regime that scaffolds a
  small model constrains a large one used to deciding for itself.

The takeaway isn't "small beats big" as a rule — it's that **the fit between the loop and the model
decides**, and a deterministic gate plus a readiness-driven loop is what lets a model be judged on
following the method, not on raw scale. Full data:
[`docs/executor-abschlussbericht.md`](../executor-abschlussbericht.md).

That trial also names a strategy worth its own label: **going local**. The loop exists in two forms —
*implicit*, when an interactive assistant paces itself through the same tools, and *explicit*, when
graphcode's built-in driver imposes fixed, small rounds from outside. The explicit form *is* the
going-local strategy: the driver carries the method, so the model only has to follow it — which is
exactly what lets a $0 local model stand in for a frontier one.

## What are the downsides?

If the graph degrades, you have a problem. But because the graph is the reference, degradation is
visible early, not discovered downstream.

## Isn't that solved already?

Partially. Well-known harnesses like Claude Code, and tools like RooFlow, still stay on the statistical
side. More tools are adding AST parsing of the codebase to orient the LLM. None yet jump to a fully
deterministic ground truth.

## My motivation

I learned the power of graphs in systems engineering. For two years I've tried to bring those
principles' benefits into everyday coding, without the method-and-tooling complexity SE usually
carries. Guiding principles:

- The LLM knows tool and method.
- Structure and determinism over statistics.

And what better way to learn the limits of an idea than building the harness with it? graphcode is
built with graphcode; its graphical viewer and editor is the second project built the same way.

If you want to try it:

```
npx @sigloch/graphcode init
```

## How does graph technology support "structure before guessing"?

**Layer 1 — the ontology.** 13 element types and 7 connection types, including process-relevant types
that most code-graph tools skip: milestones (MS), changes (CR), and sessions (SESSION, the audit
trail).

**Layer 2 — the grammar.** How those elements may legally connect: 37 rules (constraints) define a
well-formed graph. An illegal connection never enters the graph — it isn't a warning to read later.

**Layer 3 — readiness.** 66 rules feed 8 readiness scores, one deliberately *not* asking "is this
correct?" — no tool can decide that — but "is it complete and well-formed?", which is decidable. I've
watched hundreds of strict quality gates pass by, and maybe a handful made it through without a
deviation. Dynamic readiness scores let you move back and forth — call it agile — while still being
pushed back onto the right path: the weakest score names the next sensible step. No AI in that loop.
That's also what lets a weaker, locally-run model act as well as — or better than — its larger
siblings: it's told what to do next, not left to guess.

**Layer 4 — module diagnostics.** A second, per-module set of checks: how exposed to change a module
is (Robert C. Martin's instability metric), whether it does one thing (LCOM4 cohesion), how often it
crosses paths with other modules. Warnings, not a single project-wide score.

**Layer 5 — a whole-graph fitness score, and optimization on top of it.** Separately, the graph as a
whole gets scored on structural qualities (modularity, redundancy, how connected it is, and more) —
and, given a target you choose, the same computation ranks candidate fixes by how far they'd move
toward it, like a chess engine calculating moves in advance. Still not AI, and still just a ranking:
a rule is what blocks or allows a change, never this score. Full map of how these layers relate:
[the scoring landscape](07-the-scoring-landscape.md).

## How does this work, end to end?

A simplified chat roundtrip: the harness gets the user request, reads storage, consults the model,
communicates the result, and writes storage back.

## And where's the systems engineering in that?

INCOSE guidelines translated into rules, INCOSE processes coded as skills, documents generated from the
graph. Traceability is guaranteed by the same graph rules. Actual INCOSE documents and methods are
still designed for humans, not for LLMs or computable KPIs.

## Does it speak SysML v2?

Feel free to write a serializer for it — should be possible.

## What's next?

The self-improvement and prediction engine: first to improve our own rules and target vectors, second
to predict the next action. Comprehensive logging of user input, rule firings, and calculated
optimization results gives a full audit trail today — and is the training input for self-learning
tomorrow.

---

*The layered breakdown here is the short form; for the full narrative see
[the GraphCode story](04-the-graphcode-story.md). For the gate mechanics behind "every check is a
query, not a guess": [under the hood](03-graphcode-harness-goal-and-concept.md). Terms pinned down:
[the glossary](08-glossary.md).*
