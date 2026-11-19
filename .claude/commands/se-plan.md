---
name: se-plan
version: 16
description: Generate the implementation/integration plan — order the build along the model's integration tree (leaves up), check the test concept is complete BEFORE cutting, cut CRs (≤10 files) whose content is the graph_context slice, enforce an io-integration test per CR, and write MS/CR/relation through the gate. Order and cut only; it asks nothing, writes no REQ or TEST and does not run the build
---

**Generative** plan skill (NOT a view). the view `docs/views/implplan.md` *renders* an existing plan; `se-plan` *creates* one: it derives the build order from the model's integration tree and writes the milestone/CR structure into the graph through the gate. No prose-only plan, no parallel renderer.

**The model gives the plan.** Milestones are the integration levels of the model, never themes you choose ("Gate-Kern", "Cockpit"). Measured failure (immo-infra, CR-GC-892): a first cut by themes put modules before their own leaf functions and left the system test per use case out; the user had to demand both.

## 0. Precondition — the review is empty
`se-cdr` must report an empty list for **every leaf function you cut**. Check the SCHEMA at the flows of each leaf function: a SCHEMA without `realRef` onto a Zod schema (R-26, RC-08) means **stop before the cut** and refer to `se-cdr`. A finding of stage 8 or lower at those functions stops the same way. Do not cut around the gap.

## 1. Read the decomposition — **REQ leads**
- `graph_elements` `{ "type": "REQ" }` FIRST — the **leaf REQ** (no `compose`→REQ child) are the population the plan must cover. Then `"FUNC"` / `"FCHAIN"` / `"MOD"` / `"SCHEMA"` / `"UC"` / `"TEST"`.
- The ontology knows **four** carriers for a REQ: RD-01 accepts `satisfy` from FUNC, FCHAIN, MOD and SYS. The REQ's kind picks the carrier: a `functional` REQ is carried by a FUNC, a `non-functional` one by a MOD, the SYS or an FCHAIN. Deriving from FUNC leaves alone sees a quarter of the work — measured on the sigllm run: 64 leaf REQ, carried by FUNC 32, MOD 20, FCHAIN 7, SYS 5.
- `compose` gives the integration tree (SYS → MOD, FCHAIN → FUNC, FUNC → FUNC), `io` the FUNC↔FUNC connections, `relation` with `label: "depends-on"` the existing order.

## 2. Read what `se-conops` decided
This skill asks nothing. Legacy system, target environment and the place of shared contracts are questions of `se-conops` (§1 there), and each answer stands as a REQ in the model. Read them: a REQ of a legacy system → last stage *Switch-over*; a REQ of the target environment → stage 0 *Environment*; a REQ for the place and pinned version of shared SCHEMA → a prerequisite named in every CR text. **No such REQ and the question was never asked:** stop and refer to `se-conops`; do not decide it yourself.

## 3. Check the test concept — BEFORE the cut
Render `graph_export({ views: ["testconcept"] })` and read every row. Each level needs its own test, or the plan builds something nothing proves:

