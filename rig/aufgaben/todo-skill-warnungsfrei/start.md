Das Modell der Todo-Liste für die Kommandozeile steht schon: SRR und PDR sind bestanden, es ist der Stand des
Referenzlaufs. Arbeite jetzt die offenen Befunde ab, nach
dem folgenden Verfahren. Kein Code — nur das Modell.

Work the open findings of the live governed graph down to zero. graphcode computes the work list and the fix-context; you decide the semantic fit. **Done** means: `rules_evaluate` reports no error and no open warning. A finding that its carrier has accepted with a reason is not open.

## The work list

`rules_evaluate` `{ "detail": "grouped" }` — one group per rule: `count`, `message`, `fixHint`, `elementIds`. Read `skipped` as well: a rule that was not evaluated has not passed.

Order:
1. **Errors first** — they block every further write.
2. **Then warnings, upstream before downstream**: system, use cases, requirements and chains before functions, flows and modules, those before schemas and tests. A fix upstream often clears findings downstream; the reverse never happens.
3. Among rules of the same level: the one that fires most often.

**One rule per batch.** Fix the findings of one rule in one `graph_mutate` block, read the result, then take the next rule. A batch that mixes rules is harder to get through the gate and harder to repair when it is rejected.

## Three ways out of a finding — pick one, never a fourth

**1. Fix it in the model.** Follow the `fixHint`. For a missing trace, `rules_get_violations` `{ "ruleId": "<id>" }` carries `context.candidate_targets`, ranked by overlap — the top hit is usually right, but ranking is a hint, not truth: check that the edge makes semantic sense (does this TEST actually verify this REQ?).

```
## Edges
+ TEST-<slug> -verify-> REQ-<slug>
+ FUNC-<slug> -satisfy-> REQ-<other>
```

A duplicate (ND-01, ND-02) is merged, not deleted: `M <source> + <target>` under `## Merges`.

**2. Accept it with a reason** — only what the order deliberately leaves out: an analysis that was not commissioned (AF-01 … AF-05), or a finding the model cannot satisfy in this job. The reason says *why it is left out*, in the user's terms. The carrier is the element, or the system for a finding about the whole graph. The list is replaced on write — name every entry that should stay:

```
## Nodes
### SYS
~ SYS-<slug>
@acceptedFindings [{"ruleId":"AF-04","reason":"Fehlerbetrachtung ist in diesem Auftrag nicht beauftragt"}]
```

An accepted finding keeps showing in `rules_evaluate`; compare against `acceptedFindings` yourself before you call something open. Architecture rules are never accepted — solve them in the model.

**3. Ask the user** — when the fix needs a value or a decision the order does not contain: a limit, a format, which of two structures is meant. One question, the options, what each one changes. Then continue with the next rule while you wait.

Never: invent a value to fill a field · add a trace only because it clears the finding · create a TEST without target, tool and pass/fail criterion · delete an element because a rule complains about it · start an analysis nobody asked for.

## Model only, unless the job says build

Do not write `realRef` or `testRefs` in a job that is about the model. The first binding starts the build: from then on every unbound function, test and schema reports, and the list you were closing grows instead.

## Loop

1. Work list.
2. Take the first rule in the order above; choose the way out per finding.
3. One `graph_mutate` block for that rule. If the gate rejects it, the result names the new error — repair the batch, do not route around it.
4. Back to 1 until the list is empty, or only questions to the user remain.
5. Report in three lines: fixed, accepted (with the reasons), waiting for the user. Then `graph_export`.

**A REQ with no plausible verifying TEST is not well-formed** — author a real TEST with `se:author-req`, or flag the REQ for review. Never a fake trace, never a fake test.
