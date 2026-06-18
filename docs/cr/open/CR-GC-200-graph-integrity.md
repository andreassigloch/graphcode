# CR-GC-200: Single graph-validator — uniqueness + de-dup the validation logic

**Status:** Open · **Milestone:** `MS-3-mvp-readiness` (safety net) · **Datum:** 2026-06-18 · **Max Files:** 5
**Graph (SSOT):** realizes `+REQ-graph-integrity` (constraint, refines `REQ-graph-is-ssot`) + `+TEST-graph-integrity`; touches `MOD-codec`. *(graph nodes queued for the graph-owner chat — single-writer discipline; do not add from two chats.)*

## Problem (Why)
The same validation logic was re-implemented in several places — the first cut of `tests/graph-integrity.test.ts` and **every** ad-hoc graph-mutation script this session inlined a copy of `SE_DESCRIPTOR.edgeTypes` `validPairs`. That is a parallel path (CLAUDE.md "keine parallelen Pfade"): when the ontology changes, the copies drift. The duplication is itself a symptom of editing the JSON outside the gate (see CR-GC-201).

The **canonical validator already exists**: `GraphCodeCodec.validate()` (CR-GC-103) checks node types, edge types, valid pairs, **and referential integrity** (`"Edge references unknown source/target node"`). The only invariant it misses is **duplicate UIDs** (the `nodeTypeMap` silently dedupes) — the exact collision that produced two CR-GC-119s.

## Decision
One validation path. 
1. **Add duplicate-UID detection to `GraphCodeCodec.validate()`** — so the gate (`encode`/`mutate` already call `validate`), the codec, and any test get it from one place. Do NOT add it to the test.
2. **Expose a shared `json ↔ Graph` projection** (elements/traces ↔ nodes/edges) so the test/import/exporter stop re-mapping by hand.
3. **Refactor the mutation scripts / future graph edits** to validate via `codec.validate()` (or go through the gate, CR-GC-201) — never an inlined `validPairs`.
4. The integrity test (`tests/graph-integrity.test.ts`) **delegates** to `validate()` (already done in this CR's commit) and gains uniqueness for free once step 1 lands.

## Akzeptanz
`validate()` flags duplicate UIDs (unit test) + everything it already covered; `grep -rn "validPairs" src scripts tests` shows no hand-rolled copy outside graph-api-core/codec; integrity test green.

## Dependencies
CR-GC-103 (codec, done). Reinforced by CR-GC-201 (gate-only writes).
