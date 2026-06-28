---
name: se-view:changelog
version: 1
description: Change log — applied mutations from the audit trail plus CR status rollup
---

Render the Change Log from the live governed graph — graphcode has no view endpoint, the agent is the renderer (KNOW-via-query). The change log has two sources: the **audit trail** (every gate-applied mutation, author-logged) and the **CR nodes** (the planned units of change, by status). Both come over MCP — never read a hand-maintained CHANGELOG file:

1. `audit_stats` — totals: applied mutations, blocked attempts, distinct authors/consumers. The headline numbers.
2. `audit_trail` `{ "limit": 50 }` — the recent applied mutations in order: each carries the consumer/author, the command set, the resulting tier (`auto-apply` / `block`), and any violations. This is the factual record of what changed.
3. `graph_elements` `{ "type": "CR" }` — every change request, with `attributes.status` (`open` / `done` / `draft`) and `created_at` / `updated_at`. The planned-change ledger.
4. `graph_get_edges` `{ "edgeType": "relation" }` — CR → MS assignment, to group the CRs under their milestone.
5. `rules_get_violations` `{ "severity": "error" }` — any error still open: a change that left the graph non-green.

Present a structured summary:

## 1. CR-Status nach Meilenstein
Group CRs by their `relation`-linked `MS`. Per milestone: `done / total` CRs, then the open CRs listed by uid with a one-line description. This is the burndown.

## 2. Mutations-Verlauf
A reverse-chronological table from the audit trail: `Zeit | Consumer | Ops | Tier | Violations`. Collapse a batch into one row (op count). Flag every `block` tier row — a rejected change is part of the history too.

## 3. Kennzahlen
From `audit_stats`: total applied mutations, blocked attempts (the gate working), distinct authors. State the gate-acceptance ratio as `applied / (applied + blocked)`.

## 4. Verlaufsgraph
A Mermaid `graph LR` of the most recent CRs linked to their milestone node, colored by status (done vs open). Keep node labels free of `(`, `)`, and `|` — those blank the whole diagram; use the uid or a plain-text name.

Derive every entry from `audit_trail` / `audit_stats` and the live CR nodes — the audit trail is the single source of truth for what was applied, the CR status for what was planned.
