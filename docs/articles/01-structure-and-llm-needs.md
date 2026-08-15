# The Effect of Structure on What an LLM Needs

**Claim:** Replace document-reading with a precise graph query and the context an agent needs
for a task drops by more than two orders of magnitude — enough that a small model does work a
frontier model was doing.

## The comparison

One task, two ways to give an agent what it needs:

- **Unstructured:** read the spec, grep, re-read. The agent ingests the *whole* spec to use a
  sliver of it.
- **Structured:** pull one bundle from the project graph — the function's spec, the requirement
  above it, the test beside it, the data it touches. One call, bounded.

The measured pair — one task, one graph, both numbers from the same spike run:

| | Unstructured | Graph bundle |
|---|---|---|
| Context needed | ~34,000 tokens of spec + notes | **~250 tokens** |

Same correct result, **~136× less context** — both numbers from the same measurement: what the
original session actually read out of `SPEC.md` + spikes, against the `graph_context` closure for
the same node. Not because the spec was bloated — the waste is reading all of it to use one slice.
The bundle is bounded by construction; a document isn't.

## Why the ratio matters more than it looks

A separate arm of the same spike gave a small open model running locally the *full* definition of
done for one function as a graph bundle — 11 nodes, ~667 tokens — and it implemented the function
correctly: all five acceptance criteria, statically checked and actually executed. That bundle is
the *larger*, complete one — a full definition of done still cheaper than reading a single spec
chapter.

The model never read the document at all, and that carries correctness for free: where graph and
spec disagreed, it followed the graph, because a stale document could not reach it. Structure
doesn't just compress — it decides what the model can even go wrong on.

---

*Repo: <https://github.com/andreassigloch/graphcode>. Full data:
[`SPIKE-GC-context-sufficiency-RESULTS.md`](../spikes/SPIKE-GC-context-sufficiency-RESULTS.md).*
