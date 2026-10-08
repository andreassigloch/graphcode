---
name: se-test
version: 2
description: The general red-first rule — design any test so you have seen it fail for the right reason before you trust it green. Use before writing or reviewing a test, or when a CR is about to close on "tests green". The UI-specific method is se-test-ui.
---

# se-test — red-first, or it isn't coverage

## The rule

**Never trust a green test you haven't seen fail for the right reason.** Green only counts as
evidence once you have watched the same assertion go red for the exact failure it exists to catch.

1. **Name the failure mode first** — the concrete input → wrong output the test must catch. Write
   it down before the assertion; the assertion is derived from it.
2. **Assert at the highest rung that observes it** — check the real effect (persisted state,
   returned value, rendered pixel, emitted event), not the nearest proxy. Presence/existence is
   the weakest signal — necessary, never sufficient.
3. **Observe it red for that reason** — a bug-catching test must fail on the broken code; a
   regression guard must fail when you revert the fix. Green on the first run against broken code
   means the assertion is wrong. Fix the test, not your confidence.
4. **Bind it in the model** — a `TEST` node carries a resolvable `testRefs` entry (R-19).
   An unbound test lets `graph_readiness` report a REQ "verified" over nothing.
   Run `graph_tests` to see which TESTs actually resolve to a file.

## Acceptance: one play-through per use case (CR-GC-760)

The system is done when it starts and every use case can be played through by its actor or an actor
simulator — first with test data over simulated sources, then against the real ones. Model it with
what is there: the play-through is a `TEST` that verifies the requirements of its use case
(`TEST -verify-> REQ`, the requirements the use case composes). There is no edge from a test to a use
case; the chain is always architecture element – requirement – test. The **smoke test** is the run of
all play-throughs on one started system.

Where a test sits follows from the requirement it verifies, not from how it is written: a test of a
requirement directly under the system is system verification, whatever its technique. If a unit-style
test is all that verifies a system requirement, either the requirement belongs further down or the
play-through is still missing — say which.

## Anti-patterns this kills

- **Orphan-green** — a unit test that calls the exported function directly while nothing in `src/`
  imports it. The function works; the feature is unreachable. Assert the reachability chain
  (gesture → handler → state → effect), not the unit in isolation.
- **Proxy-green** — asserting a stand-in (a log line, a DOM node's existence) instead of the
  effect. Move the assertion up to the effect itself.
- **Vacuous-green** — a `TEST` node that points at no file, yet counted as
  verification. Materialize a real `testRefs` entry, even a failing `it.todo` stub, before the CR closes.

For views, renderers, and any pixel-bearing surface, use **se-test-ui** — it adds the assertion
ladder, the four silent styling seams, and the mockup-as-acceptance-criterion gate.
