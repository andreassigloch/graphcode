---
name: se-status
description: Show SE project status — readiness, violations, top suggestions
---

Fetch all three endpoints in parallel:

1. Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/readiness`
2. Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/graph/violations`
3. Run: `curl -sf ${GRAPH_API:-http://localhost:3001}/api/dashboard/scoring-profile`

Format as compact overview:

- Current phase and overall readiness percentage
- SRR/PDR/CDR/TRR dimension bars (req, uc, arch, alloc, ver, schema) — use block characters or percentage
- Violations: error count, warning count (skip info severity)
- Top-3 prompt candidates with score and description
- Recommend #1 for immediate action
