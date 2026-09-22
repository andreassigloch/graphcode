---
name: se-plan
version: 4
description: Generate the implementation/integration plan — derive the CR build order from the graph's depends-on DAG, cut CRs (≤5 files) whose content is the graph_context slice (not written scope), enforce an io-integration test + submodule build per CR, and write MS/CR/relation through the gate
---

**Generative** plan skill (NOT a view). `se-view:implplan` *renders* an existing plan; `se-plan` *creates* one: it derives the build order from the model's dependencies and writes the milestone/CR structure into the graph through the gate. No prose-only plan, no parallel renderer.

## 1. Read the decomposition — **REQ leads**
- `graph_elements` `{ "type": "REQ" }` FIRST — the **leaf REQ** (no `compose`→REQ child) are the population the plan must cover. Then `"FUNC"` / `"UC"` / `"TEST"` for the slices.
- The ontology knows **four** carriers for a REQ: RD-01 accepts `satisfy` from FUNC, FCHAIN, MOD and SYS. Deriving from FUNC leaves alone sees a quarter of the work — measured on the sigllm run: 64 leaf REQ, carried by FUNC 32, MOD 20, FCHAIN 7, SYS 5.
- `graph_get_edges` `{ "edgeType": "relation" }` — the `depends-on` dependencies (a `relation` edge with `label: "depends-on"`, e.g. MS→MS), plus `compose` for the decomposition tree.

## 2. Derive the order (topological, not numeric)
Build the DAG from the `depends-on` edges (`source depends-on target` ⇒ target is the prerequisite ⇒ target precedes source) and **topologically sort** it. The order follows dependencies, never CR-id order.
- **Forward dependency** (a lower-numbered item depends on a higher-numbered one) → **report it** — the id numbering disagrees with the real order. Do not bury it.
- **Cycle** → **report it and stop** — a cyclic dependency is unorderable; it must be broken before any plan is valid. Never emit a silent, arbitrary order for a cycle.
(The ordering follows the same topological rule the `deriveImplPlan` core / `TEST-se-plan-ordering` pin — keep them consistent.)

## 3. Cut the CRs — **one per leaf REQ, cut at its carrier**
The unit of COMPLETENESS is the **REQ**; the unit of the SLICE stays the **carrier** (the `graph_context` pack of the FUNC/FCHAIN/MOD/SYS that `satisfy`s it). Propose a CR slicing where **each CR is ≤5 files and implementable in one chat** (the hard family rule). Group the CRs into `MS` milestones in dependency order.

**A CR for a REQ whose carrier is a MOD or a SYS carries its `relation` DIRECTLY on the REQ**, not only on the module. This is the convention CR-SM-343 checks: a module is a container, and a CR touching it says nothing about the requirement hanging off it. Deviate and the coverage figure becomes two truths.

Each CR's deliverables **fall out of its subgraph** — do not write them by hand:
- the FUNC + the REQ it `satisfy`s + the FUNC's unit `verify`-TEST
- **one integration-TEST per touched `io` interface** (both FLOW sides) — mandatory, not a follow-up. This is what stops *unit-green-but-unwired*: a contract two FUNCs exchange is proven at the boundary, not only per function.
- the edge-bound NFR of the subgraph (`satisfy`/`allocate`), never a SYS-broadcast
- **a pinned dependency version as an explicit prerequisite** when the CR needs a shared package: name the published version it requires. A locally linked working copy (`npm link`) can false-green a CR against a dist nobody else has.

## 4. Write the plan through the gate
Apply the plan via `graph_mutate` (Apply-Gate, L2) — every write is gated:
- `add-node` for each new `MS` and `CR`,
- `add-edge` `relation` `CR → MS` (CR assigned to its milestone),
- `add-edge` `relation` with `attributes.label = "depends-on"` for each `MS → MS` dependency.
Inspect the returned `violations`; the gate blocks the batch if it would introduce a new error (e.g. an illegal trace pair, R-18) — fix and re-apply. Never hand-edit the SSOT.

## 5. The CR is a derived context-pack, not written scope
A CR carries **no hand-written scope**. Its content is the `graph_context` slice of the node it realizes (the definition-of-done: FUNC + `satisfy`-REQ + `verify`-TEST + `io`-FLOW + `allocate`-MOD + SCHEMA) plus ~5 lines of prompt-prosa: *"realize this ONE node to `done`; context IS the slice; make the verify-TEST green on disk; then apply `status: done` through the gate."* The implementer cannot bypass the graph because the CR only points at it.

If assembling the context-pack surfaces a **spec gap** — an unstated REQ the FUNC needs but no node states (e.g. a merge conflict-resolution policy) — write the missing REQ through the gate FIRST; never let the implementer guess it. The gap is a missing node, not CR prose.

## 6. Output — close with the computed assurance, not a sentence
Emit the ordered sequence (milestones → their CRs), and explicitly list any forward dependencies and cycles found. The deliverable is MS/CR/relation nodes IN THE GRAPH plus the reported anomalies — not a CLAUDE.md prose list.

**Mandatory closing line:** *n of m leaf REQ have a build order; the uncovered are: …* — the figure `deriveImplPlan` returns as `reqCoverage` (computed in the core so a test pins it, not restated here). A **non-empty `uncovered` means the plan is NOT finished**, and that stands in the output.

Never report completeness over the set you chose yourself. The measured failure this rule exists for: a plan reported *"20 of 20 ordered, no cycles"* while 24 of 64 leaf REQ had no build order at all — and those 24 were exactly the ones mitigating all 16 open FM-03 risks.
