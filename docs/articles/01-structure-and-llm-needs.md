# The Effect of Structure on What an LLM Needs

**Claim:** Replace document-reading with a precise graph query and the context an agent needs
for a task drops ~50× — enough that a small model does work a frontier model was doing.

## The comparison

One task, two ways to give an agent what it needs:

- **Unstructured:** read the spec, grep, re-read. The agent ingests the *whole* spec to use a
  sliver of it.
- **Structured:** pull one bundle from the project graph — the function's spec, the requirement
  above it, the test beside it, the data it touches. One call, bounded.

| | Unstructured | Graph bundle |
|---|---|---|
| Context needed | ~34,000 tokens of spec + notes | **~667 tokens** |

Same correct result, **~50× less context.** Not because the spec was bloated — the waste is
reading all of it to use one slice. The bundle is bounded by construction; a document isn't.

## Why the ratio matters more than it looks

A small open model running locally implemented the task correctly from the 667-token bundle
alone. The same model, given the full document instead, ran out of context before finishing.
Structure is the difference between "the small model nails it" and "the small model can't fit
the problem."

It also carries correctness for free: the model never read the document, so a wrong or sloppy
document never entered context in the first place. Structure doesn't just compress — it decides
what the model can even go wrong on.

---

*Repo: <https://github.com/andreassigloch/graphcode>. Full data:
[`SPIKE-GC-context-sufficiency-RESULTS.md`](../spikes/SPIKE-GC-context-sufficiency-RESULTS.md).*
