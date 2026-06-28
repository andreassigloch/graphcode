---
name: se-view:nfr
version: 1
description: Show NFR timing budget status
---

Render the NFR status view from a graph slice — graphcode has no view endpoint, the agent renders it. Fetch over MCP:

1. `graph_elements` `{ "type": "REQ" }` — all requirements.
2. Keep the non-functional ones: those whose `attributes.kinds` contains `"non-functional"` (the live REQ-kind for NFRs).

Format as a readable summary:

- Each NFR REQ with its budget and current measurement, read from the node `attributes` (e.g. `attributes.budget` / `attributes.measured` — members store the timing/limit there).
- Flag any timing overrun or budget violation (measurement worse than budget).
- Overall NFR compliance status: how many NFRs are within budget vs over.

If a node carries no budget/measurement attribute yet, list it as **unquantified** — do not invent numbers.
