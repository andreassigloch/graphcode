---
name: se:target-profile
version: 1
description: Zielprofil (CREATE) — elicit the ℝ⁶ target weights + intent anchors from the human, surface goal conflicts, persist to .graphcode/target-profile.json (config, not graph SSOT)
---

**Zielprofil** captures the human's optimization direction (CR-GC-295): the ℝ⁶ weights that steer `graph_suggest`, and the 3–7 intent anchors that steer every `graph_generate` round. The file is **config, not graph SSOT** — write it directly (no `graph_mutate`); the loader validates and conflict-checks it on every read, so a hand edit goes through the same check as this skill.

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

## 2. Confirm the intent anchors

Read the intention (`graph_elements {type: "SYS"}` → its `description`; on a cold start use the prose the human just gave). Propose the deterministic defaults from the seed prompt (or extract yourself: content words of the intention, ≤7) and let the human **confirm, drop, or add** until 3–7 anchors stand. Anchors are the content themes the graph must address — `graph_readiness.intentCoverage` reports each one as addressed/unaddressed against UC/REQ/FUNC.

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

Verify with `graph_readiness` — `intentCoverage` must list the anchors; a schema typo fails loudly on the next read (strict Zod, weights in `[-1,1]`, anchors 3–7). From now on `graph_suggest` without `{target}` uses these weights, and every `graph_generate` round carries the unaddressed-anchor line.
