---
name: se:author-req
version: 1
description: Author a REQ together with its verifying TEST concept in one gated batch — the REQ-with-test invariant
---

<!-- inject:start -->
A requirement you cannot state a verification for is not well-formed. Author every new REQ in the SAME gated batch as a concept-level TEST + `verify` trace — the test concept (target + tool + constraint, NOT code) is the intrinsic proof the REQ is meaningful and falsifiable (CR-GC-203 item 6). The gate enforces this: a lone REQ raises an R-01 error and is BLOCKED under delta-semantics, so this skill is about leaning INTO the gate, not working around it.

**Write the requirement so it can be checked (BQ, CR-GC-602).** Use the agreed form — "The system shall …" / „Das System muss …" — and put the measurable part into the sentence: a number, a limit or an observable condition, never a vague word ("fast", "appropriate"). Name who acts, on what, under which condition.

For each new requirement, emit ONE `graph_mutate` batch as Format-E:

```
## Nodes
### REQ
+ REQ-<slug>|<what + why, falsifiable> [__name:<imperative requirement>]
@kinds ["functional"]
### TEST
+ TEST-<slug>|<target + tool + pass/fail constraint — the test CONCEPT, not code> [__name:<what it checks>]

## Edges
+ <UC> -compose-> REQ-<slug>
+ TEST-<slug> -verify-> REQ-<slug>
+ <FUNC or MOD> -satisfy-> REQ-<slug>
```

Every REQ carries `@kinds`: `functional` / `precondition` / `postcondition` is satisfied by a FUNC, `non-functional` / `risk` / `mitigation` by a MOD or the SYS; an FCHAIN may satisfy either. Without `kinds`, `FUNC`/`MOD`/`SYS -satisfy->` is rejected (R-18). The `satisfy` line belongs in the batch whenever the REQ is a leaf (no decomposition) — without it RD-01 flags the REQ. Never author a REQ alone "to add the test later" — that is precisely the debt this invariant prevents.
<!-- inject:end -->

Once the runnable test exists, add an entry to the TEST's `testRefs [{ file, tool, level?, case? }, …]` so `graph_tests` can select it (CR-GC-134). **Eine Abnahme, n Dateien** (CR-SM-231): ein TEST, der als vitest *und* playwright läuft, trägt zwei Einträge — `tool` steht deshalb je Eintrag. Eine Datei gehört zu höchstens einem TEST; R-29 meldet eine doppelt beanspruchte Datei als `error`.

The form above is prevention; the task `anforderungsqualitaet` (`graph_generate {task:'anforderungsqualitaet'}`) cleans up what is left.

The gate accepts the batch (the REQ has a verify) or tells you exactly what is missing; confirm with `rules_get_violations` `{ "severity": "error" }`. To clear REQs that already lack a verify, use `se:close-violations`.
