---
name: se-view:nfr
description: Show NFR timing budget status
---

Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/query?view=nfr`

Format as readable summary:

- List each NFR requirement with its budget and current measurement
- Flag any timing overruns or budget violations
- Show overall NFR compliance status
