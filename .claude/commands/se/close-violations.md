---
name: se:close-violations
version: 1
description: Drive the governed graph to zero error-violations — propose ranked verify/satisfy edges, confirm fit, gate-mutate, repeat
---

Resolve V3_RULES error-violations on the live governed graph by linking the traces the rules already point you to — graphcode computes the fix-context, you confirm the semantic fit (CR-GC-203). Loop until green:

1. `rules_get_violations` `{ "severity": "error" }` — every blocking violation. Each carries `fixHint` + `context.candidate_targets` (RANKED by id/name/description token overlap — the top hit is usually correct) + `context.existing_traces`. Most are **R-01** (REQ without a verify trace) and **RD-01** (leaf REQ without a satisfy trace).
2. For each violation, read its `fixHint` and the TOP `candidate_targets`:
   - **R-01**: candidates are TESTs; the top-ranked one usually verifies this REQ → propose `{ "op": "add-edge", "edge": { "sourceId": "<TEST>", "targetId": "<REQ>", "edgeType": "verify" } }`.
   - **RD-01**: candidates are FUNC/FCHAIN/MOD/SYS → propose `{ "op": "add-edge", "edge": { "sourceId": "<FUNC>", "targetId": "<REQ>", "edgeType": "satisfy" } }`.
3. **Confirm fit before linking.** Ranking is a hint, not truth — check each proposed edge makes SEMANTIC sense (does this TEST actually verify this REQ?). If the top candidate is wrong, scan the rest or `graph_get_node` for detail. If genuinely ambiguous, STOP and ask — never invent a trace to clear a violation.
4. Batch the confirmed edges through `graph_mutate` (the L2 gate — same gate as any write, author logged). It re-evaluates under delta-semantics and rejects anything that introduces a NEW error.
5. Re-run `rules_get_violations` `{ "severity": "error" }`. Repeat from step 1 until the list is empty — or until only genuinely-ambiguous violations remain (then surface them).
6. When green, `graph_export` to materialize the committed SSOT.

**A REQ with no plausible verifying TEST is not well-formed** — do NOT fabricate a TEST to silence R-01. Author a real concept-level TEST with `se:author-req`, or flag the REQ for review. Never a fake trace, never a fake test.
