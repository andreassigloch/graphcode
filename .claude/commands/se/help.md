---
name: se:help
version: 1
description: Explain any dashboard item — a rule, gate, panel, artifact, or token — for both audiences (SE without our ontology, user without SE), or name the next steps from rules_get_violations
---

In-context help for the governed graph, for **both audiences**: a systems engineer who does not know graphcode's encoding, and a user with no SE background. Every answer carries all three layers — **Plain** (no jargon), **In SE terms** (the standard concept), and the **exact** copy-prompt — so the reader picks the depth (roll-up, not profiling; graphcode is headless and has no user identity).

This is a thin surface over the `graph_help` MCP tool (the read-only help data layer, CR-GC-228) — it does not re-author content.

## Lookup a token
When the user names an on-screen token, call `graph_help` `{ "token": "<token>" }` and present its `HelpEntry`:
- a ruleId (`R-04`, `R-01`, `RD-02`) — its entry carries the rule's `stage` and `mark` —, a mark (`SRR`/`PDR`/`CDR`/`TRR`/`Bau`),
- a panel (`readiness`/`recommendations`/`artifacts`/`impact`/`health`), an artifact (`fmea`, `srs`, `assumption-review`, …), or a vocabulary token (`REQ`, `verify`, `compose`).

Show the **Plain** line, then **In SE terms**, then the **exact** copy-prompt (a real `se:*` skill or MCP call) the reader can run. An unknown token returns a clear error listing the valid kinds — relay it, don't guess.

## What should I do next? (no token)
When the user asks "what should I do / what's wrong", call `rules_get_violations` `{ "detail": "grouped" }` — one group per rule in work order (errors first, then by stage), each with `count`, `message`, `fixHint` and example `elementIds`. Present the groups in that order with their `fixHint`. Fetch the long explanation only for the rule the user then asks about: `graph_help` `{ "token": "<ruleId>" }`. `graph_help` has no mode without a token (CR-GC-847); called without one it returns an error naming `rules_get_violations`.

Derive every explanation from `graph_help` and every finding from `rules_get_violations` — do not restate rule text from memory; the tool merges the authored Plain/SE layers with the live `V3_RULES`/readiness skeleton, so it never drifts.
