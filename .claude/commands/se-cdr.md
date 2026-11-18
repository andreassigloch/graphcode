---
name: se-cdr
version: 2
description: Review before the build plan — lint the specification in the gate, then one agent per leaf function without prior knowledge lists every question it would have to ask before building. Writes nothing into the model. Due after the Zod schema per leaf function, before se-plan.
---

**se-cdr** reads the specification the way the implementer will. Who wrote the model no longer sees its gaps; the implementer finds them first. Measured failure (immo-infra, build 2026-11-10 to 11-12): 17 of 20 questions to the client were gaps of the specification, and none of the skills before the build had found them.

This skill **writes nothing into the model**. It reads, asks and reports. The author answers; `se:author-req` writes the answers.

Order: after the Zod schema per leaf function exists, before `se-plan`. Requirement, test and Zod schema together are the "build-to" baseline.

## 1. Lint in the gate
Read the findings of the mark CDR from the tool, never from a list of your own:
```
graph_readiness                                  # marks: is CDR reached?
rules_get_violations({ detail: "summary" })      # one entry per finding, with rule and element; CDR holds up to stage 8
```
**A finding stops the review.** Count only the findings of stage 8 or lower at the leaf functions under review, at their flows and at the SCHEMA of those flows. A finding elsewhere in the model does not stop this review. Name each finding with rule and element, hand the list to the author, and stop. Do not start layer 2 on a function that does not lint clean.

A leaf function is ready to build only when every SCHEMA at its flows carries a `realRef` onto a Zod schema (R-26: `realRef` present; RC-08: the target is a Zod schema). A concept SCHEMA without `realRef` is a finding of this layer, not a question for layer 2.

## 2. Review by an agent without prior knowledge
Start **one agent per leaf function** (`graph_elements({ type: "FUNC" })`, a FUNC without FUNC child). Give it no history of this session, no CR text, no model prose beyond what it reads itself. The agent has no prior knowledge and reads exactly two things:
1. `graph_context` of its function — description, requirements, tests, edges.
2. The Zod schemas at its flows — the file named by each SCHEMA `realRef`.

The agent lists every question it would have to ask before building. It asks in five ways, one line per question, naming the element:
- **Missing date.** A date the requirement names is missing as a field of the SCHEMA.
  Example: `REQ-partnervertrag-verknuepft` names the partner link; `SCHEMA-betriebsauftrag` has no field for it.
- **Missing value, role or source.** A value, role or source is missing.
  Example: file limit per run, price per comparison, the role that opens the portal.
- **Invariant.** The requirement contradicts an invariant at SYS or MOD.
  Example: three requirements write to the IONOS file store, which an invariant excludes.
- **Carrier.** The carrier does not read the data the requirement needs.
  Example: the comparison hangs at the compute function, the data is read by the environment check.
- **Operation.** An operating question is open (user, rights, place of the data).
  Example: the user of the environment run; the scope of the restore.

A question the agent can answer from the two sources is not a question. A question it answers by assumption is one.

**Rank every question.** Mark it `behaviour` when the answer changes what the function does, what it writes, or where data lives; mark it `detail` otherwise (a field name, a format, a timeout with an obvious default). The author gets the `behaviour` questions first. Measured on immo-infra (2026-11-18): three functions gave about 170 questions, and the hits drowned in them.

## 3. Across the functions
A gap between two functions is invisible to an agent that reads one. Start **one more agent without prior knowledge** that reads every leaf function under review at once: name, description and requirements of each, and the SCHEMA at their flows. It looks for exactly two cases:
- **Two carriers.** Two functions carry the same task, or a requirement hangs at a function that does not read its data while another one does.
  Example: two functions both detect a change of the responsible broker; the comparison belongs to the one that reads the broker field.
- **Two sources.** The same kind of data comes from two places (a log, a list, a status), so two truths can drift.
  Example: two functions each keep their own protocol of the runs.

Each finding is a `behaviour` question at both functions.

## 4. Questions that only a measurement answers
If only a measurement answers the question (an endpoint, a quota, a target of a backup), it becomes an experiment before the plan: state the call, the number it returns, and who runs it. Customer data reaches no model; keep to counts and response codes (as in `se-irr`). The result of the experiment answers the question; the author confirms and `se:author-req` writes it.

## 5. Result
Report a **list of questions per function**: function, question, kind (one of the five, or a finding of §3), rank (`behaviour` or `detail`), and for a measurement the experiment. **An empty list means ready to build.** Ask the author the open questions of the whole list in one block; each answer goes to `se:author-req` (REQ with its verifying TEST in one gated batch). Then run the skill again for the functions whose questions were answered, until their lists are empty.

`se-plan` starts only when the list is empty for every leaf function it cuts.

## Boundary to the build
The implementer decides nothing that changes behaviour. A question to the client during the build is a finding against this review: it goes back to `se-cdr`, is added to the list here, and is answered before the next build step. Headless run: no one can answer. Hand each open question to `se:author-req` as an assumption (a REQ with an open target value and its TEST) and name every assumption in the closing report.
