---
name: se:help
version: 1
description: Explain any dashboard item — a rule, gate, panel, artifact, or token — for both audiences (SE without our ontology, user without SE), or give contextual next steps
---

In-context help for the governed graph, for **both audiences**: a systems engineer who does not know graphcode's encoding, and a user with no SE background. Every answer carries all three layers — **Plain** (no jargon), **In SE terms** (the standard concept), and the **exact** copy-prompt — so the reader picks the depth (roll-up, not profiling; graphcode is headless and has no user identity).

This is a thin surface over the `graph_help` MCP tool (the read-only help data layer, CR-GC-228) — it does not re-author content.

## Lookup a token
When the user names an on-screen token, call `graph_help` `{ "token": "<token>" }` and present its `HelpEntry`:
- a ruleId (`R-04`, `R-01`, `RD-02`), a gate (`SRR`/`PDR`/`CDR`/`TRR`, `SAR`/`FCA`/`SVR`/`FRR`),
- a panel (`readiness`/`recommendations`/`artifacts`/`impact`/`health`), an artifact (`fmea`, `srs`, `assumption-review`, …), or a vocabulary token (`REQ`, `verify`, `compose`).

Show the **Plain** line, then **In SE terms**, then the **exact** copy-prompt (a real `se:*` skill or MCP call) the reader can run. An unknown token returns a clear error listing the valid kinds — relay it, don't guess.

## Contextual help (no argument)
When the user asks "what should I do / what's wrong", call `graph_help` with **no argument** → the ranked, explained measures from the live readiness + violations (the explained sibling of Recommendations). It covers **both** blocker kinds: rule violations and not-done-creation gate blockers (a never-performed FMEA/ConOps/Trade — CR-GC-221). Present them highest-severity first, each with its Plain explanation and the copy-prompt to fix it.

Derive everything from `graph_help` — do not restate rule text from memory; the tool merges the authored Plain/SE layers with the live `V3_RULES`/readiness skeleton, so it never drifts.
