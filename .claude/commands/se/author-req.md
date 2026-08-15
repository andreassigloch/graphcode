---
name: se:author-req
version: 1
description: Author a REQ together with its verifying TEST concept in one gated batch — the REQ-with-test invariant
---

A requirement you cannot state a verification for is not well-formed. Author every new REQ in the SAME gated batch as a concept-level TEST + `verify` trace — the test concept (target + tool + constraint, NOT code) is the intrinsic proof the REQ is meaningful and falsifiable (CR-GC-203 item 6). The gate enforces this: a lone REQ raises an R-01 error and is BLOCKED under delta-semantics, so this skill is about leaning INTO the gate, not working around it.

For each new requirement, emit ONE `graph_mutate` batch:

1. The REQ node: `{ "op": "add-node", "node": { "uid": "REQ-<slug>", "type": "REQ", "name": "<imperative requirement>", "description": "<what + why, falsifiable>" } }`.
2. A concept-level TEST node: `{ "op": "add-node", "node": { "uid": "TEST-<slug>", "type": "TEST", "name": "<what it checks>", "description": "<target + tool + pass/fail constraint — the test CONCEPT, not code>" } }`. Once the runnable test exists, add an entry to `attributes.testRefs [{ file, tool, level?, case? }, …]` so `graph_tests` can select it (CR-GC-134). **Eine Abnahme, n Dateien** (CR-SM-231): ein TEST, der als vitest *und* playwright läuft, trägt zwei Einträge — `tool` steht deshalb je Eintrag. Eine Datei gehört zu höchstens einem TEST; R-29 meldet eine doppelt beanspruchte Datei als `error`.
3. The verify trace: `{ "op": "add-edge", "edge": { "sourceId": "TEST-<slug>", "targetId": "REQ-<slug>", "edgeType": "verify" } }`.
4. If the REQ is a leaf (no decomposition), also add a `satisfy` trace from the realizing FUNC/MOD to avoid RD-01: `{ "op": "add-edge", "edge": { "sourceId": "<FUNC>", "targetId": "REQ-<slug>", "edgeType": "satisfy" } }`.

Submit the batch via `graph_mutate`. The gate accepts it (the REQ has a verify) or tells you exactly what is missing; confirm with `rules_get_violations` `{ "severity": "error" }`. Never author a REQ alone "to add the test later" — that is precisely the debt this invariant prevents. To clear REQs that already lack a verify, use `se:close-violations`.
