---
name: se:top-level
version: 1
description: Cut the top level — SYS blackbox, use cases, architecture targets, then the triad (FUNC / FCHAIN + contracts / MOD + stack) at max 5 blocks per level, recursing by blackbox decomposition until a FUNC carries a realRef
---

The top level is the base everything else rests on, and it does not fall out of rules. `se:close-violations` makes R-22 green by proposing *some* allocation; this skill decides whether the cut is *right*. Judgment work — run it deliberately, not as a cleanup pass.

## The doctrine: a level is a triad, not a stage

Every level of abstraction carries all three at once:

- **FUNC** — the blackboxes. What the thing does, not how.
- **FCHAIN** — the effect chain. The causal path through those blackboxes.
- **MOD + stack** — what implements them, and with which technology.

`SYS` is that same triad at maximum abstraction (one function, one deployment, one value path); an implemented `FUNC` with a `realRef` is the same triad at minimum. **You are done when the blackbox thinking has been held from the SYS node all the way down to the implemented function** — not when the rules are green.

### The shapes: three trees and one lattice

- `MOD -compose-> MOD` — **tree.** One module, one parent. `FUNC -allocate-> MOD` is already capped at `0..1` for the same reason: ownership is not shareable.
- `SYS -compose-> UC -compose-> FCHAIN` — **tree.**
- `FUNC -compose-> FUNC` — **tree.** This is what makes "the roots of the forest" well defined, and what gives the rollup an unambiguous target.
- `FCHAIN -compose-> FUNC` — **lattice.** Chains meet and join at shared functions. A FUNC in four chains is not a defect, it is the meet point.

The trees give every node one place to roll up to; the lattice is what gets rolled up *through*. **Nothing enforces the tree property today** — the cardinalities cap children, not parents, so a second compose parent silently turns a tree into a DAG and makes every rollup ambiguous. Check it before you trust a projection.

### Two recursion carriers — and only one of them makes a new chain

**`SYS` carries the coarse recursion.** A subsystem (`SYS -compose-> SYS`) has its **own** use cases (`SYS -compose-> UC`, cardinality `1..*`), its own chains, its own modules. A new SYS is a new **boundary**, so it brings a whole triad with it.

**`FUNC` carries the fine recursion.** Decomposing a blackbox (`FUNC -compose-> FUNC`) **refines the membership of the existing chain**. `FCHAIN -compose-> FUNC` knows no depth — a chain takes members at whatever granularity currently exists. The coarse view is a rollup of the fine one; `gve` renders it, you do not model it.

**The invariant: a new FCHAIN comes with a new SYS boundary, never from a FUNC decomposition.** Author a second chain for a decomposed function and you have modelled the same causal path twice.

### Sub use cases: is there a second effect chain?

**Every UC needs its own FCHAIN, at every level — no exemption.** R-30 lets a decomposed FUNC drop out of its chain because a blackbox is realized by its children. A UC is not a blackbox, it is a **verifiable claim**, and its verification runs through its chain. A UC without a chain cannot be checked, so a decomposed UC keeps its own.

> **The test: does the child bring its own, sufficiently disjoint effect chain?**

- **No → it is not a use case.** Variants that all travel the same pipeline are a **field in the contract**, not new UCs. An edit pipeline that pushes one edit order through checker, viewer and database is *one* use case whose SCHEMA carries 19 option values — never 19 use cases. Nineteen chains that are one chain is over-documentation: it buys nothing and makes the top level unreadable.
- **Yes → it is a use case,** and `UC -compose-> UC` does not exist yet. It was never removed (no `ENTFAELLT` note in `TRACE_PATTERNS`), so it is a gap, not a reversal. Until it lands, do **not** fake the parent link through naming or a shared chain — leave the variants as sibling UCs and record the intended parent in the CR, so the flat top level stays visibly wrong instead of quietly wrong.

**The shape when it is justified:** the parent's chain is the shared trunk, and each child's chain extends it by at least one distinguishing function. A child that adds no function of its own is not a use case.

**Disjointness holds at every level.** The chains are a lattice, so *overlap* is expected — a shared FUNC is the meet point. What is forbidden is *identity*: two sibling UCs whose chains have the same members describe the same behaviour twice. Compare the member sets yourself — **no rule does it for you.** AO-D03 (`DuplicatePathDetection`) is the nearest guard and it is dead: it looks for `FUNC -io-> FUNC`, a pair the grammar does not allow, so it has never fired on any family graph (CR-DRAFT-GC-448 §5.3).

## Order

**0 · SYS as a blackbox.** The system node, its ACTORs, and what crosses the boundary. Name the crossings here; do not discover them in phase 3. A SYS with no `compose` raises R-17.

**Operations belongs to the boundary.** Run `se-conops` here, *before* the use cases: configuration, credentials, user management and deployment become system-scoped non-functional REQs at this point. Their *functions* arrive much later (check 7) — but the constraints have to exist before anything is cut against them.

