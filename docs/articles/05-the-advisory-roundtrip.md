# How an Edit Lands — the Advisory Roundtrip

*The companion to [Under the Hood](03-graphcode-harness-goal-and-concept.md). That article explains
what "one gate" means; this one walks a single chat turn through the gate, end to end, and shows
where an optional quality advisor attaches — before the edit and after it. Turn, round, candidate,
batch — used precisely here, pinned down in [the glossary](08-glossary.md).*

## Two separate measurements, easy to conflate

graphcode computes an **Architecture Fitness** score for the code's structure — six numbers,
roughly: how modular the pieces are, how much redundancy exists, how short the paths from input to
output are, how self-contained each module's connections stay, how connected the whole thing is, and
how free it is of single-point bottlenecks.

By itself, that score doesn't say whether an edit is good — going up isn't always better (a banking
app and a billion-user app want different tradeoffs). You give it a **target direction** — e.g. "I
care about being change-resistant" — and only then does "moved toward the target" become a
meaningful score.

The **advisor** (an optional module, not part of the gate) does two things with this: **before** an
edit, it can rank candidate fixes by how far each would move Architecture Fitness toward a given
target. **After** an edit, it reports how the fitness numbers actually changed — no target needed for
that part, it's just "what moved, and did anything get worse." The two are easy to mix up because
they share the same six numbers; only the "before" one needs a target to mean anything.

Neither one ever blocks anything. The advisor measures and ranks; the gate — the rule-checker from
[Under the Hood](03-graphcode-harness-goal-and-concept.md) — is the only thing that can refuse an
edit.

## The chain

One roundtrip, six steps. The two advisor touchpoints are marked; neither is the gate.

*Of the six, four are built and live: ① read, ② status, ③ propose, ④ apply — modeled in
graphcode's own graph as `FCHAIN-advisory-roundtrip`, composing the real functions behind each
step. ⑤ measure (Architecture Fitness before/after) is not built — this section describes the
intended design, not what ships today. ⑥ report is the tool response, not a separate function.*

```
Chat intent
   │
   ▼
① read      look up the relevant slice of the graph      → a bounded answer, not a grep
   │
   ▼
② status    check what rules say is open right now        → where it stands, what is open
   │
   ▼
③ propose   ADVISOR, before the edit
   │        given a target direction, rank candidate fixes by how far each moves
   │        Architecture Fitness toward it; return the best one + a preview verdict.
   │        Never applies anything itself.
   ▼
④ apply     the one Apply-Gate                             → rule-checks the edit for real
   │
   ▼
   verdict  legal? fully wired? → allowed / needs-review / blocked
   │
   ▼
⑤ measure   ADVISOR, after the edit — NOT BUILT YET, see note above
   │        Architecture Fitness, before vs. after — named if any of the six got worse
   ▼
⑥ report    verdict + any rule violations + the before/after fitness numbers
```

The rule that holds over the whole chain: **the advisor ranks (③⑤), the gate judges (④).** The
advisor is a *measurement*, never a veto — the only thing that blocks an edit is a rule.

## A worked example

Intent: *"make the auth module more resistant to change."*

| Step | What happens |
|------|--------------|
| ① read   | look up the auth module's neighborhood — one function feeds four data-flows, one shared data shape is used everywhere |
| ② status | a rule warns: the auth module has too many other things depending on it |
| ③ propose| target = "resistant to change" → top move: split one data-flow in two, ranked ahead of the alternatives, preview: allowed |
| ④ apply  | the split is applied — rules stay clean, it's persisted |
| ⑤ measure| *(not built — illustrative only)* resistance-to-change improved, but self-containment (one of the six fitness numbers) got slightly worse |
| ⑥ report | "Applied. Change-resistance up, self-containment slightly down — intended?" |

You (or the agent) would see the *tradeoff* in ⑤, once it exists — without the advisor ever having
blocked the edit.

## How fast is one round, really

①+②+③+④ (the built part of the chain) is deterministic — no LLM, no network — so it has an actual
wall-clock cost worth measuring, not just describing. `REQ-advisory-roundtrip-latency` binds it to
under 200ms at graphcode's current graph size (382 elements); `REQ-responsiveness` covers a
narrower, older case — draft-apply on just the affected subgraph, not the whole round.

Measured (`SPIKE-GC-advisory-roundtrip-latency.md`): the round missed the 200ms budget out of the
box (363ms) — not from any single slow step, but from `suggestEdits` (③ propose) doing a full
`structuredClone` of the whole graph and a redundant full rule re-evaluation, once per candidate
fix it considered. Fixed at the root (`sigloch-modules` CR-SM-228: shallow-copy the additive edit
instead of deep-cloning the graph, reuse the violations the caller already computed instead of
re-deriving them) — verified 123ms, under budget. Not yet live in this repo: the fix is committed
but unpublished, waiting on an unrelated gap in a concurrently-developed sibling CR. The round
does not scale flat, either — 5x the graph is still over budget (1,120ms) even after the fix; that
remains open, not hidden.