| Level | Required in the model |
|---|---|
| SCHEMA | a contract TEST `verify`→SCHEMA |
| leaf FUNC | every satisfied REQ has a `verify`-TEST |
| FCHAIN | its **own run REQ** (`FCHAIN -satisfy-> REQ-kette-<x>-durchlauf`) + TEST: every flow arrives, every answer returns, every contract holds. FMEA risk REQs do **not** replace it |
| FUNC↔FUNC | both ends share a tested FCHAIN (the view's *Integration* row). When the chain text already names the missing member, add it via `compose`; if FC-06 forbids it, the R-21 finding stays open (no `acceptedFindings`; architecture rules are not acceptable) and you name the pair in the output as open work. It closes only by a model move or by code — the code that carries the handover or its test may be missing |
| MOD | a REQ + TEST at the module |
| SYS | every system REQ verified |
| UC | **system test per use case**: `REQ-systemtest-<uc>` composed by the UC, carried by SYS, under one parent `REQ-systemtest-je-anwendungsfall`; its TEST walks the UC step by step as a user with a real role account and test data without customer data |

**A missing test is a stop.** Name each missing row (level, element) and refer to `se:author-req`, which writes the REQ with its TEST in one batch; then render the view again. Only an all-✓ table lets you cut; a pair FC-06 forbids stays ✗ and is named as open work.

Gate facts for the author of the missing rows: `TEST -verify-> UC` is illegal (R-18) — the per-UC REQ is verified; the parent REQ needs a `verify` too (R-01).

## 4. Derive the order — the integration tree, leaves up
One milestone per integration level, a linear `depends-on` chain (`MS-n -relation-> MS-n-1 [label:depends-on]`):

0. **Environment** — mandatory as soon as the access list of `se-conops` has a line created by a *human*; otherwise only if `se-conops` recorded a target-environment REQ (§2). SYS REQ every test needs (network, hardening, deploy/rollback). Nothing that has children in the tree. It carries one CR **Provide access**: the user works the access list in one block, and a script calls the check call of every line (e.g. HTTP 200, a successful login) and reports green or red per line. **Stage 1 starts only when that script is all green.** An access found later is first written into the list, then obtained — never asked for ad hoc in the middle of a build.
1. **Leaf functions** — the plan begins here; the Zod schemas are part of the specification and stand already (§0). One CR per leaf FUNC (split by REQ if >10 files). Strip MOD and SYS REQ from these CRs.
2. **Chains** — one CR per FCHAIN (single-member chains may share one).
3. **Modules** — one CR per MOD with its MOD REQ; a parent MOD depends on its child MODs.
4. **System** — the SYS REQ, grouped ≤10 files by topic, plus the acceptance against the top requirements.
5. **System test** — the per-UC system tests from §3.
6. **Switch-over** — only if §2 found a legacy-system REQ.

Composite FUNCs without an own REQ get no step — chains integrate their children. **Check before writing:** no CR may sit on a level below the children of its carrier (a module CR before its leaf-function CRs is the measured error). Topo-sort the `depends-on` DAG: report a **forward dependency** (lower id depends on higher), stop on a **cycle**.

## 5. Cut the CRs — **one per leaf REQ, cut at its carrier**
The unit of COMPLETENESS is the **REQ**; the unit of the SLICE stays the **carrier** (the `graph_context` pack of the FUNC/FCHAIN/MOD/SYS that `satisfy`s it). Each CR is **≤10 files and implementable in one chat** (the hard family rule).

**A CR for a REQ whose carrier is a MOD or a SYS carries its `relation` DIRECTLY on the REQ**, not only on the module (CR-SM-343). **`CR -relation-> FCHAIN` is illegal (R-18):** a chain CR relates the chain's run REQ, its risk REQs and the UCs that compose the chain.

Each CR's deliverables **fall out of its subgraph** — do not write them by hand:
- the carrier + the REQ it `satisfy`s + their `verify`-TEST
- **one integration-TEST per touched `io` interface** (both FLOW sides) — mandatory, not a follow-up. This is what stops *unit-green-but-unwired*.
- the edge-bound NFR of the subgraph (`satisfy`/`allocate`), never a SYS-broadcast
- **a pinned dependency version as an explicit prerequisite** when the CR needs a shared package. A locally linked working copy (`npm link`) can false-green a CR against a dist nobody else has.

## 6. Write the plan — CR through the family path, edges through the gate
- **CR:** `aise item new --target <repo> --body "<text>" "Bau: <title>"`, then `aise dispatch prepare <ITEM> --lane code --wurzel <carrier uids>`. aise mints the number, writes the CR file and the CR node. Never `add-node` a CR by hand.
- **MS and edges** via `graph_mutate`: `+ MS-…`, `CR → MS` `relation`, `MS → MS` `relation [label:depends-on]`, the scope `relation`s. The CR node is open from `aise dispatch prepare` on (AF-05 reads it); `aise cr close` sets it done. You never write `status`.
  Pass `skill: "se-plan"` on every `graph_mutate` call of this skill, so the audit counts the move under this skill.
- Every aise call moves the `graphVersion` by one — re-read it before your batch, or the gate rejects the stale base.
- Inspect `violations`; the gate blocks a batch with a new error (R-18, R-01) — fix and re-apply. Never hand-edit the SSOT.

## 7. The CR is a derived context-pack, not written scope
A CR carries **no hand-written scope**. Its content is the `graph_context` slice of the node it realizes plus ~5 lines of prompt-prosa, the same for every CR: stage and repo; carriers and REQ; *context IS the slice*; done = every `verify`-TEST green on disk, bound by `testRefs`, and — if `se-conops` recorded a target-environment REQ — green on the target environment; before every test run `graph_tests({changeSet})`, run the tests it names, the full suite only before the CR closes; one integration test per touched flow; contracts only from the pinned package; the legacy system stays working.

If assembling the context-pack surfaces a **spec gap** — an unstated REQ the FUNC needs — **stop**. Name the function and the gap and go back to `se-cdr`; the answer is written by `se:author-req`, not here. Never let the implementer guess it.

## 8. Output — close with the computed assurance, not a sentence
Emit the ordered sequence (milestones → their CRs), **the groups per milestone** (`crGroups` in `src/loop/se-plan.ts`: open CRs without a `depends-on` path between them and without a shared `realRef` file — the same groups `docs/views/implplan.md` shows in its column *Gruppe*), the forward dependencies and cycles, the test-concept table from §3 (every row ✓ or named as open work), and the accepted gaps by name. Offer the integration tree as a picture (stages, model levels, CR per level). The deliverable is MS/CR/relation nodes IN THE GRAPH — not a prose list.

**Mandatory closing line:** *n of m leaf REQ have a build order; the uncovered are: …* — the figure `deriveImplPlan` returns as `reqCoverage`. Count it over **open** CRs: the core also counts the `relation`s of done spec CRs, and a closed spec CR is no build order. A **non-empty `uncovered` means the plan is NOT finished**, and that stands in the output.

Never report completeness over the set you chose yourself. The measured failure this rule exists for: a plan reported *"20 of 20 ordered, no cycles"* while 24 of 64 leaf REQ had no build order at all — and those 24 were exactly the ones mitigating all 16 open FM-03 risks.

## 9. No stamp — the plan is the open orders
The plan sets **no** stamp on the SYS root. Its result is what step 6 wrote: the CRs — each with `status: "open"` — and the milestones. **AF-05** (the entry rule of this analysis: there is unbuilt work but no open order) is closed by the first open CR, and it comes back whenever something unbuilt has no open order left — after the last CR is done and a new function was added, the plan is due again. A plan with no CR in the graph has not happened: leave AF-05 open instead of writing a prose list. With an open CR the binding rules (R-19, R-20, R-26) become due; their findings are the work list of the build.

## 10. The build is not here
Starting agents per group, merging and rolling out belong to `se-bau` (role Coordinator). This skill ends with the CRs and the groups it hands over.
