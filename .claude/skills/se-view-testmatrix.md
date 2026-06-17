---
name: se-view:testmatrix
description: Show test coverage status from graph
---

Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/query?view=testmatrix`

Format as readable summary:

- List each testable element (UC, FUNC, FCHAIN) with its verification status
- Highlight elements without any verify trace (coverage gaps)
- Show overall coverage percentage
- Recommend which elements to test next
