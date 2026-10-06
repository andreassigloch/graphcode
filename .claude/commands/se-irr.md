---
name: se-irr
version: 2
description: Assumption Review — detect unproven assumptions, pin them in a commit-stamped record, ask which become requirements, write each chosen one as a REQ with its verifying TEST (CREATE, gate-only)
---

**Assumption Review** is judgment work, not a render: surface the unproven assumptions the model rests on, pin them to a commit, ask the user which of them become requirements, and write each chosen one into the graph as a REQ with its verifying TEST. This is the renamed-from-"IRR" creation skill — it is **explicitly non-INCOSE** (graphcode-specific) and must not be confused with the FMEA render (`se-view:fmea`) or with `docs/records/irr.md` (Internal Readiness Review).

## 1. Detect the unproven assumptions
Query the live graph — do not guess from prose:
1. `graph_elements` `{ "type": "REQ" }` and `{ "type": "FUNC" }` — scan `description`/`attributes.rationale` for claims asserted without evidence ("assume", "should", "presumably", an unbenchmarked number, an unverified external dependency).
2. `rules_get_violations` `{ "severity": "warning" }` — R-19/R-20 (unbound TEST/FUNC) and unverified REQs are assumptions about realizability that nothing yet proves.
3. `graph_readiness` — a mark that reads reached while an analysis rule (AF-01 … AF-04) is accepted or still open is itself a standing assumption ("analysis-done") — name it.

## 2. Pin the record (immutable, commit-stamped)
Write `docs/records/irr-<short-commit>.md` (use the current `git rev-parse --short HEAD`). It is an immutable snapshot — never overwrite an existing one; a new review = a new commit-stamped file. Each entry: `assumption | why it is load-bearing | evidence today (none/weak/strong) | what would falsify it`.

## 3. Ask which ones become requirements, then write them (through the gate)
Show the user the whole list from the record — every assumption, not only the load-bearing ones — one line each: the assumption, what breaks if it is wrong, and your recommendation (`load-bearing` or `low`). Ask which of them to write as requirements. The user decides; a low one the user picks is written like any other, and a load-bearing one the user declines stays in the record with that decision noted. If nobody answers (headless run), write the load-bearing ones and say so in the closing report.

For each chosen assumption author one `REQ` with `se:author-req`, so it ships with its verifying `TEST` in the same batch (every write goes through the Apply-Gate, L2): the REQ states what must hold, the TEST is what would falsify the assumption. Hang the REQ where it belongs — under the use case it concerns, or at the system (`SYS compose REQ`) when it concerns the whole. Check `graph_mutate`'s returned `violations` and re-apply if the gate blocks the batch. Never hand-edit the graph SSOT.

**Do not open a CR.** An analysis leaves no build order: the function that satisfies the requirement comes with the next modelling move, and the build order is cut later by `se-plan`, as for everything else that is not built yet.

What was not chosen stays in the record only. The output is the commit-pinned record plus the requirements — not a transient summary.

## 4. Stamp the task — with the requirements
Close the task with **one** `graph_mutate` batch on the SYS root. `analysisFreshness` is one attribute for all analyses and a patch replaces it whole: read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`, set `"assumption-review": { graphVersion: <current graphVersion()>, reqRefs: [<the REQ ids of step 3>] }`, and write the complete object with the `baseVersion` you read. An empty `reqRefs` is a legitimate outcome (nothing was chosen; the rest lives in the record). **IR-01** (task rule of `irr`) fires only when a listed id names no existing REQ.
