# How an Edit Lands — the Advisory Roundtrip

*The companion to [Under the Hood](03-graphcode-harness-goal-and-concept.md). That article explains
what "one gate" means; this one walks a single chat turn through the gate, end to end, and shows
where the SE-optimizer advisory attaches — before the edit and after it.*

## The chain

One roundtrip, six steps. The two advisory touchpoints are marked; neither is a gate.

```
Chat intent
   │
   ▼
① read      graph_context · graph_impact · graph_expand   → a bounded subgraph, not a grep
   │
   ▼
② status    graph_readiness + rules_evaluate              → where it stands, what is open
   │
   ▼
③ propose   graph_suggest            ◀ advisory BEFORE the edit (se-optimizer)
   │        given a target direction in ℝ⁶ metric space, rank the firing operator
   │        rules by Δm·t̂; return finding + Δm + a dry-run verdict. Never auto-applies.
   ▼
④ apply     graph_mutate → mutate()                        → the one Apply-Gate
   │
   ▼
   verdict  R-18 structural · R-19/R-20 binding → tier      → the advisory does NOT vote here
   │
   ▼
⑤ measure   fitAdvisory on the result   ◀ advisory AFTER the edit (se-optimizer)
   │        Δm(before→after) on layer:arch + the named regressions (Δ < 0)
   ▼
⑥ report    tier + violations + fitAdvisory
```

The rule that holds over the whole chain: **the metric ranks (③⑤), the gate judges (④).** The
advisory is a *measurement*, never a veto — the only thing that blocks an edit is a rule.

## A worked example

Intent: *"make the auth module more scalable."*

| Step | What happens |
|------|--------------|
| ① read   | `graph_impact(MOD-auth)` — one FUNC feeds four FLOWs, one SCHEMA is shared centrally |
| ② status | `rules_evaluate` — R-16 warns: MOD-auth has too high a fan-in |
| ③ suggest| `graph_suggest({scalability:1})` — top move: split the FLOW, `score = +0.31`, dry-run tier `suggest` |
| ④ apply  | `graph_mutate(splitFlow …)` — rules clean → tier `auto-apply`, persisted |
| ⑤ measure| `fitAdvisory`: `scalability +0.12`, but `regressions: ['coherence']` (−0.04) |
| ⑥ report | "Applied. Scalability ↑, coherence slightly ↓ — intended?" |

The human (or agent) sees the *price* of the change in ⑤ — without the advisory ever having blocked it.

## Self-correction: what blocks, what is carried as debt

The gate is a **judge, not a repairer**, and it works on deltas — it only rules on violations *this*
mutation introduces. Two behaviors, split by severity:

- **Add a REQ, forget the test → blocked.** A new REQ with no `verify` trace fires **R-01 (error)**.
  A new error → tier `block`, rollback, nothing persisted. The result carries the fix hint ("link a
  TEST via verify trace") and the candidate TESTs. Nothing is written for you, but nothing lands
  silently either — the legal move is one *batch* mutate with REQ + TEST + verify, atomic.

- **Leave a binding open → carried as debt.** A TEST without `testRef` (**R-19**) or a FUNC without
  `codeRef` (**R-20**) is a *warning*. The edit lands with tier `suggest`; the open binding stays
  visible in `rules_evaluate` / `graph_readiness` and depresses the readiness score until resolved.
  The missing test stub itself is materialized at `graph_export` as an `it.todo` — the file appears,
  the assertion is yours to write.

Discovery is automatic — `graph_next_step` surfaces the next open item every turn, so nothing has to
be asked for. Repair is not: the graph tells you what is missing; it does not fill it in.

## What is planned

- **Hardness level 2 (roadmap step 5).** Today ③ ranks a *single* operator edit. The A\*/Beam
  extension searches an edit *sequence* that reaches the target and compensates the regression from
  ⑤ — in the example, the split *plus* a coherence bridge, so `coherence` does not fall. The advisory
  moves from *measuring* to *planning*. It still never blocks and still never auto-applies; it needs
  the merge fixture first.

- **The F2 learning loop (gated, 2026-Q4).** Today the `target` in ③ is set by hand. The
  learning engine — held behind the F2 go/no-go until there is proof of effect on ≥6 weeks of
  operating data — mines the accumulated Δm deltas and accept/reject decisions into candidate rules
  (UC-8 rule discovery). That closes the chain: measured deltas → learned rules and targets → better
  proposals. Activation stays manual: a mined rule is a versioned decision, not a silent switch.

The live chain today is ①②→③→④→⑤→⑥. Step 5 turns ③ into sequence planning; F2 makes the target
self-learning — both deliberately locked until measured.
