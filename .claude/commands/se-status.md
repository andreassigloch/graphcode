---
name: se-status
version: 4
description: Show SE project status — readiness, violations, top fixes
---

Pull status from the governed graph over MCP. The graphcode harness is **MCP-stdio only** — there are no HTTP endpoints, use the bound tools:

1. `graph_readiness` → `marks` (SRR, PDR, CDR, TRR, Bau), `stages` (findings per stage) + `violationsByRule` (counts per contracts rule-ID),
   plus `skipped` (jede NICHT ausgewertete Regel als `rule:<id>`) und `importCoverage` (Reichweite
   der Code-Konformanz, `null` wenn sie nicht lief) — BOK-CR-033.
2. `rules_get_violations` → current violations; filter `{ "severity": "error" }` and `{ "severity": "warning" }` (skip info).
3. `graph_elements` `{ "type": "MS" }` for milestone / phase context.

Format as a compact overview:

- Where the model stands: the marks in order (`reached` or not) and the findings per stage from `stages`; milestones (`MS`) as planning context. No percentage.
- Readiness by rule: one bar per `violationsByRule` entry (`ruleId` → count) — use block characters or plain counts.
- Violations: error count, warning count (skip info severity). After write moves of this session `rules_get_violations` returns only the findings of the elements the session wrote; add `umfang.ausserhalb`, the number of the rest, to each count.
- **Kongruenz** in einer Zeile: `kongruent` · `gedriftet` · `nicht prüfbar`. Stehen `rule:RC-*`
  in `skipped`, ist es `nicht prüfbar` — dann die Bindungsquote dazu, nie eine stille Null. Bei jedem Urteil nenne die Deckung: `importCoverage.assigned` von `endpoints`, die Namen aus `unassigned`.
  Ein Score ohne diese Zeile sagt nur, wie der Graph zu sich selbst steht.
- Top-3 to fix next: the first three groups of `rules_evaluate({ detail: "grouped" })`, in the order the tool returns (errors first, then earliest stage). Per group name `ruleId`, `stage`, `message` and the first of its `elementIds`. You count and sort nothing.
- Recommend the #1 element for immediate action.

Note: the retired dashboard's prompt-candidate ranking is an **aimprove** (generator / learning-engine) concern, out of scope for the graph substrate. graphcode surfaces the readiness + violation data those candidates were derived from — take the order of the fixes from `rules_evaluate` grouped, don't call a scoring endpoint.
