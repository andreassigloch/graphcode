---
name: se-trade
version: 1
description: Trade Study (CREATE) — evaluate ≥2 options for a Spike/Concept, record the decision in a CR with relation(decides / superseded-by) edges (SP-1 pattern, no new element type)
---

**Trade Study** is the judgment skill for an open design decision (a Spike or Concept with more than one viable option). It does **not** add a new element type — the decision is recorded with the existing `relation` trace (the SP-1 pattern): the chosen option `decides` the question, the rejected ones are `superseded-by` it.

## 1. Frame the decision
State the question and the **≥2 options** (a one-option "trade" is not a trade — ask for the alternatives). For each option: what it is, its cost/benefit, and the risk it carries. Anchor each option in the graph where it already exists: `graph_get_node` / `graph_elements` for the FUNC/MOD/REQ the option would realize.

## 2. Decide on stated criteria
Score the options against explicit criteria (effort, risk, reversibility, fit to the locked constraints). Name the **winner** and the reason — a trade with no decision is just a list.

## 3. Record the decision through the gate
Open a CR capturing the question, options, criteria, and choice. Apply the decision to the graph via `graph_mutate` (Apply-Gate, L2) using only `relation` edges — no new ElementType/TraceType:
- a `relation` edge from the chosen element/CR to the question it `decides` (put `decides` in `attributes.role`),
- a `relation` edge from each rejected option to the winner marked `superseded-by` (in `attributes.role`).

Check the returned `violations` and re-apply if the gate blocks the batch. Never hand-edit the SSOT. The output is a CR plus the decision recorded as graph relations — a Spike that converges to one realizable option.
