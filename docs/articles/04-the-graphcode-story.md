# The GraphCode Story

## Why I built it

Language models are still statistical machines: they predict the next word. The usual remedies scale
badly.

- **Bigger models** buy accuracy at a steeply rising price per point.
- **Agents supervising agents** inherit the same weakness — a reviewer that guesses checks a writer
  that guesses.
- **More thinking** buys small gains at exploding cost.

And one failure mode gets *worse* as models get better: a capable model optimizes for the result it
believes you want, not for the instruction you wrote. It takes the clever shortcut — disables the
failing test, loosens the requirement, quietly edits the specification instead of the code — and
reports success.

## What problem it solves

It solves reliability for anyone who cannot live with "probably correct". Regulated environments,
safety-relevant work, or simply a codebase you have to defend to someone.

Three more pressures point the same way: cost per token, the risk that a model you depend on becomes
unavailable — commercially or politically — and the plain waste of re-reading thirty pages of
documentation to make one small change.

The answer is not a better guess. It is to take the guessing out of everything that can actually be
decided.

## Who it is for

Vibe coding, but with architecture and transparency instead of vibes alone. It is for people who
direct the work rather than type it — who describe what should exist, let the assistant build it, and
still want to know at any moment how the thing is put together and whether it still holds up.

I am one of them: I personally never touch a line of code. That is precisely why I need the structure
to be visible and checkable. If you do not read every diff, "it works" is not something you can
verify by reading — it has to be something the project can show you. Vibe coding without that ends up
with a codebase nobody can explain, least of all the person who commissioned it.

So the audience is not only regulated industries. It is anyone who wants to build fast *and* be able
to answer: what is in here, how does it fit together, and what breaks if I change this?

## The approach

A graph holds the project's model: what the system must do, who uses it, which functions and modules
exist, which interfaces they share, which tests prove what — and how all of that is connected.

The important part is the direction. Most tools read your code and draw a picture of it; the code
stays the truth. Here the model *is* the truth, and the code has to match it.

That turns questions the agent used to answer by guessing into questions a database answers exactly:

| Question | Before | Now |
|---|---|---|
| What does this change break? | search, read, hope | the exact list of affected parts |
| What do I need to know to implement this? | read the spec, the decisions, three files | exactly the connected neighbourhood |
| What should I do next? | ask the model | the weakest area of the project, computed |
| Is this edit allowed? | a review, later | refused at the moment it is attempted |

In one sentence: replace *search* with *ask*. Your code stays ordinary text files in your repository.
Only the model lives in the graph.

**You choose how deeply you model.** Rough is fine — a few requirements, the modules, the main
functions. Detailed is also fine. The difference is not effort spent for its own sake; it is how much
freedom the implementer gets. Model loosely and the agent decides more. Model tightly and it decides
less. That is a dial you set per project, and you can turn it up later exactly where it hurt.

It installs as an add-on to the coding assistant you already use — one command, and the assistant can
talk to the graph. It is not tied to one vendor's assistant.

## The benefits

- **You always have an overview.** The structure of your project is visible and measurable, not
  folklore that lives in someone's head.
- **Small models become good enough.** In one measured trial, a model small enough to run on a
  laptop implemented a function correctly — all five acceptance criteria, actually executed — from a
  precise 667-token briefing pulled out of the graph: 11 nodes, the whole definition of done. Precise
  context beat the bigger model.
- **Correctness of the structure is checkable without AI.** The result is verified against rules, not
  against a second model's opinion.

## The downsides

- **If the graph degrades, you have a problem.** It is the reference everything is measured against.
  The consolation is real, though: because it *is* the reference, degradation shows up as a number
  early, instead of surfacing as a mystery six months later.
- **Model and code can still drift apart.** The graph knows which code and which test belong to each
  element and complains when the link is missing — but it cannot tell you that the code behind a
  correct link does the wrong thing.
- **It requires discipline.** Every change to the model goes through the same checkpoint, including
  yours. There is no quick hand-edit "just this once" — that is the whole point, and some days it
  will annoy you.
- **One project, one owner.** Exactly one process writes to the graph at a time. Deliberate, and a
  constraint you live with.

