---
name: se-irr
version: 4
description: Assumption Review — detect unproven assumptions, ask which become requirements, write each chosen one as a REQ with its verifying TEST, record the review as a closed CR (CREATE, gate-only)
---

**Assumption Review** is judgment work, not a render: surface the unproven assumptions the model rests on, ask the user which of them become requirements, write each chosen one into the graph as a REQ with its verifying TEST, and record the review as a closed change request. This is the renamed-from-"IRR" creation skill — it is **explicitly non-INCOSE** (graphcode-specific) and must not be confused with the FMEA render (`se-view:fmea`) or with `docs/records/irr.md` (Internal Readiness Review).

## 1. Detect the unproven assumptions
Query the live graph — do not guess from prose:
1. `graph_elements` `{ "type": "REQ" }` and `{ "type": "FUNC" }` — scan `description`/`attributes.rationale` for claims asserted without evidence ("assume", "should", "presumably", an unbenchmarked number, an unverified external dependency).
2. `rules_get_violations` `{ "severity": "warning" }` — R-19/R-20 (unbound TEST/FUNC) and unverified REQs are assumptions about realizability that nothing yet proves.
3. `graph_readiness` — a mark that reads reached while an analysis rule (AF-01 … AF-04) is accepted or still open is itself a standing assumption ("analysis-done") — name it.
4. **Foreign sources.** The shape of a source you do not own is never written in the model as a claim, so steps 1–3 cannot find it. Walk every interface to one: each `ACTOR` or external system with an `io` FLOW, and the SCHEMA of that FLOW. Per source ask: *was the real source queried?* Evidence is a query that returns **numbers only**:
   - count per status / type of the records the model works on,
   - count of distinct owners (users, accounts) of those records,
   - count of fields that carry a value, against the fields the SCHEMA needs,
   - the response code per needed endpoint, called with the key the system will use.

   Never names, addresses or free text — customer data reaches no model. Every deviation from what the model assumes becomes a line of the list in §2. No access to the source: keep the assumption open with evidence `none`, and hand the missing access to `se-conops` (access list).

   Measured failure this step exists for (immo-infra, 2026-11-07): two reviews missed that all 89 active records belonged to one user, 28 of 121 had no status, the gateway delivered 15 of 264 fields, and the read key got 401 on `/contacts`. Each of the four is one count from the list above.

## 2. Ask which ones become requirements, then write them (through the gate)
Show the user the whole list — every assumption, not only the load-bearing ones — one line each: the assumption, what breaks if it is wrong, the evidence today (none/weak/strong), and your recommendation (`load-bearing` or `low`). Ask which of them to write as requirements. The user decides; a low one the user picks is written like any other, and a load-bearing one the user declines is recorded with that decision. If nobody answers (headless run), write the load-bearing ones and say so in the closing report.

For each chosen assumption author one `REQ` with `se:author-req`, so it ships with its verifying `TEST` in the same batch (every write goes through the Apply-Gate, L2): the REQ states what must hold, the TEST is what would falsify the assumption. Hang the REQ where it belongs — under the use case it concerns, or at the system (`SYS compose REQ`) when it concerns the whole. Check `graph_mutate`'s returned `violations` and re-apply if the gate blocks the batch. Never hand-edit the graph SSOT.

## 3. Record the review as a closed change request
A review is a change to the model, and it is documented like one — one text, one node, edges to what it touched:
1. **Text.** Write `docs/cr/done/<next CR id>-<slug>.md` — the next free number after the files in `docs/cr/open/` and `docs/cr/done/`, same prefix; `CR-001` in a repo without CRs. It names the commit the review ran against (`git rev-parse --short HEAD`) and carries the whole list: `assumption | why it is load-bearing | evidence today | what would falsify it | decision (REQ id, or declined and why)`. It is the only prose record — a new review is a new CR, never an edit of an old one.
2. **Model.** In the same `graph_mutate` batch as the requirements, add the CR node — id and title only, `status: "done"` — with one `relation` edge from it to every REQ this review wrote.

A closed CR documents; it orders no build. The function that satisfies a requirement comes with the next modelling move, and the build order is cut later by `se-plan`, as for everything else that is not built yet. A review in which nothing was chosen still gets its CR — the list and the declined decisions are the result.

## 4. Stamp the task
Close the task with **one** `graph_mutate` batch on the SYS root. `analysisFreshness` is one attribute for all analyses and a patch replaces it whole: read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`, set `"assumption-review": { graphVersion: <current graphVersion()> }`, and write the complete object with the `baseVersion` you read. **AF-03** (the entry rule of the task `irr`) stays open until then.
