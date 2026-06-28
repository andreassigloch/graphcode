---
name: se-view:testconcept
version: 1
description: Show test concept structure and coverage status
---

Render the test concept from the live graph — the graph is the SSOT (not a hand-maintained doc); graphcode has no view endpoint, the agent renders it. Fetch over MCP:

1. `graph_elements` `{ "type": "TEST" }` — every test node; read `attributes.level` (unit / integration / e2e) and `attributes.tool`.
2. `graph_get_edges` `{ "edgeType": "verify" }` — TEST→REQ coverage.
3. `graph_elements` `{ "type": "MS" }` and `graph_get_edges` `{ "edgeType": "compose" }` — milestones and the REQ/FUNC/UC each one includes (the VCRM per milestone).
4. `rules_get_violations` — surface coverage gaps (R-01 / R-05).

Present a structured summary:

## 1. Testpyramide
Distribution of TEST nodes by `attributes.level` (unit / integration / e2e) with current counts.

## 2. VCRM — Tests pro Meilenstein
For each `MS`: the REQs it `compose`s and which of them have a verifying TEST (from step 2). A milestone is green when every included REQ is verified.

## 3. Abdeckung
Coverage roll-up: REQ → verifying TEST(s); flag REQs with no `verify` edge (R-01 gaps) and TESTs that verify nothing.

## 4. Lücken
Open coverage gaps from `rules_get_violations` (R-01 unverified REQ, R-05 TEST not verifying a REQ).

Source every number from the graph queries above — do not read a hand-maintained doc, and do not invent counts.
