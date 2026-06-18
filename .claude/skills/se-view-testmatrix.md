---
name: se-view:testmatrix
description: Show test coverage status from graph
---

Render the test-coverage matrix from a graph slice — graphcode has no view endpoint, the agent renders it (KNOW-via-query). In the live ontology `verify` runs **TEST → REQ** only; UC / FUNC / FCHAIN are covered indirectly through the REQs they `compose` / `satisfy`. Fetch over MCP:

1. `graph_elements` `{ "type": "REQ" }` — every requirement (the directly-verifiable unit).
2. `graph_get_edges` `{ "edgeType": "verify" }` — TEST→REQ coverage links.
3. `graph_elements` `{ "type": "UC" }` (and `"FUNC"` / `"FCHAIN"`) plus `graph_get_edges` `{ "edgeType": "satisfy" }` / `{ "edgeType": "compose" }` to roll coverage up to the behavioural elements.
4. `rules_get_violations` `{ "severity": "error" }` — R-01 (REQ without verify) is the canonical coverage-gap signal.

Format as a readable summary:

- Each REQ with its verification status — verified (has a `verify` edge) or unverified (R-01 gap).
- Each testable element (UC / FUNC / FCHAIN) marked covered when every REQ it leads to is verified.
- Highlight elements without coverage as gaps.
- Overall coverage percentage: verified REQ / total REQ.
- Recommend which elements to test next — start with the R-01 violations.
