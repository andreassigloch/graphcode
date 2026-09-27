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

**UC sequencing goes through a shared FUNC — no new edge.** "UC-B needs what UC-A produced" is the entry of B's chain, and the metamodel already expresses it: put the shared step in a FUNC (it satisfies its own `functional` REQ), compose that FUNC into every chain that depends on it, and let its output FLOW be the entry FLOW of the dependent chain.
```
+ FUNC-<shared step> -satisfy-> REQ-<shared step>
+ FCHAIN-<uc a> -compose-> FUNC-<shared step>
+ FCHAIN-<uc b> -compose-> FUNC-<shared step>
+ FUNC-<shared step> -io-> FLOW-<handover>
```
The dependency is then verifiable (the REQ carries a TEST, every chain member its own REQ) instead of being an opaque UC→UC arrow. Do not reach for `depends` to order use cases.

**Author in batches of 4–5, cross-cutting elements first.** Cut batches by deployment site × actor × functional coupling, max 4–5 UCs per batch — one chat context, so the whole batch stays reviewable. Per batch: propose → review → mutate → check violations. Settle the shared elements (shared FUNCs, their REQs) in the FIRST batch; discovering them in batch three means rewriting batches one and two.

## Write the guard conditions into the chain — not as prose in the UC
What must be true **before** the scenario can start is the **entry FLOW** of the UC's chain — what crosses into its first function. What holds **after** it finished is the **UC goal** — the Outcome of the UC sentence. The chain is covered (R-21) when **every member FUNC satisfies its own `functional` REQ**, each verified by a TEST (`se:author-req`, R-01). The FCHAIN itself carries only `non-functional` REQs — an end-to-end quality such as a time budget — and only when the scenario has one.
```
+ UC-<name> -compose-> FCHAIN-<name>
+ FCHAIN-<name> -compose-> FUNC-<first step>, FUNC-<last step>
+ FLOW-<entry> -io-> FUNC-<first step>
+ FUNC-<first step> -satisfy-> REQ-<first step behaviour>
+ FUNC-<last step> -satisfy-> REQ-<last step behaviour>
+ FCHAIN-<name> -satisfy-> REQ-<end-to-end budget>
```
A guard that only lives in the description cannot be tested and is invisible to every view. This used to be a pair of info findings at every UC; since they fired everywhere and nobody acted on them, the check now lives here, in the writing.
