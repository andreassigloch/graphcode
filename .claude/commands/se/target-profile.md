---
name: se:target-profile
version: 3
description: Themen der Intention (EXPERT) — check or correct the 3–7 content themes in .graphcode/target-profile.json (config, not graph SSOT). Weights, goal values and goal conflicts are gone (CR-GC-861). Only when someone deliberately asks.
---

**The profile file** holds the 3–7 content themes that steer every `graph_generate` round (CR-GC-295, CR-GC-307). The file is **config, not graph SSOT** — write it directly (no `graph_mutate`); the loader validates it on every read, so a hand edit goes through the same check as this skill.

Weights and goal values are gone (CR-GC-861, part of CR-GC-853): they steered nothing since CR-GC-483. A decision about the architecture is a constraint in the model — a non-functional REQ with its TEST (CR-GC-804) — not a number in this file. A file that still carries `weights` or `values` fails loudly on the next read.

> **This is an EXPERT skill — do not run it as part of onboarding (CR-GC-307).**
> "Intent anchor" is **our** device, not a customer concept. A customer cannot act on it,
> and the term does not belong in first contact. `graph_generate` therefore derives and
> persists the themes **silently**; when the intent is too thin to derive them, it asks
> the human **domain questions in their own language** instead ("What happens when a
> customer cancels an order?") and the config follows from the answers. Run this skill
> only when someone explicitly asks to see or change the themes.

## 1. Content themes — normally already set, do not re-ask

`graph_generate` derives the 3–7 themes from the intention and writes them **in the background** (CR-GC-307). Check what is there (`.graphcode/target-profile.json`, field `intentAnchors`) and leave it alone unless the human explicitly wants to change it — the automatic write never overwrites a value that is already present, so a correction here is permanent.

Only if the field is **empty** did the intention turn out too thin to derive from (fewer than three distinctive content words after the stopword and generic-noun filter). Do not ask for "anchors" even then: ask 2–3 questions about the system in the human's own language ("What happens when a customer cancels an order?", "Who is allowed to change prices?") and derive the themes from the answers.

The themes are what `graph_readiness.intentCoverage` reports as addressed/unaddressed against UC/REQ/FUNC — a KPI, never a gate blocker.

## 2. Persist

Write `.graphcode/target-profile.json` (committed — the `.gitignore` exception exists):

```json
{
  "intentAnchors": ["bestellung", "ersatzteile", "kunden"]
}
```

**MERGE, never overwrite** — re-read the file first and keep every field you are not changing. The background write in `graph_generate` follows the same rule.

Verify with `graph_readiness` — `intentCoverage` must list the themes; a schema typo fails loudly on the next read (strict Zod: 3–7 themes, no other field). From now on a `graph_generate` round names any theme that is not addressed yet — in plain language ("Noch nirgends beschrieben: …"), never in the vocabulary of this skill.
