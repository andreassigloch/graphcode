---
name: se:author-req
version: 8
description: Author a REQ together with its verifying TEST concept in one gated batch — the REQ-with-test invariant
---

<!-- inject:start -->
A requirement you cannot state a verification for is not well-formed. Author every new REQ in the SAME gated batch as a TEST + `verify` trace — the test's statement (target + tool + constraint, NOT code) is the intrinsic proof the REQ is meaningful and falsifiable (CR-GC-203 item 6). The gate enforces this: a lone REQ raises an R-01 error and is BLOCKED under delta-semantics, so this skill is about leaning INTO the gate, not working around it.

**Write the requirement in one of the five EARS patterns (CR-GC-904).** The subject is the element that satisfies the REQ, so name it first. For a functional REQ the trigger is an input FLOW of the satisfying FUNC and the response an output FLOW; use their names. The number belongs in the requirement, with its unit: the TEST checks the value, it never supplies it.

| Pattern | Form | Example |
|---|---|---|
| Ubiquitous | <subject> <response> | The store keeps the graph on disk under `.graphcode/kuzu/`. |
| Event | When <trigger>, <subject> <response> | When a batch arrives, the gate returns a verdict that names every violated rule id. |
| State | While <state>, <subject> <response> | While the LLM sidecar is unreachable, the gate judges every batch without a model call. |
| Unwanted | If <failure>, then <subject> <response> | If the store is unreadable after an abort, then the host restores the last snapshot before the next write. |
| Optional | Where <feature>, <subject> <response> | Where a viewer is attached, the bridge sends each accepted change as one live event. |

A non-functional REQ names its value the same way: "The gate judges a batch of 50 edits within 200 ms." "A context slice of graph_impact stays below 50 % of the tokens of a grep dump of the same scope." German texts follow the same patterns: „Wenn …, dann …", „Solange …", „Falls … , dann …".

**A value with a restriction is a parameter (PARAM): name, value, restriction — in the sentence** (CR-GC-759, CR-GC-974). Write it in square brackets (CR-GC-979). The bracket with name and value defines the parameter: `[limit ≤ 100]`, `[response_time ≤ 2 s]`, `[U_supply = 24 V (21.6 … 26.4 V)]`; the bracket with the name alone, `[limit]`, refers to it. Example: "The search returns at most [limit ≤ 100] hits (call value, checked in the contract)." "The system answers within [response_time ≤ 2 s] (computed, checked in a test)." One name has exactly one definition: state the number in exactly one requirement; every other text refers with `[limit]`, never with the number. A value without a restriction is not a parameter. Never end a description with a bracket — close the sentence with a full stop: the Format-E line reads a bracket at the end of a line as attributes and drops it from the text.

Say next to the value where it comes from — one of five: *runtime parameter* (set in operation, takes effect at once, with history), *start configuration* (read at start, fixed until restart), *invariant* (set in the code, not adjustable by any path), *call value* (set by the caller, belongs to one call and stands in that call's contract) or *computed* (results from other values or from a measurement; name the formula or what is measured). Say where the restriction is checked: in code, in the contract or in a test — at least one of the three.

Who decides: What the requirement names is binding. Where it names no origin or no place of the check, that is design freedom, not an assumption: whoever builds chooses, and the choice is written back into the requirement. Only the author of the requirement sets or lifts *invariant*; whatever shapes the system's behaviour is adjustable unless the requirement says invariant. Write all of this into the text, not into a free attribute: the views show the text, a free attribute stays invisible to the reader. Two values of different origin in one requirement are a sign that it is two requirements — split it, so the invariant gets its own test that it cannot be changed; keep them together only if you can say why.

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
Pass `skill: "se:author-req"` on every `graph_mutate` call of this skill, so the audit counts the move under this skill.

Every REQ carries exactly ONE `@kinds` value, and that value decides who satisfies it:

| `@kinds` | satisfied by |
|---|---|
| `functional` | a FUNC |
| `non-functional` | a MOD (local budget), the SYS (system level) or an FCHAIN (end to end along the chain) |

```
+ REQ-<behaviour>|When <trigger>, <subject> <response> [__name:<behaviour>]
@kinds ["functional"]
+ REQ-<budget>|<subject> stays within <value with unit> [__name:<budget>]
@kinds ["non-functional"]

+ FUNC-<step> -satisfy-> REQ-<behaviour>
+ MOD-<owner> -satisfy-> REQ-<budget>
```

A requirement that is both behaviour and budget is cut wrong — split it into two REQs, one of each kind. Without `kinds`, every `-satisfy->` is rejected (R-18). What must hold before a scenario is the entry FLOW of its chain, what holds after is the UC goal — both are covered through the chain (R-21: every member FUNC satisfies its REQ), so they are not REQs of their own. An FMEA role (`@role risk` / `@role mitigation`, `se-fmea`) sits next to the kind and does not change who satisfies. The `satisfy` line belongs in the batch whenever the REQ is a leaf (no decomposition) — without it RD-01 flags the REQ. Never author a REQ alone "to add the test later" — that is precisely the debt this invariant prevents.
<!-- inject:end -->

Once the runnable test exists, name exactly one uid of the TEST in the header comment of the test file (the lines before the first line of code): `graph_test_ingest` then binds the file when it ingests the run (CR-GC-901). A file that already belongs to a TEST gets no second TEST; hang the further REQ on that TEST with one more `verify`. Or add the entry by hand to the TEST's `testRefs [{ file, tool, level?, case? }, …]` so `graph_tests` can select it (CR-GC-134). **Eine Abnahme, n Dateien** (CR-SM-231): ein TEST, der als vitest *und* playwright läuft, trägt zwei Einträge — `tool` steht deshalb je Eintrag. Eine Datei gehört zu höchstens einem TEST; R-29 meldet eine doppelt beanspruchte Datei als `error`.

**The text promises only what the TEST checks.** CR-GC-838 found ten requirements whose text promised more than their test checked, such as "never applies on its own" or "emits a live event". A promise no test checks is a finding for the code, not part of the requirement. Narrow the text to the check, and open an item for the rest.

The form above is prevention; the task `anforderungsqualitaet` (`graph_generate {task:'anforderungsqualitaet'}`) cleans up what is left.

The gate accepts the batch (the REQ has a verify) or tells you exactly what is missing; confirm with `rules_get_violations` `{ "severity": "error" }`. To clear REQs that already lack a verify, use `se:close-violations`.
