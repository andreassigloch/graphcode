# Help content — the 20 rules, three layers each

**Status:** Draft (2026-06-28) · **Branch:** `help` · companion to [help-system.md](help-system.md) §8.

The **authored** half of the rule help (the Plain action + the SE mapping). Everything else per rule — id,
name, severity, message — is **derived** from `V3_RULES` (`@sigloch/contracts/se`) and not restated here.
Sources: `contracts/src/se/rules.ts` (definitions), `readiness.ts` (gate ownership).

**Tokens** (`REQ`, `FUNC`, `verify`, `satisfy`, `compose`, `io`, …) resolve in the **Vocabulary**,
[help-system.md](help-system.md) §3. **Plain** = for a reader who has never done systems engineering: every
Plain cell states the problem in everyday words and ends with the one action. **In SE terms** = the standard
SE concept, for an engineer who doesn't know our naming.

## Phase-gate rules (owned by the four INCOSE design reviews)

### SRR — System Requirements Review

| Rule | Sev | Plain (what + action) | In SE terms |
|---|---|---|---|
| **R-01** REQ must have verification | error | A feature you've promised has no test proving it's met, so you can't show it works → add or author a test for it (`se:close-violations` / `se:author-req`). | `REQ` with no incoming `verify` trace (test→requirement coverage, INCOSE V&V). |
| **R-14** UC must have compose | warning | A thing a user wants to do is empty — nothing says how it actually happens → add the steps or the feature under it. | `UC` with no `compose` to an `FCHAIN` or `REQ`. |
| **R-17** SYS must have compose | warning | The top level of your project is empty — nothing is inside it → add the main use cases, features, or modules. | `SYS` with no `compose` to `UC` / `REQ` / `MOD`. |

### PDR — Preliminary Design Review

| Rule | Sev | Plain (what + action) | In SE terms |
|---|---|---|---|
| **R-02** FUNC must satisfy REQ | warning | A function isn't linked to any feature it's meant to build, so it may be dead code → link it to the feature it serves, or delete it. | `FUNC` with no `satisfy` trace to a `REQ` (design→requirement traceability). |
| **R-10** FLOW completeness | warning | A piece of data goes nowhere — nothing produces or consumes it → connect it to a function or a person/outside system. | `FLOW` with no `io` trace to a `FUNC` or `ACTOR`. |
| **R-15** FCHAIN must have compose | warning | A sequence of steps for a use case is empty → add the functions that make it up. | `FCHAIN` with no `compose` to any `FUNC`. |
| **R-16** ACTOR must have io | warning | A person or outside system isn't connected to anything → connect it to the data it sends or receives. | `ACTOR` with no `io` trace to a `FLOW`. |

### CDR — Critical Design Review

| Rule | Sev | Plain (what + action) | In SE terms |
|---|---|---|---|
| **R-03** ASIL isolation | error | Safety-critical and ordinary features share one module — a fault could leak across → split them into separate modules. | `MOD` mixes ASIL-D and ASIL-QM allocations (ASIL = automotive safety integrity level; ISO 26262 freedom-from-interference). |
| **R-04** Max module size | warning | A module does too much or is too tangled → open it (`se-view:arch`) and split it. | `MOD` with >12 `FUNC`, or 8–12 `FUNC` with >2 flows crossing the module boundary (cohesion/coupling). |
| **R-12** No circular dependencies | warning | Two items depend on each other in a loop, so neither can stand alone → remove or redirect one of the two links. | Direct cycle: A→B and B→A via the same trace type. |
| **R-18** Valid trace pattern | error | You connected two items in a combination that isn't allowed (e.g. linking two kinds of item the model never allows to be linked) → use an allowed link, or fix what's at each end. | Trace whose (source-type, target-type) pair isn't an allowed combination in the metamodel of legal links. |
| **R-20** FUNC code binding | warning | A function is supposed to be built but doesn't point to its code → add the link to its code; or, if it isn't built yet or comes from an outside library, mark it that way. | Realized `FUNC` with no valid `codeRef` `{file, symbol}` (graph↔code binding); else set `concept:true` (not built yet) / `external:true`. |
| **RD-01** Unresolved requirement | warning | A smallest-piece feature has nothing built to fulfil it → add what implements it (`se:close-violations`). | Leaf `REQ` (no `compose`→`REQ` children) with no `satisfy` from a `FUNC`/`FCHAIN`/`MOD`/`SYS`. |
| **RD-02** Decomposition consistency | warning | You split a feature into smaller features but you're also building the big one directly → build only the small pieces, not both. | Parent `REQ` (has `compose`→`REQ` children) carrying a direct `FUNC` `satisfy`; the satisfy belongs on the children. |
| **RD-03** No premature decomposition | info | You split a feature into pieces, but all the pieces are handled by the same one thing — the split may be pointless → consider merging them. | Parent `REQ` whose children all share one satisfier. |

### TRR — Test Readiness Review

| Rule | Sev | Plain (what + action) | In SE terms |
|---|---|---|---|
| **R-05** TEST must verify REQ | warning | A test doesn't check any feature you promised → link it to the feature it tests, or remove it. | `TEST` with no `verify` trace (test→requirement coverage) to a `REQ`. |
| **R-08** Trace consistency | error | A link points at something that no longer exists → repair or remove the broken link. | Trace whose source or target element is missing (dangling reference). |
| **R-19** Runnable TEST binding | warning | A test that's meant to run (not a not-yet-written stub) doesn't point to a test file → add the link to the test file, or, if it isn't written yet, mark it not-yet-written. | Realized `TEST` with no valid `testRef` `{file, case?, tool}`; else set `concept:true` (a stub). |

## Milestone rules (surfaced by the implementation gates)

| Rule | Sev | Plain (what + action) | In SE terms |
|---|---|---|---|
| **MS-01** Milestone empty scope | warning | A milestone has no work assigned to it → assign the work items that belong to it. | `MS` with no `CR` `relation`. |
| **MS-02** Milestone dangling dependency | error | A milestone waits on another milestone that doesn't exist → fix or remove the dependency. | `MS` `depends-on` relation targeting a missing `MS`. |

## Coverage check

20 rules: R-01, R-02, R-03, R-04, R-05, R-08, R-10, R-12, R-14, R-15, R-16, R-17, R-18, R-19, R-20,
RD-01, RD-02, RD-03, MS-01, MS-02. Matches the `V3_RULES` registry (R-06/07/09/11/13 are retired).
If `V3_RULES` gains a rule, this table needs one new Plain/SE pair — the derived fields fill themselves.
