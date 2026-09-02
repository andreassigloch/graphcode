---
name: se:target-profile
version: 2
description: Zielprofil (CREATE, EXPERT) — elicit the ℝ⁶ target weights and goal values from the human, surface goal conflicts, persist to .graphcode/target-profile.json (config, not graph SSOT). Only when someone deliberately wants to steer.
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

> **Only the direction steers, not the magnitude (CR-GC-353).** `suggestEdits` L2-normalizes
> the vector before it ranks, so `{ scalability: 1 }` and `{ scalability: 0.2 }` produce the
> **identical** ranking. A weight is therefore not an intensity — it only means something in
> **relation to the other dimensions**: `{ coherence: 1, scalability: 0.5 }` says "coherence
> counts twice as much as scalability", and scaling both by any factor changes nothing. Do
> not let the human read `0.2` as "a bit" and `1` as "a lot" of the same wish.

| Dimension | raises when the graph … |
|---|---|
| `modifiability` | splits into loosely coupled communities |
| `faultTolerance` | tolerates node loss (redundant paths) |
| `flowEfficiency` | has short mean I/O paths |
| `coherence` | keeps modules internally cohesive |
| `viability` | balances structure size vs. connectivity |
| `scalability` | avoids high-betweenness bottleneck nodes |

## 2. Elicit a goal VALUE for each weighted dimension (CR-GC-457)

A weight says *which way* and *how much it counts against the others*. It does **not** say where to land, and it is not on the metric scale — writing "raise (1.0)" beside a current value of `3.71` reads as "lower to 1.0" and means the opposite. So ask for the goal separately, in `values`, on the **same 0–5 scale** `metrics()` produces.

Anchor every question in the number the repo is at today. Read it once from `graph_metrics` (`fit.metrics`) and ask per dimension:

> "Coherence is at **3.71** of 5 today. Where do you want it?"

- Ask **only for dimensions the human weighted** — a goal without a steering intent is a number with no consequence.
- A goal below the current value is legitimate (`scalability` deliberately lowered when the repo *wants* a hub) — but then the weight must be negative too. If the two disagree, `graph_metrics.fit.target.inconsistent` names the dimension on every read; resolve it here rather than shipping it.
- Leaving `values` out entirely stays valid. The consumer then shows the current value without a goal marker — never an invented 2.5 midpoint.

```json
{ "weights": { "coherence": 1, "scalability": -0.2 },
  "values":  { "coherence": 4.5, "scalability": 3.5 } }
```

`values` steers nothing: `graph_suggest` ranks against `weights` alone, exactly as before.

## 3. Content themes — normally already set, do not re-ask

`graph_generate` derives the 3–7 themes from the intention and writes them **in the background** (CR-GC-307). Check what is there (`.graphcode/target-profile.json`, field `intentAnchors`) and leave it alone unless the human explicitly wants to change it — the automatic write never overwrites a value that is already present, so a correction here is permanent.

Only if the field is **empty** did the intention turn out too thin to derive from (fewer than three distinctive content words after the stopword and generic-noun filter). Do not ask for "anchors" even then: ask 2–3 questions about the system in the human's own language ("What happens when a customer cancels an order?", "Who is allowed to change prices?") and derive the themes from the answers.

The themes are what `graph_readiness.intentCoverage` reports as addressed/unaddressed against UC/REQ/FUNC — a KPI, never a gate blocker.

## 4. Surface conflicts — never swallow them

Two formula-derived opposing pairs (warning, never a block — a conscious trade-off is legitimate, an invisible one is not):

- `modifiability`/`coherence` **vs.** `flowEfficiency` — few cross-community edges vs. short I/O paths
- `coherence`/`modifiability` **vs.** `scalability` — a cohesive cut needs a gateway node whose betweenness rises

If both sides of a pair are weighted `>0`, show the warning verbatim and ask whether that is intended. Keep the weights if yes — the check re-fires on every load anyway.

## 5. Persist

Write `.graphcode/target-profile.json` (committed — the `.gitignore` exception exists):

```json
{
  "weights": { "coherence": 0.5, "scalability": 1 },
  "values": { "coherence": 4.5, "scalability": 4 },
  "intentAnchors": ["bestellung", "ersatzteile", "kunden"]
}
```

**MERGE, never overwrite** — re-read the file first and keep every field you are not changing. The background write in `graph_generate` follows the same rule (it preserves a hand-tuned `weights` block); a skill that clobbers what the automation preserves would be the worse of the two paths.

Verify with `graph_readiness` — `intentCoverage` must list the themes; a schema typo fails loudly on the next read (strict Zod: weights in `[-1,1]`, goal values in `[0,5]`, 3–7 themes). From now on `graph_suggest` without `{target}` uses these weights, and a `graph_generate` round names any theme that is not addressed yet — in plain language ("Noch nirgends beschrieben: …"), never in the steering vocabulary of this skill.
