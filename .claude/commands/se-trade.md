---
name: se-trade
version: 3
description: Trade Study (CREATE) — evaluate ≥2 options for an open design decision, apply the chosen one to the model and record the decision as a closed CR with relation edges to what it decided
---

**Trade Study** is the judgment skill for an open design decision (a Spike or Concept with more than one viable option). A decision is a change: it is recorded exactly like any other change — a CR text, a lean CR node, `relation` edges to what it touched. No option nodes, no edge labels, no second document.

## 1. Frame the decision
State the question and the **≥2 options** (a one-option "trade" is not a trade — ask for the alternatives). For each option: what it is, its cost/benefit, and the risk it carries. Anchor each option in the graph where it already exists: `graph_get_node` / `graph_elements` for the FUNC/MOD/REQ the option would realize.

## 2. Decide on stated criteria
Score the options against explicit criteria (effort, risk, reversibility, fit to the locked constraints). Name the **winner** and the reason — a trade with no decision is just a list.

## 3. Record the decision as a closed change request
1. **Text.** Write `docs/cr/done/<next CR id>-<slug>.md` — the next free number after the files in `docs/cr/open/` and `docs/cr/done/`, same prefix; `CR-001` in a repo without CRs. It carries the question, every option with its cost and risk, the criteria, the choice and the reason. The rejected options live **here**, in the text — not as nodes in the graph.
2. **Model.** Apply the chosen option to the graph via `graph_mutate` (Apply-Gate, L2), and in the same batch add the CR node — id and title only, `status: "done"` — with one `relation` edge from it to every element the decision created, changed or settled.

Check the returned `violations` and re-apply if the gate blocks the batch. Never hand-edit the SSOT.

A closed CR documents; it orders no build. What the decision still needs built is cut by `se-plan`, like everything else that is not built yet.

## 4. Stamp the task — with the decision CR
Close the task with **one** `graph_mutate` batch on the SYS root. `analysisFreshness` is one attribute for all analyses and a patch replaces it whole: read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`, set `"trade": { graphVersion: <current graphVersion()>, crRefs: [<the decision CR id>] }`, and write the complete object with the `baseVersion` you read. **TR-01** (task rule of `trade`) fires when the stamp names no CR or names a CR that does not exist. A trade that ends without a decision is not stamped: leave AF-02 open instead of stamping an empty study.
