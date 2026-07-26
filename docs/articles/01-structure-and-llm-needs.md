# The Effect of Structure on What an LLM Needs

**Claim:** Replace document-reading with a precise graph query and the context an agent needs
for a task drops ~50× — enough that a 27B model on a laptop does work a frontier model was
doing.

## The measurement

One real task: implement a function and pass its test. Two ways to give the agent what it needs:

- **Unstructured:** read the spec, grep, re-read. The agent ingests the *whole* spec to use a
  sliver of it.
- **Structured:** pull one bundle from the project graph — the function's spec, the requirement
  above it, the test beside it, the data it touches. One call, bounded.

| | Unstructured | Graph bundle |
|---|---|---|
| Context for the milestone | ~34,000 tok of spec + notes read | **~667 tok** |
| Spec re-reads | the full spec | **0** |

Same correct result, **~50× less context.** Not because the spec is bloated — a full spec is
fine. The waste is reading all of it to use one slice. (And the unstructured pattern has no
ceiling: across a multi-milestone session it grew to **619k tokens**. The bundle is bounded by
construction.)

## The threshold, not the savings

Tokens are the headline; viability is the point. A 27B open model running locally implemented
the function correctly **from the 667-token bundle alone** — recall 1.0, deterministic, every
result cited, 192 s. The same model behind a heavy harness ran out of context at 22k. Structure
is the difference between "27B nails it" and "27B can't fit the problem."

## Correctness comes free

The prose spec — a plain `SPEC.md` text file — was deliberately wrong: a looser pass-threshold,
citations marked optional, random IDs. The graph held the *correct* bar (strict threshold,
citation required, deterministic output). The model followed the graph, not the document,
**because it never read the document.** It didn't need to, so the bad input never entered
context. Structure removes the path on which things go wrong.

## Same task, four executors

All passed with the same ~10 tool calls and zero spec reads — the gap is inference speed, not
effort.

| Executor | Model | Result | Wall |
|---|---|---|---|
| Cloud agent | frontier | pass | **157 s** |
| Local lean agent | 27B local | pass | 201 s |
| + graph write-back | 27B local | pass, graph updated | 293 s |
| Heavy agent, 40k ctx | 27B local | pass | 556 s |
| Heavy agent, 22k ctx | 27B local | **fails — context overflow** | — |

## Honest limits

Single milestone, wall-clock on one laptop, not normalized. The core finding is a ratio, not a
clock: **~667 tokens of structure replaced ~34k of prose, and that gap is what made a small
local model enough.**

---

*Repo: <https://github.com/andreassigloch/graphcode>. Executors: cloud = `claude -p`; local
lean = `opencode`; heavy = `claude -p` pointed at the local model; local model = `qwen3.6-27b`
on a 48 GB M4. Reproduce: `rig/dummy-slicer/`. Full data:
[`SPIKE-GC-context-sufficiency-RESULTS.md`](../spikes/SPIKE-GC-context-sufficiency-RESULTS.md),
[`SPIKE-GC-loop-executor-benchmark.md`](../spikes/SPIKE-GC-loop-executor-benchmark.md).*
