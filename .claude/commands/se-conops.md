---
name: se-conops
version: 2
description: Concept of Operations (CREATE) — surface operational concerns (config/creds/user-mgmt/deploy) BEFORE use cases and write them as system-scoped non-functional REQ through the gate
---

**ConOps as a create skill** (the render counterpart is `se-view:conops`): the operational concerns a system must answer *before* its use cases are decomposed — configuration, credentials/secrets, user management, deployment, observability, backup/restore, upgrade. A use case authored before these are settled rests on unstated operational assumptions.

## 1. Enumerate the operational concerns
Walk the standing checklist against the system: **config** (what is environment-specific), **creds/secrets** (what must never be in source), **user-mgmt** (who authenticates, what roles), **deploy** (how it ships + rolls back), **observability** (health, logs, metrics), **data lifecycle** (backup, retention, migration). For each, state whether the model already answers it.

## 2. Check what the graph already says
- `graph_elements` `{ "type": "ACTOR" }` and `{ "type": "SYS" }` — the operators and the system boundary the concerns attach to.
- `graph_elements` `{ "type": "REQ" }` — which operational concerns are already captured (`kinds` ∋ `non-functional`).
- `graph_get_edges` `{ "edgeType": "io" }` — actor↔system exchanges that imply a credential/config concern.

## 3. Write the answered concerns through the gate
For each concern the system MUST satisfy, author a `REQ` via `graph_mutate` (Apply-Gate, L2) — use `se:author-req` so each REQ ships with a verifying TEST in the same batch (a lone REQ is blocked by R-01). **Two things** make it operational, and the render (`se-view:conops` §2) needs **both**:

1. **`attributes.kinds` = `["non-functional"]`** — the only legal spelling. `ReqKind` in `@sigloch/contracts` has exactly 7 values (`functional`, `non-functional`, `risk`, `negative`, `mitigation`, `precondition`, `postcondition`); **`operational` is not one of them** and the gate rejects it. (Until CR-GC-304 this skill offered it as an option and the view filtered on it — the table could never fill.)
2. **A trace that puts it at system scope** — `SYS compose REQ` (or `SYS satisfy REQ`), or an edge to/from an `ACTOR` for a user-mgmt/creds concern. A REQ allocated only to one FUNC/MOD is design, not ConOps, and will not appear in the view.

Inspect the returned `violations`; re-apply if blocked. Never hand-edit the SSOT.

## 4. Bind the CR so the change sections fill
If this work runs under a CR, add `relation` edges from that CR to every element you created (`CR relation → REQ`, `→ FUNC`, `→ MOD`, `→ UC`). §6 of the ConOps view ("nature of changes / summary of impacts", 29148) is rendered from exactly those edges — a CR without them is invisible there. It need not be a new use case; a single new function is a legitimate change entry.

## 5. Report the gaps
An operational concern with **no answer** is a blocking gap — list it explicitly (it is the ConOps equivalent of a never-performed analysis), not a silent omission.

Two gaps are **structural**, not yours to close ad-hoc: **modes of operation** (normal/degraded/maintenance) have no `MODE` element type — the view prints the gap; do not invent a local attribute for it. And a UC without an `FCHAIN` renders as "kein Betriebsablauf beschrieben" — that is a real finding, so either author the chain or leave it visible.

The output is the operational REQ in the graph plus the named gaps — produced before the UCs are written.
