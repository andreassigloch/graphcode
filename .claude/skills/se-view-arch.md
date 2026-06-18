---
name: se-view:arch
description: Show architecture allocation status
---

Render the architecture allocation view from a graph slice — graphcode has no server-side view endpoint (KNOW-via-query: the agent is the renderer). Fetch over MCP:

1. `graph_elements` `{ "type": "FUNC" }` — every function.
2. `graph_get_edges` `{ "edgeType": "allocate" }` — FUNC→MOD allocations (`allocate` = function-to-module).

Compute and format as a readable summary:

- For each FUNC: its allocation status — **allocated** (has an outgoing `allocate` edge to a MOD; name the MOD) or **unallocated**.
- Highlight unallocated functions as **gaps**.
- Overall allocation coverage: `allocated / total FUNC` as a percentage.
- Recommend which functions to allocate next (start with safety- or REQ-bearing functions).

Optionally draw the allocation as a Mermaid `graph LR` (`FUNC --> MOD`). Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use the uid or a plain-text name.
