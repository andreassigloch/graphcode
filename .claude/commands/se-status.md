---
name: se-status
version: 1
description: Show SE project status — readiness, violations, top fixes
---

Pull status from the governed graph over MCP. The graphcode harness is **MCP-stdio only** — there are no HTTP endpoints, use the bound tools:

1. `graph_readiness` → overall `compliance.score` + `violationsByRule` (counts per contracts rule-ID),
   plus `skipped` (jede NICHT ausgewertete Regel als `rule:<id>`) und `importCoverage` (Reichweite
   der Code-Konformanz, `null` wenn sie nicht lief) — BOK-CR-033.
2. `rules_get_violations` → current violations; filter `{ "severity": "error" }` and `{ "severity": "warning" }` (skip info).
3. `graph_elements` `{ "type": "MS" }` for milestone / phase context.

Format as a compact overview:

- Current phase (from `MS` element status) and overall readiness percentage (`compliance.score`).
- Readiness by rule: one bar per `violationsByRule` entry (`ruleId` → count) — use block characters or plain counts.
- Violations: error count, warning count (skip info severity).
- **Kongruenz** in einer Zeile: `kongruent` · `gedriftet` · `nicht prüfbar`. Stehen `rule:RC-*`
  in `skipped`, ist es `nicht prüfbar` — dann die Bindungsquote dazu, nie eine stille Null.
  Ein Score ohne diese Zeile sagt nur, wie der Graph zu sich selbst steht.
- Top-3 elements to fix next: the `elementId`s carrying the most error-severity violations (derive from the `violations` list), each with its `ruleId` + `message`.
- Recommend the #1 element for immediate action.

Note: the retired dashboard's prompt-candidate ranking is an **aimprove** (generator / learning-engine) concern, out of scope for the graph substrate. graphcode surfaces the readiness + violation data those candidates were derived from — rank the fixes by violation severity/count here, don't call a scoring endpoint.