## Prompt anatomy, per turn

What actually goes into a turn's context breaks into six pieces — and the two ways of running the
loop from [Under the Hood](03-graphcode-harness-goal-and-concept.md) ("Two ways to run the loop")
fill them very differently.

| Piece | Driver (built-in executor) | Host (Claude Code / OpenCode) |
|---|---|---|
| System prompt | graphcode's own, fixed, ~320 tokens, identical every round | the assistant's own system prompt — a different artifact, not graphcode's, not measurable from here |
| Tool definitions | not applicable — the driver calls the gate directly | graphcode's 22 tool descriptions, ~2,600 tokens, loaded once per session |
| Graph context + open rules | pre-merged into one block by the driver, ~530–1,580 tokens, growing with graph size | fetched by the assistant itself, as separate tool calls — size depends what it asks for (a comparable bundle measured elsewhere: ~670 tokens) |
| Target/KPI feedback | not shown to the model at all — used internally for ranking only | shown, if the assistant calls the optimizer itself |
| Turn instruction | project intent (re-read from the graph, quoted fresh) plus the one concrete ask for this round, always both together, ~370 tokens typical | the user's chat message, free length |
| History | resets every round — only which finds got stuck survives, not context | the whole conversation so far, unbounded |

**One driver round, typical case:** ~320 (system) + ~370 (instruction) + ~530–1,580 (graph context,
growing as the graph does) + ~65 (format reminder) ≈ **1,300–2,300 tokens**, no history carried
forward. A rejected batch adds the gate's feedback (capped at ~625 tokens) on top, for that one
repair attempt only — never accumulating across rounds.

Two things in that table are easy to get wrong:

- **The system prompt is constant *within* each mode, not *across* them.** The driver's is
  graphcode's own fixed string. An interactive assistant's system prompt is a wholly different
  artifact — its own, unrelated to graphcode — plus graphcode's tool descriptions, and, only if a
  skill is explicitly invoked, that skill's full text. The driver never loads a skill's text: a
  skill's *name* (e.g. "Skill se:author-uc") appears as a three-word pointer inside the round
  instruction, never its content.
- **Chat intent and the round's instruction are never either/or.** The project's original intent is
  written into the graph exactly once, in the very first round — then re-read from there and quoted
  at the start of *every* round's instruction after that, driver mode or not. It's not a separate
  turn competing for space; it's the first sentence of each one.

## The outer loop this all sits inside

Everything above — the six-step chain, the prompt anatomy, the many rounds — is an *inner* loop.
It always sits inside the same outer boundary: one real request in, one real result out.

```
customer input (a chat message, or the one CLI intent string)
        │
        ▼
   ┌───────────────────────────────────────────────┐
   │  inner loop — driver or host, many small       │
   │  rounds or fewer large ones, everything above  │
   └───────────────────────────────────────────────┘
        │
        ▼
result reported back (a chat reply, or the CLI exiting with a report)
        │
        ▼
   ... waits for the next customer input ...
```

Driver and host don't differ in *whether* they loop inside that boundary — both do, every time.
They differ in *who paces the inner loop*: an interactive assistant paces itself, deciding step size
and order as it goes; the driver's inner loop is an external, fixed, deterministic state machine
imposing small steps on a model that can't reliably choose its own. Same outer shape, two different
drivers for the same inner wheel.

## Self-correction: what blocks, what is carried as debt

The gate is a **judge, not a repairer**, and it only rules on what changes with *this* edit. Two
behaviors, split by how serious the problem is:

- **Add a requirement, forget the test that proves it → blocked.** That's a hard rule: nothing
  persists, and the response names exactly what's missing plus candidate tests already in the graph.
  The fix is one combined edit — requirement + test + the link between them — applied together.

- **Leave a link half-finished → carried as debt, not blocked.** A test not yet wired to real code,
  or a function not yet wired to a real file, is a softer warning: the edit still lands, but the gap
  stays visible every time you check status, and it keeps the readiness score down until it's
  resolved. A placeholder for the missing test file is created automatically so nothing points at a
  file that doesn't exist — the assertion inside it is still yours to write.

Nothing has to be asked for — the system always surfaces the next open item on its own. It does not
fill gaps in for you; it makes sure they stay visible until you do.

## What's planned

- **Planning a few edits ahead, not just one.** Today the advisor ranks a *single* fix at a time. A
  planned extension would let it look a few moves ahead — like a chess engine — so it can plan a fix
  *plus* whatever second edit is needed to avoid the tradeoff it would otherwise create. It still
  never blocks and never applies on its own.

- **Learning better targets over time.** Today you set the target direction by hand. Eventually the
  system could learn, from its own accumulated history of edits and outcomes, which targets and rules
  tend to help — and suggest refinements. This stays switched off until there's real operating data
  proving it actually helps; a learned suggestion would still be a decision you approve, never a
  silent change.
