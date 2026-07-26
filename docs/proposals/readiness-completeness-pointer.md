# Proposal — Readiness completeness pointer (cardinality-driven)

**Status:** proposal · **Author:** andreas@siglochconsulting · **Date:** 2026-07-10
**Trigger:** graph-view-edit false-green (irr-3e4e26c A2/A12/A13, irr-session-2026-07-08).
**Touches:** `src/readiness.ts` (+ test). **No `@sigloch/contracts` change, no rule/severity edit.**

## 1. The hole (from the graph-view-edit log)

Draft phase closed with **0 FUNC, 0 FCHAIN, 0 FLOW, 0 MS** — yet SRR/PDR/CDR/TRR all reported
**green, score 1.0**. Three structural reasons, all confirmed against `readiness.ts` + `se/rules.ts`:

1. **Score = violation-severity only.** `scorePhaseGate` sets `passed` iff no *owned rule* fires an
   `error`. The chain-completeness rules R-14/R-15/R-17/R-10/R-02 are all **`warning`** → advisory →
   never touch the verdict.
2. **Per-element rules can't fire on absent elements.** R-15 ("FCHAIN has no functions") iterates
   *present* FCHAINs. **0 FCHAINs → R-15 fires 0×.** Absence reads as green. There is **no rule at
   all** asserting "every UC derives an FCHAIN."
3. **`concept:true` mutes the binding leg.** R-19/R-20 are silenced by the concept flag, so
   "56/56 REQ verified" traced to concept-TESTs pointing at nothing.

**Key fact:** the meta-model *already* mandates the chain via cardinality —
`UC -compose-> FCHAIN` = **`1..*`**, `UC→REQ` = `1..*`, `FCHAIN→FUNC` = `1..*`
(`contracts/src/se/meta-model.ts:25-27`). Readiness simply doesn't honor it.

## 2. Principle — completeness ≠ severity

Don't promote warnings to errors (that was the old failure mode: spec phase drowns in per-element
warnings). Instead add a **third readiness dimension orthogonal to violations**:

> **Structural completeness**, derived from the meta-model's own `1..*` cardinalities, measured over
> the **driving population**, aggregated as **one coverage number per gate** — not N warnings.

Warnings keep their severity and stay the fine-grained authoring hints. The **gate verdict** gains a
coverage invariant on top of the existing error check.

## 3. The pointer

For each phase gate, a **chain slice** = the `1..*` compose/verify legs that must be complete at that
phase. Coverage iterates the *source* population (so absence counts against the denominator):

| Gate | Chain slice (each source element must have ≥1 of target) | Driving population |
|---|---|---|
| **SRR** | `UC —compose→ FCHAIN` **and** `UC —compose→ REQ` | every UC |
| **PDR** | `FCHAIN —compose→ FUNC` · `FUNC —satisfy→ REQ\|UC` · `FUNC —allocate→ MOD` · **FCHAIN actor-bounded** | every FCHAIN, every FUNC |
| **CDR** | `REQ —verify← TEST` (structural; TEST may be `concept`) · **every `FLOW —relation→ SCHEMA`** · R-18/RD-* | every leaf REQ, every FLOW |
| **TRR** | binding: non-concept TEST has `testRef` (R-19), non-concept FUNC has `codeRef` (R-20) | realized TEST/FUNC |

**FCHAIN actor-bounded (PDR):** a behavioral chain is complete only if it has a trigger *and* a
consumer — `∃ ACTOR —io→ FLOW —io→ FUNC∈chain` (entry) **and** `∃ FUNC∈chain —io→ FLOW —io→ ACTOR`
(exit). Catches the "hollow chain" (functions with no who-triggers / who-consumes) directly.

**SCHEMA (CDR):** keys on the **FLOW** population, not the FUNC count. Two FUNCs exchanging data do
so via a FLOW; every FLOW must carry `FLOW —relation→ SCHEMA` (CR-GC-106 schema-before-code, closes
the `schema=0` dimension). A FUNC pair with no FLOW between them is not an interface yet → no schema
owed until the data path is drawn.

`concept:true` stays valid at SRR–CDR **by design** (spec allows unbound tests); it only stops
counting as *complete* at TRR. That is the correct phase boundary — spec vs. impl. Note: `concept`
gates the *TEST binding* leg only — the SCHEMA and actor-boundedness legs are structural and apply
in the spec phase.

## 4. Scorer change (`src/readiness.ts`)

- Extend `ReadinessGate` with `completeness: { covered: number; total: number; missing: string[] }`.
- New `scoreCompleteness(gateId, graph)` traverses the chain slice over the driving population.
- `passed = (rulesWithError.size === 0) && (completeness.total === 0 || completeness.covered === completeness.total)`.
- `blocking` gains **one aggregated line**:
  `"SRR completeness 2/5 — UCs without FCHAIN: UC-x, UC-y, UC-z"` (not one line per UC).
- `score = min(ruleScore, completeness.covered / completeness.total)` — the gate can't be green while
  a mandated leg is empty.

The completeness config is an explicit phase→slice map in `readiness.ts` (reads the meta-model
cardinalities as its source of truth). **No new V3_RULE, no severity flip → no contracts version
bump, no L1 family review.**

## 5. Why it doesn't drown the spec phase

- Warnings unchanged — R-14/R-15/RD-01 stay `warning`, still per-element hints on demand.
- Gate verdict driven by **one number per gate**. Authoring shows a coverage bar climbing 0→100 %,
  not 48 warnings.
- The "absence = green" hole is closed structurally: the denominator is the UC/FCHAIN population, so
  0 FCHAINs → 0/5 → SRR **red**. Exactly the signal graph-view-edit needed on day one.

## 6. Applied to the graph-view-edit draft (retro-check)

At draft close (v8, 47 REQ / 5 UC / 0 FCHAIN): **SRR completeness 0/5** → SRR RED, blocking
"5 UCs without FCHAIN." A2/A12 would have been a hard gate, not a hand-filed review record.

## 7. Scope (≤5 files)

1. `src/readiness.ts` — `completeness` field + `scoreCompleteness` + verdict wiring.
2. `src/readiness.test.ts` — 0-FCHAIN UC → SRR red; complete chain → green; concept-TEST green at
   CDR, red at TRR.
3. graph node `CR-GC-250` (self-model) + this proposal reference — **done** (v20): CR + 3 REQ
   + 3 verify-TEST + `FUNC-score-completeness` + reused `REQ-interface-schema`.
4. `docs/views/*` re-render (generated).

Open decision: land the completeness config as a static phase→slice map in `readiness.ts`, **or**
derive it live from `SE_DESCRIPTOR` meta-model cardinalities (`1..*` legs). Static = simpler + phase
control; derived = zero drift from the ontology. Recommend **static map, sourced-from + asserted
against the meta-model in the test** (drift-caught, phase-controlled).
