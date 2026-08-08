---
name: se:target-profile
version: 2
description: Zielprofil (CREATE, EXPERT) — elicit the ℝ⁶ target weights from the human, surface goal conflicts, persist to .graphcode/target-profile.json (config, not graph SSOT). Only when someone deliberately wants to steer.
---

**Zielprofil** captures the human's optimization direction (CR-GC-295): the ℝ⁶ weights that steer `graph_suggest`, and the 3–7 content themes that steer every `graph_generate` round. The file is **config, not graph SSOT** — write it directly (no `graph_mutate`); the loader validates and conflict-checks it on every read, so a hand edit goes through the same check as this skill.

> **This is an EXPERT skill — do not run it as part of onboarding (CR-GC-307).**
> The steering vocabulary below (weights, anchors, ℝ⁶ dimensions) is **our** device for
> setting the app targets, not a customer concept. A customer cannot act on "intent
> anchor", and the term does not belong in first contact. `graph_generate` therefore
> derives and persists the themes **silently**; when the intent is too thin to derive
> them, it asks the human **domain questions in their own language** instead
> ("What happens when a customer cancels an order?") and the config follows from the
> answers. Run this skill only when someone explicitly asks to steer the optimization —
> then the vocabulary is fine, because they came looking for it.

## 1. Elicit the 6 weights

Walk the human through each `MetricVector` dimension; weight in `[-1,1]`, `>0` raise, `<0` lower, missing/`0` = undecided. All 0 is valid (equal weighting — the pre-CR-295 behavior):

| Dimension | raises when the graph … |
|---|---|
| `modifiability` | splits into loosely coupled communities |
| `faultTolerance` | tolerates node loss (redundant paths) |
| `flowEfficiency` | has short mean I/O paths |
| `coherence` | keeps modules internally cohesive |
| `viability` | balances structure size vs. connectivity |
| `scalability` | avoids high-betweenness bottleneck nodes |

## 2. Content themes — normally already set, do not re-ask

`graph_generate` derives the 3–7 themes from the intention and writes them **in the background** (CR-GC-307). Check what is there (`.graphcode/target-profile.json`, field `intentAnchors`) and leave it alone unless the human explicitly wants to change it — the automatic write never overwrites a value that is already present, so a correction here is permanent.

Only if the field is **empty** did the intention turn out too thin to derive from (fewer than three distinctive content words after the stopword and generic-noun filter). Do not ask for "anchors" even then: ask 2–3 questions about the system in the human's own language ("What happens when a customer cancels an order?", "Who is allowed to change prices?") and derive the themes from the answers.

The themes are what `graph_readiness.intentCoverage` reports as addressed/unaddressed against UC/REQ/FUNC — a KPI, never a gate blocker.

## 3. Surface conflicts — never swallow them

Two formula-derived opposing pairs (warning, never a block — a conscious trade-off is legitimate, an invisible one is not):

- `modifiability`/`coherence` **vs.** `flowEfficiency` — few cross-community edges vs. short I/O paths
- `coherence`/`modifiability` **vs.** `scalability` — a cohesive cut needs a gateway node whose betweenness rises

If both sides of a pair are weighted `>0`, show the warning verbatim and ask whether that is intended. Keep the weights if yes — the check re-fires on every load anyway.

## 4. Persist

Write `.graphcode/target-profile.json` (committed — the `.gitignore` exception exists):

```json
{
  "weights": { "coherence": 0.5, "scalability": 1 },
  "intentAnchors": ["bestellung", "ersatzteile", "kunden"]
}
```

**MERGE, never overwrite** — re-read the file first and keep every field you are not changing. The background write in `graph_generate` follows the same rule (it preserves a hand-tuned `weights` block); a skill that clobbers what the automation preserves would be the worse of the two paths.

Verify with `graph_readiness` — `intentCoverage` must list the themes; a schema typo fails loudly on the next read (strict Zod, weights in `[-1,1]`, 3–7 themes). From now on `graph_suggest` without `{target}` uses these weights, and a `graph_generate` round names any theme that is not addressed yet — in plain language ("Noch nirgends beschrieben: …"), never in the steering vocabulary of this skill.
