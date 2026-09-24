---
name: se:author-uc
version: 1
description: Author a UC node terse and low-jargon — Actor–Verb–Object–Outcome, ≤25 words, ≤2 grounded technical terms — and gate-mutate it with its compose trace
---

<!-- inject:start -->
A use case is the ConOps entry point: the **plainest** statement of who does what and to what end. Author it terse and almost jargon-free — the opposite of a 60–90-word, term-dense paragraph. `se-view:conops` *renders* UCs; this skill *creates* one with the style enforced (no parallel path).

## The style rule (self-check before you write)
- **Terse:** the `description` is **≤25 words**, active voice, **Actor–Verb–Object–Outcome**. No implementation detail (no module names, no data shapes, no "via X").
- **Jargon budget: ≤2 technical terms.** Every term you spend MUST already exist as a `SCHEMA` or `REQ` node. A term with no node is undefined — rephrase in plain words instead. Define a term once; do not repeat it.
- If you cannot say it in ≤25 words with ≤2 grounded terms, the use case is doing too much — split it.

## Write it through the gate
Emit ONE `graph_mutate` batch as Format-E — the UC with its `compose` to the `FCHAIN` or `FUNC`(s) that realize it; `__name` is a short scenario label:

```
## Nodes
### UC
+ UC-<slug>|<Actor–Verb–Object–Outcome, ≤25 words> [__name:<short scenario label>]

## Edges
+ <SYS> -compose-> UC-<slug>
+ UC-<slug> -compose-> FCHAIN-<slug>
```

A UC with no `compose` to a `FCHAIN` raises **`UC-03`** ("no FCHAIN scenario", warning), and **`FC-02`** on top of it while the UC is a leaf. Both are warnings, so the batch still applies; what BLOCKS is `UC-01` (no `compose` to a REQ) and `UC-02` (no ACTOR path).
<!-- inject:end -->

To check the jargon budget, query `graph_elements {type:"SCHEMA"}` / `{type:"REQ"}` for the terms you intend to use.

(The style rule is also an executable linter, `src/projections/se-author-uc.ts` / `TEST-uc-authoring-style` — style is a **warning**, not a gate error, so a slightly-long UC is flagged, never blocked.)

Inspect the returned `violations`; never hand-edit the SSOT. To author the requirements the UC composes, use `se:author-req`.

## Two conventions for a coherent UC set
Modelling knowledge, not tool operation — both come from the retired `se:requirements` skill (CR-GC-345) and exist nowhere else.

**UC sequencing goes through a shared FUNC + its REQ — no new edge.** "UC.002 needs a finished contact from UC.001" is a *precondition*, and the metamodel already expresses it: put the precondition in a FUNC, let that FUNC satisfy its own REQ, and compose the FUNC into every UC's chain that depends on it.
```
CheckContactExists.FN.006 -satisfy-> ContactExists.RQ.010
CaptureInterestMain.FC.002 -compose-> CheckContactExists.FN.006
```
The dependency is then verifiable (the REQ carries a TEST) instead of being an opaque UC→UC arrow. Do not reach for `depends` to order use cases.

**Author in batches of 4–5, cross-cutting elements first.** Cut batches by deployment site × actor × functional coupling, max 4–5 UCs per batch — one chat context, so the whole batch stays reviewable. Per batch: propose → review → mutate → check violations. Settle the shared elements (shared FUNCs, their REQs) in the FIRST batch; discovering them in batch three means rewriting batches one and two.

## Write the guard conditions as requirements — not as prose in the UC
What must be true **before** the scenario can start (precondition) and what holds **after** it finished (postcondition) belongs in the requirements the UC composes, never in the UC text: `add-node` a `REQ` with `kinds: ["precondition"]` or `kinds: ["postcondition"]`, `compose` it from the UC, and give it its verifying `TEST` in the same batch (`se:author-req`). A guard that only lives in the description cannot be tested and is invisible to every view. This used to be a pair of info findings at every UC; since they fired everywhere and nobody acted on them, the check now lives here, in the writing.