The top triad is anchored at the SYS node, but only two legs are edges: `SYS -compose-> UC` and `SYS -compose-> MOD`. **The top FUNC set is a projection**, not an edge — it is the roots of the `FUNC -compose-> FUNC` forest (every FUNC without a compose parent). That is deliberate and follows the family's own precedent: CR-SM-266 D2 deleted `MOD -io-> MOD` because a derivable relation asserted as an edge can drift from the truth, and a computed one cannot. Same rollup principle as the chains — read it, do not assert it.

**1 · UC + REQ.** What the system does for whom → `se:author-uc`, then `se:author-req` (REQ-with-test invariant). Requirements are what the FUNCs will have to satisfy — they precede the functions.

**2 · Architecture targets.** → `se:target-profile`, **before any cut.** Without declared weights, every `fitAdvisory` on a mutation reports *movement* (`regressions: [...]`) but not whether that movement is damage — you never said what you wanted. Targets turn the advisory from a reading into a verdict.

**3 · The triad, level 1.** Strictly in this inner order:

1. **FUNC** — which blackboxes explain the use cases?
2. **FCHAIN** — the causal path per UC (`UC -compose-> FCHAIN -compose-> FUNC`).
3. **FLOW + SCHEMA** — the contracts, and **consolidate them**. `ACTOR -io-> FLOW -io-> FUNC`, `FUNC -io-> FLOW -io-> FUNC`; every FLOW carries exactly one SCHEMA (`FLOW -relation-> SCHEMA`, cardinality 1). One shared contract across many flows is a feature, not duplication.
4. **MOD + stack** — only now, and **max 5 per level**.

Step 4 after step 3 is empirical, not stylistic: CR-GC-436 tried allocation over unconsolidated edges and was a No-Go — optimizing a cut over unconsolidated contracts optimizes the wrong thing (CR-DRAFT-GC-448 §1).

**4 · Recurse — pick the carrier.** Decomposing a *function* stays inside this system: same UCs, same chains, refined membership. Splitting off a *subsystem* opens a new boundary: its own UCs, its own chains, its own modules — run phases 0–3 again for it. Either way, stop when a FUNC carries a `realRef`.

## The decomposition operation

Decomposing a function is one move, and getting it wrong is detectable:

> **The children replace the parent in the chain.** Add `FUNC -compose-> FUNC` for each child, move the parent's chain membership to its children (`FCHAIN -compose-> child`), and hand the parent's boundary flows to the **entry** and **exit** child.

- R-30 already exempts decomposed parents — a blackbox with children needs no chain of its own, because its children carry it.
- **IO-01 is the guard.** Leave the boundary flows on the parent and the chain splits into two components; IO-01 reports every member outside the largest one. Run it after every decomposition.

## Size: the answer to "too big" is a level, not more modules

Max 5 modules per level. When five modules each hold 14–26 FUNCs, every size threshold breaks (R-04, RD-04, MT-02) — the fix is a level *inside* the modules, never a sixth module (CR-DRAFT-GC-448 §3.4).

Coupling check after the cut: **CR-01** counts *distinct SCHEMA contracts per module pair* (threshold `crossingFlows.warning`, default 3) — not raw io edges. Two flows sharing one contract count once. Read the module rows from `graph_metrics`; it also returns the policy it judged against.

## The stack belongs in the model

A MOD without a stack is half a decision. The only legal place is `MOD -satisfy-> REQ` with a **structural** kind (`non-functional` / `risk` / `mitigation`) — a MOD cannot satisfy a behavioural REQ. Source the wording from `bok/docs/governance/STACKS.md`; do not restate it per repo.

## Check questions — run all seven before you call the level done

1. **Does every UC tell its story with the top-level FUNCs alone?** If you have to name a sub-function, the level is too coarse.
2. **Are the use cases disjoint?** Compare the FUNC member sets of the sibling chains. Identical sets mean you documented one behaviour twice; a child chain that adds no function of its own means the child is a contract field, not a use case.
3. **Does any block have two lives?** Not "is it in several chains" — the chains are a lattice, and a shared FUNC is the meet point, not a smell. The signals are: it satisfies REQs from **two different UCs**, it is fed by **two different actors**, and it runs on **two different cadences**. All three together mean two functions. Split it.
4. **Is every name active?** A block named for what it *holds* hides what it *decides*.
5. **Which stack implements this MOD**, and does it exist as a `satisfy`-bound REQ?
6. **Does the code already exist?** Check the repo before modelling greenfield. A `concept: true` FUNC over existing code is a claim the code will break (CR-DRAFT-GC-448 D2).
7. **More than five top-level FUNCs? Something is off.** Five is the working budget, not a hard cap — but every slot above it needs a stated reason, because **operations is still coming**: user management, configuration, credentials, deployment, logging. Those land as their own top-level block at the very end, and a decomposition that already spent seven slots on features has nowhere to put them. Count the compose-forest roots, not the chain members, and budget before you spend the last slot.

## Boundaries

`graph_authoring_guide {type}` for the legal edges before you write. Every batch through `graph_mutate` with `dryRun: true` first — read `fitAdvisory` against the targets from phase 2. This skill **creates** the cut; `se-view:arch` renders it, `se-plan` sequences it, `se:close-violations` cleans up after it. No parallel path.
