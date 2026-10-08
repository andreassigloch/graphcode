---
name: se-conops
version: 5
description: Concept of Operations (CREATE) — surface operational concerns (config/creds/user-mgmt/deploy) BEFORE use cases and write them as system-scoped non-functional REQ through the gate
---

**ConOps as a create skill** (the render counterpart is `se-view:conops`): the operational concerns a system must answer *before* its use cases are decomposed — configuration, credentials/secrets, user management, deployment, observability, backup/restore, upgrade. A use case authored before these are settled rests on unstated operational assumptions.

## 1. Enumerate the operational concerns
Walk the standing checklist against the system: **config** (what is environment-specific), **value classes** (which values are runtime parameters, which start configuration, which invariants — and where each kind is kept and managed: the settings store with its history, the configuration file, the code), **creds/secrets** (what must never be in source), **user-mgmt** (who authenticates, what roles), **deploy** (how it ships + rolls back), **observability** (health, logs, metrics), **data lifecycle** (backup, retention, migration). For each, state whether the model already answers it.

## 2. Check what the graph already says
- `graph_elements` `{ "type": "ACTOR" }` and `{ "type": "SYS" }` — the operators and the system boundary the concerns attach to.
- `graph_elements` `{ "type": "REQ" }` — which operational concerns are already captured (`kinds` ∋ `non-functional`).
- `graph_get_edges` `{ "edgeType": "io" }` — actor↔system exchanges that imply a credential/config concern.

## 3. Write the answered concerns through the gate
For each concern the system MUST satisfy, author a `REQ` via `graph_mutate` (Apply-Gate, L2) — use `se:author-req` so each REQ ships with a verifying TEST in the same batch (a lone REQ is blocked by R-01). **Two things** make it operational, and the render (`se-view:conops` §2) needs **both**:

1. **`attributes.kinds` = `["non-functional"]`** — `ReqKind` in `@sigloch/contracts` has exactly two values, `functional` and `non-functional`, and an operational concern is a `non-functional` one. The function that later realizes it (check 7 in `se:top-level`) gets its own `functional` REQ. (Until CR-GC-304 this skill offered it as an option and the view filtered on it — the table could never fill.)
2. **A trace that puts it at system scope** — `SYS compose REQ` (or `SYS satisfy REQ`), or an edge to/from an `ACTOR` for a user-mgmt/creds concern. A REQ allocated only to one FUNC/MOD is design, not ConOps, and will not appear in the view.

Inspect the returned `violations`; re-apply if blocked. Never hand-edit the SSOT.

## 4. Record the walk as a closed change request
A ConOps walk is a change to the model, and it is documented like one — one text, one node, edges to what it touched:
1. **Text.** Write `docs/cr/done/<next CR id>-<slug>.md` — the next free number after the files in `docs/cr/open/` and `docs/cr/done/`, same prefix; `CR-001` in a repo without CRs. It carries each concern of step 1 with its answer: the requirement written for it, or the gap and why it stays open.
2. **Model.** In the same `graph_mutate` batch as the requirements, add the CR node — id and title only, `status: "done"` — with one `relation` edge from it to every element you created (`CR relation → REQ`, `→ FUNC`, `→ MOD`, `→ UC`). §6 of the ConOps view ("nature of changes / summary of impacts", 29148) is rendered from exactly those edges.

A closed CR documents; it orders no build. What the requirements still need built is cut by `se-plan`.

## 5. Report the gaps
An operational concern with **no answer** is a blocking gap — list it explicitly (it is the ConOps equivalent of a never-performed analysis), not a silent omission.

Two gaps are **structural**, not yours to close ad-hoc: **modes of operation** (normal/degraded/maintenance) have no `MODE` element type — the view prints the gap; do not invent a local attribute for it. And a UC without an `FCHAIN` renders as "kein Betriebsablauf beschrieben" — that is a real finding, so either author the chain or leave it visible.

## 6. Stamp the task
Close the task with **one** `graph_mutate` batch on the SYS root. `analysisFreshness` is one attribute for all analyses and a patch replaces it whole: read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`, set `"conops": { graphVersion: <current graphVersion()> }`, and write the complete object with the `baseVersion` you read — after the operational REQ of step 3 are in the graph. The stamp records that this walk happened at that graph version; **AF-01** (the entry rule of the task `conops`) stays open until then. A ConOps that wrote no operational REQ and named no gap has not happened: leave AF-01 open instead of stamping an empty walk.

The output is the operational REQ in the graph, the closed CR that records the walk, and the named gaps — produced before the UCs are written.
