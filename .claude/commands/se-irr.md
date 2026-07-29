---
name: se-irr
version: 1
description: Assumption Review — detect unproven assumptions, pin them in a commit-stamped record, promote the load-bearing ones to CRs (CREATE, gate-only)
---

**Assumption Review** is judgment work, not a render: surface the unproven assumptions the model rests on, pin them to a commit, and promote the load-bearing ones into the graph as CRs. This is the renamed-from-"IRR" creation skill — it is **explicitly non-INCOSE** (graphcode-specific) and must not be confused with the FMEA render (`se-view:fmea`) or with `docs/records/irr.md` (Internal Readiness Review).

## 1. Detect the unproven assumptions
Query the live graph — do not guess from prose:
1. `graph_elements` `{ "type": "REQ" }` and `{ "type": "FUNC" }` — scan `description`/`attributes.rationale` for claims asserted without evidence ("assume", "should", "presumably", an unbenchmarked number, an unverified external dependency).
2. `rules_get_violations` `{ "severity": "warning" }` — R-19/R-20 (unbound TEST/FUNC) and unverified REQs are assumptions about realizability that nothing yet proves.
3. `graph_readiness` — a rule-green gate whose creations are absent is itself a standing assumption ("analysis-done") — name it.

## 2. Pin the record (immutable, commit-stamped)
Write `docs/records/irr-<short-commit>.md` (use the current `git rev-parse --short HEAD`). It is an immutable snapshot — never overwrite an existing one; a new review = a new commit-stamped file. Each entry: `assumption | why it is load-bearing | evidence today (none/weak/strong) | what would falsify it`.

## 3. Promote the load-bearing ones to CRs (through the gate)
For each assumption that, if wrong, breaks the design, open a CR and record the decision in the graph via `graph_mutate` (every write goes through the Apply-Gate, L2). Add a `CR` node and `relation` edges to the elements it concerns; if the assumption becomes a requirement, author it with `se:author-req` so it carries a verifying TEST. Check `graph_mutate`'s returned `violations` and re-apply if the gate blocks the batch. Never hand-edit the graph SSOT.

Low-risk assumptions stay in the record only. The output is the commit-pinned record plus the promoted CRs — not a transient summary.
