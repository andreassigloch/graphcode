# How an Edit Lands — the Advisory Roundtrip

*The companion to [Under the Hood](03-graphcode-harness-goal-and-concept.md). That article explains
what "one gate" means; this one walks a single chat turn through the gate, end to end, and shows
where an optional quality advisor attaches — before the edit and after it.*

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
⑤ measure   ADVISOR, after the edit
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
| ⑤ measure| resistance-to-change improved, but self-containment (one of the six fitness numbers) got slightly worse |
| ⑥ report | "Applied. Change-resistance up, self-containment slightly down — intended?" |

You (or the agent) see the *tradeoff* in ⑤ — without the advisor ever having blocked the edit.

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
