---
name: se-view:rtm
description: Requirements Traceability Matrix — REQ to TEST and REQ to FUNC/MOD, with coverage gaps
---

Render the Requirements Traceability Matrix (RTM) from the live governed graph — graphcode has no view endpoint, the agent is the renderer (KNOW-via-query). The RTM is the bidirectional REQ trace: upward to the verifying `TEST`, downward to the satisfying `FUNC`/`MOD`. In the live ontology `satisfy` runs **FUNC → REQ** and `verify` runs **TEST → REQ**; allocation to a module is `FUNC → MOD` via `allocate`. Fetch over MCP:

1. `graph_elements` `{ "type": "REQ" }` — every requirement (the matrix rows).
2. `graph_get_edges` `{ "edgeType": "verify" }` — TEST→REQ coverage (the verification column).
3. `graph_get_edges` `{ "edgeType": "satisfy" }` — FUNC→REQ satisfaction (which function realizes the REQ).
4. `graph_get_edges` `{ "edgeType": "allocate" }` — FUNC→MOD allocation, to roll the REQ down to the implementing module.
5. `rules_get_violations` `{ "severity": "error" }` — **R-01** (REQ without `verify`) is the canonical coverage-gap; also surface R-02 (FUNC not satisfying any REQ) and R-05 (TEST verifying nothing) from the unfiltered violations.

Present a structured summary:

## 1. Traceability-Matrix
One row per REQ: `REQ | satisfying FUNC(s) | allocated MOD(s) | verifying TEST(s) | Status`. Status is **traced** when the REQ has at least one `satisfy` AND one `verify` edge, **partial** when only one side is present, **orphan** when neither. Resolve the FUNC→MOD column by chaining each satisfying FUNC through its `allocate` edge (step 4).

## 2. Lücken
- **Downward gaps:** REQs with no `satisfy` edge — no function claims them.
- **Upward gaps:** REQs with no `verify` edge — the R-01 violations from step 5.
- **Dangling tests:** TESTs that verify no REQ (R-05).

## 3. Abdeckung
Coverage roll-up: `verified REQ / total REQ` and `satisfied REQ / total REQ` as percentages. List the REQs to close first — start with the R-01 errors.

## 4. Traceability-Graph
A Mermaid `graph LR` of `TEST --> REQ` (verify), `FUNC --> REQ` (satisfy), and `FUNC --> MOD` (allocate) for a representative slice. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use uids or plain names.

Source every cell from the graph queries above — do not read a hand-maintained traceability spreadsheet.
