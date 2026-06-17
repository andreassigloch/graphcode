---
name: se-view:arch
description: Show architecture allocation status
---

Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/query?view=arch`

Format as readable summary:

- List each FUNC element with its allocation status (allocated to MOD or unallocated)
- Highlight unallocated functions as gaps
- Show overall allocation coverage percentage
- Recommend which functions to allocate next
