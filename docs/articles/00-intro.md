# Why Everyone Is Suddenly Talking About Graphs and Harnesses

Language models are still statistical machines: they predict the next word. The usual remedies scale
badly.

- **Bigger models** buy accuracy at a steeply rising price per point.
- **Agents supervising agents** inherit the same weakness — multiplying a writer's failure rate by a
  reviewer's does not remove either one.
- **More thinking** buys shrinking gains at exploding cost.

And one failure mode gets *worse* as models get better: a capable model optimizes for the result it
believes you want, not for the instruction you wrote. It takes the clever shortcut — disables the
failing test, loosens the requirement, quietly edits the specification instead of the code — and
reports success.

## What a harness fixes, and where it stops

The harness answers this with built-in defaults, checks, hooks and house rules, and it works well.
But almost all of those instructions remain *recommendations*: the agent follows them, or it doesn't.
For anyone who cannot live with 98% correct, that is not enough — and keeping the recommendations
current is real, recurring effort, which is to say real money.

## What a graph fixes, and where it stops

Graphs are the other half of the current conversation. A graph stores relationships that were
discovered in the code, and it genuinely helps: the model orients itself faster and more reliably
than it can by grepping. But a map of what *is* cannot tell you what *ought to be*. If nothing
defines which elements and which connections are actually **correct**, the graph makes the model
faster without making it right — it just gets to the wrong answer sooner, with more confidence.

## The missing half

That is the gap this series is about: a graph that is **normative**, not descriptive. A fixed
vocabulary of element types and connection types, a grammar that says which connections are legal at
all, and rules that decide whether the model is complete and well-formed — all of it decidable by
query, none of it by a second model's opinion. Then a single gate through which every edit must pass,
human or AI alike, so the graph cannot silently degrade into a map again.

What that buys, measured rather than asserted, is the rest of the series:

| | |
|---|---|
| [01 — Structure and what an LLM needs](01-structure-and-llm-needs.md) | what precise context does to the token bill |
| [02 — Vorgaben als Modell](02-vorgaben-als-modell.md) | why instructions belong in the model, not in a prompt |
| [03 — Under the hood](03-graphcode-harness-goal-and-concept.md) | the store, the gate, the tools |
| [04 — The graphcode story](04-the-graphcode-story.md) | the long-form narrative, benefits and downsides |
| [05 — The advisory roundtrip](05-the-advisory-roundtrip.md) | one edit, end to end, with timings |
| [06 — Claims](06-claims.md) | the Q&A form, including what did *not* hold up |
| [07 — The scoring landscape](07-the-scoring-landscape.md) | every number the system computes, and which ones judge |
| [08 — Glossary](08-glossary.md) | the terms, pinned down |
| [09 — The systems engineer's view](09-the-systems-engineer-view.md) | keep the thinking, drop the bookkeeping |

---

*Repo: <https://github.com/andreassigloch/graphcode>.*
