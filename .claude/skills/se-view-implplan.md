---
name: se-view:implplan
version: 1
description: Show implementation plan structure and milestone status
---

Render the implementation plan from the live graph — the graph is the SSOT; graphcode has no view endpoint, the agent renders it. Fetch over MCP:

1. `graph_elements` `{ "type": "MS" }` — milestones and their `status` (draft / open / done).
2. `graph_elements` `{ "type": "CR" }` — change requests and their `status` (open / done).
3. `graph_get_edges` `{ "edgeType": "relation" }` — CR→MS assignments and MS→MS `depends-on` links (read each edge `label`).
4. `graph_get_edges` `{ "edgeType": "compose" }` — the FUNC/REQ/UC each MS includes (its scope).

Present a structured summary:

## 1. Meilenstein-Status
Per `MS`: entry milestone (its `depends-on` predecessor), assigned CRs (CR→MS relation) with their status, included REQ/FUNC/UC (compose), and a status of OFFEN / IN ARBEIT / GRÜN derived from the MS status plus the share of its CRs that are done.

## 2. Abhängigkeitsgraph
A Mermaid `graph LR` of CR→MS assignments and the MS→MS `depends-on` gate chain. Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use uids or plain names.

## 3. Abdeckung
Roll-up: which FUNC / MOD / REQ / UC are assigned to a milestone (via MS `compose`), and which are unassigned (the gaps).

Derive everything from the graph queries above — do not read a hand-maintained plan doc.
