---
name: se-conops
version: 1
description: Concept of Operations (CREATE) — surface operational concerns (config/creds/user-mgmt/deploy) BEFORE use cases and write them as operational REQ through the gate
---

**ConOps as a create skill** (the render counterpart is `se-view:conops`): the operational concerns a system must answer *before* its use cases are decomposed — configuration, credentials/secrets, user management, deployment, observability, backup/restore, upgrade. A use case authored before these are settled rests on unstated operational assumptions.

## 1. Enumerate the operational concerns
Walk the standing checklist against the system: **config** (what is environment-specific), **creds/secrets** (what must never be in source), **user-mgmt** (who authenticates, what roles), **deploy** (how it ships + rolls back), **observability** (health, logs, metrics), **data lifecycle** (backup, retention, migration). For each, state whether the model already answers it.

## 2. Check what the graph already says
- `graph_elements` `{ "type": "ACTOR" }` and `{ "type": "SYS" }` — the operators and the system boundary the concerns attach to.
- `graph_elements` `{ "type": "REQ" }` — which operational concerns are already captured as REQ (kind `operational`/`non-functional`).
- `graph_get_edges` `{ "edgeType": "io" }` — actor↔system exchanges that imply a credential/config concern.

## 3. Write the answered concerns as operational REQ (through the gate)
For each concern the system MUST satisfy, author an operational `REQ` via `graph_mutate` (Apply-Gate, L2) — use `se:author-req` so each REQ ships with a verifying TEST in the same batch (a lone REQ is blocked by R-01). Tag `attributes.kinds` `["operational"]` or `["non-functional"]`. Inspect the returned `violations`; re-apply if blocked. Never hand-edit the SSOT.

## 4. Report the gaps
An operational concern with **no answer** is a blocking gap — list it explicitly (it is the ConOps equivalent of a never-performed analysis), not a silent omission. The output is operational REQ in the graph plus the named gaps — produced before the UCs are written.
