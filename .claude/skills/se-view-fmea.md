---
name: se-view:fmea
version: 1
description: FMEA view — failure-mode risk elements (S/O/D, Action Priority), mitigation coverage, verification gaps
---

Render the **FMEA** from the live governed graph — graphcode has no view endpoint, the agent is the renderer (KNOW-via-query). This is the FMEA **render** (the create counterpart is the `se-fmea` skill). The graph has **no dedicated risk element type**: risk lives as `REQ` nodes whose `kinds` include `"risk"` (the hazard) or `"mitigation"` (the countermeasure), carrying the FMEA scores in `attributes` (`severity` / `occurrence` / `detection`, each 1–10). Fetch over MCP:

1. `graph_elements` `{ "type": "REQ" }` — every requirement. Keep the risk-bearing ones: `kinds` contains `"risk"`, `"mitigation"`, or `"negative"`, OR `attributes.severity`/`occurrence`/`detection` is set.
2. `graph_get_edges` `{ "edgeType": "satisfy" }` — the responsible FUNC for each risk/mitigation REQ (FUNC→REQ): which function owns the hazard.
3. `graph_get_edges` `{ "edgeType": "verify" }` — TEST→REQ links: is each risk REQ verified (R-01)? An unverified risk REQ is an open hazard.
4. `rules_get_violations` `{ "severity": "error" }` — R-01 (risk REQ without verify) and R-03 (ASIL isolation) are the canonical risk-blocker signals.
5. `graph_readiness` → `compliance.score` for the overall risk-clean fraction, and `violationsByRule` for the R-01/R-03 counts.

Present a structured summary:

## 1. Risikoinventar
One row per risk/mitigation REQ: `ID | kinds | S | O | D | AP | verantwortliche FUNC | verifiziert?`. Derive Action Priority (AP) from S/O/D using AIAG-VDA logic — **Severity first**: S 9–10 with any non-trivial O is High AP; never let a good Detection score demote a safety effect. If a REQ carries no S/O/D attribute, mark it **unquantified** — do not invent numbers.

## 2. FMEA-Verkettung
For each `risk` REQ, name its mitigating `mitigation` REQ(s) (linked via the same responsible FUNC, or a `relation` edge). Flag any `risk` REQ with **no mitigation** as an open hazard.

## 3. Abdeckung & Readiness
- Risk REQs verified (have a `verify` edge) vs. unverified (R-01 gaps from step 4).
- Overall risk-clean readiness: `compliance.score` as a percentage, plus the R-01 / R-03 counts from `violationsByRule`.

## 4. Risikomatrix
A Mermaid `graph LR` linking each High/Medium-AP risk REQ to its responsible FUNC and its mitigation REQ. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use the uid or a plain-text name.

Recommend the top action: start with the highest-AP risk REQ that is unverified or unmitigated. Derive everything from the queries above — do not read a hand-maintained FMEA doc. This view does **not** label its output "IRR" (the Assumption Review is the separate `se-irr` skill).
