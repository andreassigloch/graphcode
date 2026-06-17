---
name: se-view:trade
description: Show architecture optimization candidates
---

Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/query?view=trade`

Format as readable summary:

- List each open trade study with alternatives and current selection status
- Flag unresolved trades that block architecture completion
- Show decided trades with rationale
