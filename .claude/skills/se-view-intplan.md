---
name: se-view:intplan
description: Integration & Test Plan — milestones, CRs, impl-gates SAR/FCA/SVR/FRR, ordering
---

Render the Integration & Test Plan from the live governed graph — the graph is the SSOT; graphcode has no view endpoint, the agent is the renderer. The plan is the milestone chain plus the program-acceptance gates: `graph_readiness` exposes four **impl-gates** — SAR (MS-1-specification), FCA (MS-2-coding-vv), SVR (MS-3-mvp-readiness), FRR (MS-4-mvp2) — each `ready` iff every CR assigned to its milestone is `done` and the milestone scope is error-clean. Fetch over MCP:

1. `graph_elements` `{ "type": "MS" }` — milestones and their `status` (draft / open / reviewed / done).
2. `graph_elements` `{ "type": "CR" }` — change requests; read `attributes.status` (open / done).
3. `graph_get_edges` `{ "edgeType": "relation" }` — CR→MS assignments (CR `relation` MS) and MS→MS `depends-on` ordering (read each edge `label`).
4. `graph_get_edges` `{ "edgeType": "compose" }` — the REQ/FUNC/UC each MS includes (its integration scope).
5. `graph_readiness` → `implGates` (SAR/FCA/SVR/FRR with `passed`, `score`, `blocking`) plus `phaseGates` (SRR/PDR/CDR/TRR) for the technical-review context.

Present a structured summary:

## 1. Meilenstein-Reihenfolge
The MS→MS `depends-on` chain in execution order. Per MS: assigned CRs (CR→MS relation) with status, the included REQ/FUNC/UC (compose), and a status of OFFEN / IN ARBEIT / GRÜN derived from the MS status plus the share of its CRs that are done.

## 2. Impl-Gates
One row per impl-gate from `graph_readiness.implGates`: `Gate | Meilenstein | passed | score | blocking`. The gate is **ready** only when `passed` is true (all CRs done + scope error-clean) — list each `blocking` item (open CR or scope error) as the work that holds the gate closed. Gates integrate in tier order SAR → FCA → SVR → FRR.

## 3. Integrationsreihenfolge
A Mermaid `graph LR` of the CR→MS assignments and the MS→MS `depends-on` gate chain, annotated with each impl-gate. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use uids or plain names.

## 4. Abdeckung
Roll-up: which REQ / FUNC / UC are assigned to a milestone (via MS `compose`) and which are unassigned (the integration-plan gaps — also the MS-01 empty-scope signal in `rules_get_violations`).

Derive everything from the graph queries above — do not read a hand-maintained integration plan doc.
