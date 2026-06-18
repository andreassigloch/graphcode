---
name: se-view:trade
description: Show architecture optimization candidates
---

Render the trade / decision view from a graph slice — graphcode has no view endpoint, the agent renders it. graphcode has **no dedicated trade-study element type**; trade decisions live as `relation` edges (the generic semantic link, with a `label` such as `alternative` / `supersedes` / `depends-on`) and as `CR` nodes (decision/change records carrying a `status`). Fetch over MCP:

1. `graph_get_edges` `{ "edgeType": "relation" }` — candidate alternative/decision links; read each edge `label`.
2. `graph_elements` `{ "type": "CR" }` — change/decision records and their `status` (open vs done).
3. `graph_get_node` `{ "uid": "<id>" }` to resolve the endpoints of an interesting `relation` edge.

Format as a readable summary:

- Each open trade/decision (CR `status: open`, or a `relation` link whose alternatives are not yet resolved) with its alternatives and current selection status.
- Flag unresolved trades that block architecture completion.
- Show decided trades (CR `status: done`) with their rationale (`attributes.rationale` / description).
