# CR-GC-200: Single graph-validator — uniqueness + de-dup the validation logic

**Status:** Done (2026-06-21) · **Milestone:** `MS-3-mvp-readiness` (safety net) · **Datum:** 2026-06-18 · **Max Files:** 5

> **Close-Befund (2026-06-21):** (1) **Duplikat-UID-Erkennung** in `GraphCodeCodec.validate()` — die `nodeTypeMap` dedupte still; jetzt zählt `validate()` UIDs + flaggt Kollisionen (`tests/codec.validation.test.ts` (c2)). (5) **Gate-Enforcement:** `mutate()` ruft jetzt `codec.validate()` vor `persist()` mit Delta-Semantik (Step 3b) — strukturell ungültige Mutationen (TRACE_PATTERNS-Pair, Duplikat-UID) werden **atomar am Gate** abgelehnt (`success:false`, in-memory rolled back, Store unverändert), statt mitten im Kuzu-DDL zu werfen (Partial-Persist). **Genau die Fehlerklasse, die in dieser Session den Drift-Recovery erzwang** (`CR -relation-> TEST` brach mid-persist) — jetzt strukturell unmöglich. `validPairs` nur noch im Codec (kein hand-rolled copy; grep clean). Neue Tests: `harness.gate.test.ts` (d) atomic structural reject. `REQ-graph-integrity`/`TEST-graph-integrity` → done. 144/144 grün; **SVR 0.8→1.0**.
**Graph (SSOT):** realizes `+REQ-graph-integrity` (constraint, refines `REQ-graph-is-ssot`) + `+TEST-graph-integrity`; touches `MOD-codec`. *(graph nodes queued for the graph-owner chat — single-writer discipline; do not add from two chats.)*

## Problem (Why)
The same validation logic was re-implemented in several places — the first cut of `tests/graph-integrity.test.ts` and **every** ad-hoc graph-mutation script this session inlined a copy of `SE_DESCRIPTOR.edgeTypes` `validPairs`. That is a parallel path (CLAUDE.md "keine parallelen Pfade"): when the ontology changes, the copies drift. The duplication is itself a symptom of editing the JSON outside the gate (see CR-GC-201).

The **canonical validator already exists**: `GraphCodeCodec.validate()` (CR-GC-103) checks node types, edge types, valid pairs, **and referential integrity** (`"Edge references unknown source/target node"`). The only invariant it misses is **duplicate UIDs** (the `nodeTypeMap` silently dedupes) — the exact collision that produced two CR-GC-119s.

**Second gap, surfaced 2026-06-19 (CR-GC-125):** structural validity is not enforced *at the gate*. `mutate()` runs only `V3_RULES` (semantic completeness) — it does **not** call `validate()` (only `encode` does). A structurally-invalid edge (`SCHEMA -relation-> REQ` — no such `TRACE_PATTERNS` pair) therefore passed the gate, applied in-memory, and only threw at **Kuzu persist** (the typed REL-TABLE DDL rejects it mid-transaction → *partial persist*, in-memory ≠ store, requiring a re-seed to recover) and again at **export** (`codec.validate`). Three enforcement points, the authoritative one — the gate — skipped. Both the Kuzu DDL (`schema-generator.ts`) and the codec `validPairs` derive from the **same** contracts `TRACE_PATTERNS`, so this is **not a forked rule** — it is the gate not running the one validator. Kuzu's typed DDL is the storage layer of that one ontology (a free backstop), not a second opinion.

## Decision
One validation path, enforced at one point — the gate.
1. **Add duplicate-UID detection to `GraphCodeCodec.validate()`** — so the codec, the gate (once step 5 lands), and any test get it from one place. Do NOT add it to the test. (`encode` already calls `validate`; `mutate` does **not** yet — that is step 5.)
2. **Expose a shared `json ↔ Graph` projection** (elements/traces ↔ nodes/edges) so the test/import/exporter stop re-mapping by hand.
3. **Refactor the mutation scripts / future graph edits** to validate via `codec.validate()` (or go through the gate, CR-GC-201) — never an inlined `validPairs`.
4. The integrity test (`tests/graph-integrity.test.ts`) **delegates** to `validate()` (already done in this CR's commit) and gains uniqueness for free once step 1 lands.
5. **The Apply-Gate runs `codec.validate()` before `persist()`** — same contracts SSOT, same delta-semantics as the `V3_RULES` check (block only on a *structural* error THIS mutation introduces, so pre-existing debt does not freeze the graph). Structurally-invalid edges are then rejected at the gate, atomically (in-memory rolled back, nothing persisted); Kuzu's typed DDL + the export check become redundant *backstops* that should never fire. `V3_RULES` (semantic) and `TRACE_PATTERNS` (structural) stay two **layers** of one ontology with a **single enforcement point**. *(If the 5-file budget is exceeded, split step 5 into CR-GC-200b — gate-runs-validate — leaving 1–4 here.)*

## Akzeptanz
`validate()` flags duplicate UIDs (unit test) + everything it already covered; `grep -rn "validPairs" src scripts tests` shows no hand-rolled copy outside graph-api-core/codec; integrity test green. **Gate enforcement:** a structurally-invalid mutation (e.g. `SCHEMA -relation-> REQ`) is rejected by `mutate()` with `success:false` and the in-memory graph **and** the store unchanged (atomic — no partial persist), never surfaced as a Kuzu error mid-transaction.

## Dependencies
CR-GC-103 (codec, done). Reinforced by CR-GC-201 (gate-only writes). Step 5 touches `MOD-harness` (`mutate`) in addition to `MOD-codec`.
