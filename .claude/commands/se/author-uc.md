---
name: se:author-uc
version: 1
description: Author a UC node terse and low-jargon — Actor–Verb–Object–Outcome, ≤25 words, ≤2 grounded technical terms — and gate-mutate it with its compose trace
---

A use case is the ConOps entry point: the **plainest** statement of who does what and to what end. Author it terse and almost jargon-free — the opposite of a 60–90-word, term-dense paragraph. `se-view:conops` *renders* UCs; this skill *creates* one with the style enforced (no parallel path).

## The style rule (self-check before you write)
- **Terse:** the `description` is **≤25 words**, active voice, **Actor–Verb–Object–Outcome**. No implementation detail (no module names, no data shapes, no "via X").
- **Jargon budget: ≤2 technical terms.** Every term you spend MUST already exist as a `SCHEMA` or `REQ` node (query `graph_elements {type:"SCHEMA"}` / `{type:"REQ"}`). A term with no node is undefined — rephrase in plain words instead. Define a term once; do not repeat it.
- If you cannot say it in ≤25 words with ≤2 grounded terms, the use case is doing too much — split it.

(The same rule is an executable linter, `src/se-author-uc.ts` / `TEST-uc-authoring-style` — style is a **warning**, not a gate error, so a slightly-long UC is flagged, never blocked.)

## Write it through the gate
Emit ONE `graph_mutate` batch:
1. `add-node` for the `UC` — the terse description above; `name` is a short scenario label.
2. `add-edge` `compose` from the `UC` to the `FCHAIN` or `FUNC`(s) that realize it (`{ "op":"add-edge", "edge":{ "sourceId":"UC-…", "targetId":"FCHAIN-…", "edgeType":"compose" } }`) — a UC with no `compose` raises R-14.

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