## Isn't this already solved?

Partially, and it is worth being precise about who does what.

The well-known assistants and orchestration frameworks stay on the statistical side: better prompts,
better context assembly, more agents in parallel. A growing group of tools goes further and builds a
map *out of* your source code, so the model can find its way around. Both are useful. Both are
descriptive: the code is the truth, and the map is a snapshot of it.

The step nobody has taken is turning the map into the *authority* — the thing the code is checked
against, with a checkpoint that refuses changes which contradict it. That is the gap.

## My motivation

I learned how much structure buys you through systems engineering. For two years I have been
adapting those principles to get the *benefit* of that discipline without the *burden* of its methods
and tools. Two leading principles:

- **The tool and the method are the LLM's problem, not the user's.**
- **Structure and determinism beat statistics.**

And what better way to learn than building the harness yourself? GraphCode was built with GraphCode.
Its siblings — a graph viewer/editor and my PDF-to-graph app — were the first test subjects.

## How a graph delivers structure instead of guessing

Five layers. Each one is computed, not estimated. Each is useful on its own.

### 1. The vocabulary — what may exist

13 element types and 7 connection types. The elements cover the engineering side —
system, use case, actor, function, data flow, requirement, test, module, interface — and the process
side: change requests, milestones, work sessions. Planning lives in the same graph as the design,
not in a spreadsheet next to it.

You never define this vocabulary yourself; it comes with the tool and is shared across projects. That
is what makes everything below it comparable.

### 2. The grammar — how things may connect

36 legal connection patterns. Which kind of element may be connected to which, and in what way.
An illegal connection is not a warning in a report you might read — it never enters the graph.

### 3. Readiness — is it complete and well-formed?

72 engine rules feed 8 readiness dimensions: requirements, use cases, functional architecture,
module allocation, verification, interfaces, change requests, milestones. Each area gets a percentage
and a threshold.

Notice what this deliberately does *not* ask. Not "is the content correct" — no tool can decide that.
It asks "is it complete and consistent", which *is* decidable, and which is most of what a quality
review actually checks anyway.

Why this matters to me: I have watched hundreds of strict quality gates go by, and maybe a handful
passed without deviations. A gate you always fail teaches nobody anything. Continuous readiness
scores let you move back and forth — call it agile — and still be pushed back onto the path, because
the weakest area names the next sensible step. No AI in that loop. Which is exactly what lets a
smaller, locally running model perform like a bigger one: it is *told* what to do next instead of
having to infer it.

### 4. Module diagnostics — is each module healthy on its own?

Beyond "is it complete", a second set of checks looks at each module by itself, in plain terms:

- **How exposed a module is to change.** A module that depends on many others while many others
  depend on it is where every change hurts. *(instability, Robert C. Martin)*
- **Whether a module does one thing.** If its inner parts have nothing to do with each other, the
  module is really two modules wearing one name. *(LCOM4, Chidamber–Kemerer / Hitz–Montazeri)*
- **How often it crosses paths with other modules.** Frequent, uncoordinated crossings mean a
  boundary that exists only on the diagram, not in practice.

These are per-module warnings, not a single project-wide score — a different, complementary thing
from the whole-graph optimization score covered in [the advisory roundtrip](05-the-advisory-roundtrip.md).
The full map of every scoring system and how they relate: [the scoring landscape](07-the-scoring-landscape.md).

### 5. Optimization

The same measures that judge the structure can also suggest how to improve it: a function that only
passes data along, two paths doing the same work, near-duplicate functions and interfaces.

Today these are findings and recommendations — computed from the graph, deterministic, presented to a
human or an agent. The rewrite is not applied automatically yet. Closing that loop — computing the
change that improves the structure and sending it through the same checkpoint as every other change —
is the open end of the story, and the reason the first four layers had to be free of guesswork.

---

*Repo: <https://github.com/andreassigloch/graphcode>. The measured numbers behind the "small models
are good enough" claim: [the structure benchmark](01-structure-and-llm-needs.md). The engineering
detail — stack, gate, tools: [under the hood](03-graphcode-harness-goal-and-concept.md).*
