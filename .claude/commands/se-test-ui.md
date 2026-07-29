---
name: se-test-ui
version: 1
description: Design UI tests that verify RENDERED INTENT (the mockup), not DOM presence. Use before writing or reviewing any test for a view/component/renderer, or when a UI CR is about to close. Encodes the anti-false-green rules from the 2026-07-08 blind-render retrospective.
---

# se-test-ui — test the pixel, not the presence

## The one rule

**The mockup is the acceptance criterion.** The design mockup (`docs/mockups/*`) is the SSOT of
visual intent. Never re-specify in prose what a template already shows — "a trace shall be
visible" is redundant when the mockup draws the lines. A view is done when it renders **equal to
its mockup**, bound as a golden-master, not asserted as "the element exists."

## Red-first — the rule that catches false-green

**Never trust a green test you haven't seen fail for the right reason.** Before a test counts:

1. **Name the failure mode first** — the concrete input → wrong output / blank pixel it must catch.
2. **Write the assertion at the highest rung** that observes that failure (ladder below).
3. **Observe it red for exactly that reason.** A bug-catching test must fail on the current
   (broken) code; a regression guard must fail when you revert the fix. If it is green on the
   first run against broken code, the assertion is wrong — fix the test, not your confidence.
4. Only then is green evidence.

This subsumes "no fake tests": a test that can't be seen failing isn't coverage, it's decoration.

## The assertion ladder (prefer higher)

1. **Painted pixels** — screenshot / canvas `ImageData`: is anything actually drawn, and does it
   match the mockup? Catches blind-render, invisible edges, unstyled canvas.
2. **Computed style** — `getComputedStyle()` / `.style('border-color')`: is the design token
   applied? Catches "gray default" and CSS-scope-mismatch seams.
3. **Rendered geometry** — bounding box: overlap, position, non-zero size.
4. **DOM presence** — element / testid exists. **Necessary, never sufficient.** A test that stops
   here is a false-green generator.

Every view CR needs at least one assertion at level 1 or 2.

## The four silent seams

Each fails **invisibly** — structure stays correct while styling detaches. Test each:

- **CSS-load seam** — is the stylesheet actually imported / `<link>`ed into the bundle
  (`import './x.css'` present), not just the file committed?
- **Selector-scope seam** — does the CSS selector match the rendered DOM (`body.x` vs `div.x`,
  BEM typos)? Assert a token-derived computed style, not just the class name.
- **Canvas-token seam (the recurring trap)** — a `<canvas>` / WebGL renderer (Cytoscape, PIXI,
  three.js) resolves **neither** your CSS **nor** `var(--token)`. Every token must be re-injected
  as a **literal** value; skip it and you get default gray shapes **no CSS can fix**. Assert: node
  `border-color` === the ontology type token, not `#999`.
- **Structural-chrome seam** — does **every** view render the **shared** chrome (filters, zoom,
  legend)? A view that bypasses the wrapper silently loses selectors its mockup requires. Assert
  the mockup's toolbar testids in every view, not just one.

## Reachability tier

Unit-testing a module proves the function; it does **not** prove the module is wired. Orphaned
modules — imported by nothing, reachable by no gesture — still go green. For every UI feature
assert the **reachability chain**:

> user gesture → handler → command/state → rendered effect

If no test drives the real gesture (a click/keypress in the browser, not a direct function call),
the feature is **not covered** no matter how many unit tests pass.

## Definition of done for a UI CR (hard gate)

- [ ] A screenshot of the view was **read** (by a human or a `toHaveScreenshot()` / paint
      baseline) — not just "tests green."
- [ ] The view's mockup testids / selectors are asserted present.
- [ ] At least one level-1 or level-2 assertion (pixel or computed-style), never presence-only.
- [ ] The reachability chain is driven by a real gesture, not a direct function call.
- [ ] Its graph `TEST` node is `concept:false` with a resolvable `testRef` — run `graph_tests`;
      an unbound TEST node means the requirement is **not** verified, whatever the RTM says.

## Binding the test node in the graph

Bind it immediately — a `TEST` must carry a real `testRef.file`, even a failing stub. A
`concept:true` TEST is an IOU, and `graph_readiness` will still report the REQ "verified" over an
empty promise. Never let a UI CR close against a concept-only test.
