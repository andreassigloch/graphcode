# Words That Sound Alike — the Glossary

*Chat, turn, round, candidate, prompt — the other articles use these words precisely, but no single
place pins them down. This one does. Each term gets one meaning and one level; where two things nest,
the ladder says which contains which. Assumes nothing; links point where each term is used in anger.*

## The ladder — what contains what

```
request                 one real ask: a chat message, or the one CLI intent string
 └─ turn                one model invocation — prompt in, response out
     └─ round           one full pass of the loop: read → status → propose → apply → report
         └─ candidate   one drafted edit, competing to be the one that gets submitted
             └─ batch   the candidate's content: mutations submitted together, judged as one
                 └─ mutation   a single add / update / delete of one element or trace
```

- **request** — the outer boundary from [the advisory roundtrip](05-the-advisory-roundtrip.md): one
  real input in, one real result out. Everything below happens inside it.
- **turn** — one prompt sent to the model and its one response. In driver mode one round is normally
  one turn (history resets between rounds); a rejected batch adds a single repair turn before the
  round ends. An interactive assistant may fit several rounds into one turn or stretch one round over
  several.
- **round** — one full pass of the loop. It ends when an edit lands (or is finally rejected) and the
  KPIs are recomputed; the next round starts from the new weakest spot.
- **candidate** — a *complete draft edit* produced inside a round, before the gate has judged it. The
  built-in driver drafts several per round and ranks them (best-of-N); an interactive assistant
  usually drafts one and revises on rejection. A candidate that loses the ranking is simply dropped —
  only the winner ever reaches the real gate.
- **batch** — what a candidate is made of: one or more mutations submitted to the gate *together* and
  judged as one. Atomic: all of it lands or none of it. Measured range in a real run: 3 to 28
  mutations per applied batch.
- **mutation** — the smallest unit: add, update, or delete one element or one trace.

## Running the loop

- **inner loop / outer loop** — the rounds are the inner loop; the outer loop is the request
  boundary around all of them. Both modes below share this shape.
- **host mode** — an interactive assistant (Claude Code, OpenCode) paces the loop itself, deciding
  step size and order. The loop is *implicit* in its reasoning.
- **driver mode** — graphcode's built-in executor paces the loop as an *explicit*, fixed state
  machine: small rounds, fresh history each round, deterministic order. Why this exists at all is a
  strategy, not a convenience — see "going local" in [the claims](06-claims.md).
- **prompt** — everything the model sees in one turn. Its pieces (system prompt, tool definitions,
  graph context, instruction, history) and their measured sizes: [prompt
  anatomy](05-the-advisory-roundtrip.md).
- **instruction** — the per-turn ask. In driver mode it always opens with the project intent quoted
  fresh from the graph, then the one concrete task for this round.

## Judging an edit

- **rule** — a yes/no check computed from the graph. Fires or doesn't. The *only* thing in the whole
  system that can block an edit.
- **violation** — one rule firing on one element, carrying a severity: **error** (blocks the edit
  that would introduce it), **warning** / **info** (edit lands, gap stays visible as debt).
- **gate** — the one apply-path every edit takes, human or AI (`mutate()`). Judges the batch against
  the rules; author is only logged.
- **verdict** — the gate's answer for one batch: allowed / needs-review / blocked.
- **preview** — the same rule check run non-bindingly on a candidate *before* submission, to drop
  illegal drafts early. Same question, no consequences.
- **debt** — warning-level gaps carried openly (a test not yet bound to a file, a function not yet
  bound to code). Keeps readiness down until resolved; never silently filled in.
- **advisor** — the optional module that ranks candidates by KPI delta *before* the gate and reports
  fitness changes *after* it. A measurement, never a veto; it applies nothing itself
  ([the advisory roundtrip](05-the-advisory-roundtrip.md)).

## One word, several doors

Two words the articles overload — the glossary can't fix that, only flag it:

- **"gate"** names three different things. *The* gate (the apply-gate above) is the only one that
  blocks an edit. A *phase gate* (SRR–TRR) is a KPI threshold answering "ready for the next stage?".
  An *implementation gate* (SAR–FRR) is a KPI threshold answering "is milestone N done?". The last
  two never block anything — they are read-outs wearing a door's name.
- **"layer"** names three different things too: the five explanatory layers of
  [the story](04-the-graphcode-story.md) (vocabulary → grammar → readiness → diagnostics →
  optimization), a *content* layer of the graph (e.g. the flow layer whose absence a
  layer-presence check catches), and the *measurement* layer Architecture Fitness is computed on
  (the architecture subgraph: functions, flows, modules, schemas, actors).

## The KPI families — all of them

A **KPI** is a continuous number: it ranks, reports, or trends, and never vetoes. graphcode has more
than one family, and they answer different questions:

| Family | Numbers | Question it answers |
|---|---|---|
| Compliance | 1 | what share of elements is free of error-level violations? |
| `dimension_readiness` | 8 | which *topic area* (requirements, verification, …) needs work next? |
| Phase gates (SRR, PDR, CDR, TRR) | 4 | are we ready for the next *stage*? |
| Implementation gates (SAR, FCA, SVR, FRR) | 4 | is milestone N actually *done*? |
| Architecture Fitness | 6 | is the structure sound — modular, connected, bottleneck-free? |
| Module diagnostics | per module | is *this* module too exposed, too unfocused, too entangled? |
| Process KPIs (retro) | 6 | how did the *work itself* go — tokens per line, gate health, plan conformance? |

Three of these (dimension, phase, milestone) are groupings of the *same* rule-violation stream —
three views, one source ([the scoring landscape](07-the-scoring-landscape.md)). Architecture Fitness
is computed by entirely separate code and never fires a violation. The process KPIs are computed
after the fact, from the audit trail. None of them — ever — blocks anything.

- **target (direction)** — a chosen weighting over the six fitness numbers ("raise
  change-resistance"). Only with a target does "the fitness moved" become "the fitness *improved*".
- **delta (Δ)** — the change a single candidate would cause in a KPI, computed before applying it.
  Used to rank candidates: readiness-Δ first, fitness-Δ as the tiebreaker.

## The graph itself

- **element** — one typed node (13 types: system, actor, use case, requirement, function, flow,
  schema, module, test, milestone, change request, …).
- **trace** — one typed edge between elements (7 types); which pairs are legal is itself a rule.
- **ontology** — the fixed vocabulary of those types and legal connections, imported from a shared
  contract package, never forked per project.
- **graph version** — a counter stamped on every applied batch; what the audit trail and exports
  refer to.
- **SSOT** — single source of truth: the graph is the reference, documents and views are generated
  from it, never the other way around.

---

*Companions: [the story](04-the-graphcode-story.md) for the narrative, [the claims](06-claims.md)
for the pitch, [the advisory roundtrip](05-the-advisory-roundtrip.md) for one turn end to end,
[the scoring landscape](07-the-scoring-landscape.md) for how the measurement systems relate.*
