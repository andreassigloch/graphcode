---
name: se-review
description: Readiness gate check — blockers and next steps
---

Fetch both endpoints in parallel:

1. Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/readiness`
2. Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/violations`

Perform gate check:

- List all error-severity violations as BLOCKERS
- List warning-severity violations as WARNINGS
- Show which readiness dimensions are below 70% threshold
- Determine current phase (SRR/PDR/CDR/TRR)
- Recommend specific next actions to advance to next phase
- State clearly: PASS (ready to advance) or FAIL (blockers remain)
