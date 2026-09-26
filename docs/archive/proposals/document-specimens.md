# Proposal — Document Specimens (one per artifact)

**Status:** Draft (2026-06-28) · **Branch:** `documents` · **Companion to:** [readiness-artifact-model.md](readiness-artifact-model.md)

> Purpose: a concrete specimen of **how each document looks**, so we can make a final decision per document.
> Specimens use real graphcode graph data (9 ACTOR · 9 SCHEMA · 9 MOD · 6 UC · 5 MS · 106 REQ · 37 FUNC ·
> 53 TEST · 35 CR). Each header declares: **standard** (INCOSE/SE vs graphcode-specific) · **operation**
> (RENDER deterministic / CREATE judgment) · **source**.

## Reclassified artifact list

**Don't call it INCOSE if it isn't.** Two groups:

### A — INCOSE / SE-standard artifacts (map to a recognized standard)

| # | Document | Standard | Operation | Source |
|---|---|---|---|---|
| 1 | Concept of Operations (ConOps) | ISO/IEC/IEEE 29148 | **CREATE+write** (cat IRR) | `se-conops` → operational REQ (config/creds/user-mgmt/deploy), authored **before UC** |
| 2 | System Requirements Spec (SRS) | 29148 | RENDER | REQ slice (functional) |
| 3 | NFR Register | 29148 §9 | RENDER | REQ `kind=non-functional` |
| 4 | Architecture / Design Description (SDD) | ISO/IEC/IEEE 42010 | RENDER | SYS/MOD/FUNC + allocate |
| 5 | Interface Control Document (ICD) | 15288 | RENDER | SCHEMA/FLOW + io |
| 6 | Requirements Traceability Matrix (RTM) | 29148 | RENDER | REQ × verify/satisfy/allocate |
| 7 | Test Concept / Test Plan | 29119 | RENDER | TEST + verify + level/tool |
| 8 | Verification Cross-Ref Matrix (VCRM) | 29119 | RENDER | REQ × TEST coverage |
| 9 | Integration & Test Plan | 15288 / 29119 | RENDER | MS chain + impl gates |
| 10 | FMEA | IEC 60812 / AIAG-VDA | **CREATE** (cat FMEA) | risk/mitigation REQ + S/O/D |
| 11 | Trade Study | INCOSE Handbook §6 | **CREATE** (cat IRR, multi-input) | spike/concept record → CR decision + relation edges |

### B — graphcode project artifacts (tool/PM-specific — NOT INCOSE)

| # | Document | Operation | Source |
|---|---|---|---|
| 12 | Model Spec (full graph dump) | RENDER | all elements by type (current `spec.md`) |
| 13 | Change Log | RENDER | CR rollup + audit_trail |
| 14 | Implementation Plan | **CREATE** (cat FMEA) | `se-plan` → MS/CR slices (judgment) |
| 15 | Assumption Review (was "IRR") | **CREATE** (cat IRR) | commit-pinned record → CRs |

`references.md` (raw trace dump) folds into #6 (RTM) as its source data — not a separate document.

---

# A — INCOSE / SE-standard

## 1. Concept of Operations — CREATE+write (cat IRR) · `se-conops` → operational REQ · **before UC**

ConOps establishes the **operational frame the use cases sit in** — the non-functional concerns that are
invisible in a function list (config, credentials, user management, deployment, …). It is authored
**before** the UCs are defined: each concern that applies is answered and written to the graph as an
operational `REQ` (through the gate); an unanswered concern is a blocking gap that feeds the Assumption Review.
```
# graphcode — Concept of Operations          (authored BEFORE the use cases)

## System context
SYS-graphcode — governed graph substrate, one Kuzu store per repo, headless, MCP-stdio.

## Operational concerns — the checklist (answered, not assumed)
| Concern             | Decision for graphcode                                 | → operational REQ        |
|---------------------|--------------------------------------------------------|--------------------------|
| Deployment          | npx @sigloch/graphcode init/update/remove, per-repo    | REQ-npx-distribution     |
| Configuration       | .graphcode/ + .mcp.json, repo-local; no global state   | REQ-repo-local-config    |
| Credentials / auth  | BYOK via OpenCode sidecar; no keys in graph/repo       | REQ-byok-no-secrets      |
| User management     | single repo-owner; author logged, not authenticated    | REQ-author-logged        |
| Persistence / backup| Kuzu on disk + git-committed graph.json (recoverable)  | REQ-graph-recoverable    |
| Concurrency         | single-writer; exactly one owner process per repo      | REQ-single-writer        |
| Monitoring / health | /health probe: store reachable + gate + versions       | REQ-health-probe         |
| Scaling             | embedded; 10k-node target (unproven → Assumption #1)   | REQ-scale-target         |

## Actors (9) — who operates / consumes
Entwickler/Repo-Owner · Claude Code · OpenCode · graphify · Learning-Engine · Browser-Dashboard ·
Facilitating-Agent · Systems-Engineer · Vibe-Coder
```
*Why CREATE+write:* each operational question is judgment; `se-conops` records the answer as an operational
REQ through the gate **before** UCs exist. Unanswered concern → blocking gap (not a silent omission).

## 2. System Requirements Spec (SRS) — RENDER · a **real specification document**, REQ grouped by UC/FUNC

Not a list — a specification (ISO/IEC/IEEE 29148 shape): front matter, then each REQ with **statement,
rationale, priority, status, source, verification method and full trace**, grouped under the UC/FUNC it
serves. Orphan REQs (no UC, no FUNC) are flagged.
```
# graphcode — System Requirements Specification · SRS-graphcode
Baseline @ commit ec4860b · Standard ISO/IEC/IEEE 29148 · 106 REQ · GENERATED from the graph (SSOT)

## 1  Scope
SYS-graphcode — a governed graph substrate (Bridge + Store + MCP surface), one Kuzu store per repo,
headless, agent-agnostic; a coding agent is a client. This SRS is the REQ-slice render of the live graph.

## 2  References
@sigloch/contracts/se (ontology + V3_RULES) · ADR-001 (goal & constraints) · Format-E codec spec.

## 3  Definitions
Apply-Gate · mutate() · Trace pattern (TRACE_PATTERNS) · Readiness gate (SRR/PDR/CDR/TRR).

## 4  Requirements
### 4.1  UC-code-quality — Exzellente, governte Code-Qualität
REQ-gate-only-writes          priority: must · status: done · source: ADR-001/AD-1
  Statement      The system SHALL route every model edit through mutate(); direct edits of the graph
                 SSOT SHALL be rejected.
  Rationale      One author-logged Apply-Gate; hand-edits break governance and provenance.
  Verification   TEST-deny-graph-write (unit) — a direct write attempt is blocked.
  Trace          satisfy ◀ FUNC-mutate · allocate ▶ MOD-bridge · verify ◀ TEST-deny-graph-write

REQ-structural-valid          priority: must · status: done · source: CR-GC-205
  Statement      Every trace's element-type pair SHALL be legal per TRACE_PATTERNS (engine rule R-18).
  Rationale      Structural validity is enforced by the engine, not prose-trusted.
  Verification   TEST-pair-valid (unit) — an illegal pair raises R-18.
  Trace          satisfy ◀ FUNC-eval-rules · verify ◀ TEST-pair-valid

### 4.2  UC-efficient-testing — Effizientes, impact-basiertes Testen
REQ-impact-precise            priority: must · status: done
  Statement      graph_impact SHALL return the exact blast-radius for a changed element.
  Verification   TEST-impact (integration).   Trace  satisfy ◀ FUNC-impact · verify ◀ TEST-impact

### 4.9  Cross-cutting / operational (from ConOps — no single UC)
REQ-single-store · REQ-npx-distribution · REQ-byok-no-secrets · REQ-graph-recoverable · …

## 5  Traceability summary
106 REQ · 104 verified (98 %) · 2 open (R-01) · 0 orphan.
```

## 3. NFR Register — RENDER · REQ kind=non-functional
```
# graphcode — Non-Functional Requirements

| NFR                 | Budget / constraint            | Verified |
|---------------------|--------------------------------|----------|
| REQ-impact-latency  | graph_impact P95 < 50 ms       | ✓        |
| REQ-mcp-result-size | tool result ≤ MCP limit        | ✓        |
| REQ-export-determin | export byte-identical re-run   | ✓        |
> GENERATED — REQ where attributes.kinds ∋ "non-functional".
```

## 4. Architecture / Design Description (SDD) — RENDER · SYS/MOD/FUNC/allocate
```
# graphcode — Architecture                              (SYS-graphcode · 9 MOD · 37 FUNC)

SYS-graphcode
├── MOD-bridge       harness + Apply-Gate          FUNC: mutate, evaluateRules, getGraph
├── MOD-store        Kuzu single-writer            FUNC: open, applyDelta, snapshot
├── MOD-mcp-tools    MCP-stdio surface             FUNC: graph_impact, graph_export, …
├── MOD-codec        Format-E round-trip           FUNC: importGraph, exportGraphJson
├── MOD-cli          npx distribution              FUNC: init, update, remove, skills-sync
├── MOD-docs         markdown re-export            FUNC: exportMarkdown
└── MOD-dashboard    read-only viewer              FUNC: artifactsPanel, readinessPanel

Allocation: 37/37 FUNC allocated to a MOD (R-12 module-size clean).
```
*OK as-is. Interim text tree — to be replaced by a graphical architecture view (Cytoscape, MOD-dashboard) later.*

## 5. Interface Control Document (ICD) — RENDER · SCHEMA/FLOW/io
```
# graphcode — Interface Control Document                (9 SCHEMA · 28 FLOW)

| Interface (SCHEMA) | Contract (Zod)                          | Producer → Consumer        |
|--------------------|-----------------------------------------|----------------------------|
| MutateCommand      | { ops: MutateOp[], author }             | client → MOD-bridge        |
| MutateResult       | { tier, applied, violations[] }         | MOD-bridge → client        |
| Format-E           | node/edge canonical text form           | MOD-codec ↔ disk           |
| OntologyGraph      | { nodes[], edges[] }                     | MOD-store ↔ MOD-codec      |
| UpdateEvent        | { domains[] } (SSE invalidate)          | host → Browser-Dashboard   |
> GENERATED — each SCHEMA carries its Zod def; FLOW complete iff both io-ends bound.
```

## 6. Requirements Traceability Matrix (RTM) — RENDER · REQ × verify/satisfy/allocate
```
# graphcode — RTM                                       (106 REQ rows)

| REQ                | verify (TEST)        | satisfy (FUNC)    | allocate (MOD) |
|--------------------|----------------------|-------------------|----------------|
| REQ-single-store   | TEST-store-single    | FUNC-open-store   | MOD-store      |
| REQ-gate-only      | TEST-deny-write      | FUNC-mutate       | MOD-bridge     |
| REQ-doc-export     | TEST-export-determin | FUNC-export-md    | MOD-docs       |
| REQ-orphan-example | ⚠ R-01 no verify     | —                 | —              |
> Coverage gap = R-01 (REQ without verify). Rows sorted by uid.
```

## 7. Test Concept / Test Plan — RENDER · **test pyramid by model level (System/UC/Function)**

The document is a **pyramid mapped to the model hierarchy**, not a flat tool list. The tip — E2E / System
level — is where coverage always dies; the render **computes** the System row so a missing end-to-end test
**cannot hide**. Make the gap loud.
```
# graphcode — Test Concept                              (53 TEST — pyramid by model level)

              ╱╲
             ╱E2╲          System level · SYS-graphcode
            ╱ E  ╲         ✗ 0 tests — NO end-to-end run exists.  ← GAP, always missing
           ╱──────╲
          ╱  UC /   ╲       Use-case level · 6 UC
         ╱integration╲      ⚠ 3 / 6 UC exercised by a scenario test
        ╱────────────╲
       ╱  Function /   ╲     Function level · 37 FUNC
      ╱      unit       ╲    ✓ 37 / 37 FUNC unit-covered
     ╱───────────────────╲

| Level     | Element            | Test kind   | Tests | Coverage        | Verdict                    |
|-----------|--------------------|-------------|-------|-----------------|----------------------------|
| System    | SYS-graphcode (1)  | E2E         | 0     | 0 / 1           | ✗ MISSING — must be added  |
| Use-case  | UC (6)             | integration | 21    | 3 / 6 scenario  | ⚠ 3 UC have no e2e path    |
| Function  | FUNC (37)          | unit        | 24    | 37 / 37         | ✓                          |
| (support) | —                  | conformance | 8     | codec round-trip| ✓                          |

E2E truth: a real end-to-end test drives `npx init → mutate → export → reseed → readiness` against a live
on-disk Kuzu store and asserts the round-trip. graphcode has NONE — the pyramid is inverted at the top.
> GENERATED — TEST.level mapped to SYS/UC/FUNC; System & UC rows are derived from coverage, so missing
> E2E / untested UCs surface as ✗/⚠ instead of being silently absent. R-19: runnable TEST carries testRef.
```

## 8. Verification Cross-Reference Matrix (VCRM) — RENDER · REQ × TEST
```
# graphcode — VCRM (coverage)

                       TEST-store-single  TEST-deny-write  TEST-export-determin  …
REQ-single-store            ✓
REQ-gate-only                                   ✓
REQ-doc-export                                                    ✓
Coverage: 104/106 REQ verified (98%) · 2 open (R-01).
```

## 9. Integration & Test Plan — RENDER · MS chain + impl gates
```
# graphcode — Integration & Test Plan                   (5 MS · impl-gates)

Tier order:  M1 ──▶ M2 ──▶ M3 ──▶ M4 ──▶ M5      (depends-on)
| Gate | Milestone          | passed | blocking                    |
|------|--------------------|--------|-----------------------------|
| SAR  | MS-1-specification | ✓      | —                           |
| FCA  | MS-2-coding-vv     | ✓      | —                           |
| SVR  | MS-3-mvp-readiness | ✓      | —                           |
| FRR  | MS-4-mvp2          | ✗      | CR-GC-216 open · CR-GC-217  |
> GENERATED — renders the milestones/CRs the Impl Plan created. Originates nothing.
```

## 10. FMEA — CREATE (cat FMEA) · risk/mitigation REQ + S/O/D → graph
```
# graphcode — FMEA (AIAG-VDA, functional risk)

| Failure mode (REQ kind=risk)        | S | O | D | AP   | Mitigation (REQ kind=mitigation) | verify |
|-------------------------------------|---|---|---|------|----------------------------------|--------|
| Second DB handle corrupts store     | 9 | 3 | 4 | High | REQ-single-writer-lock           | ✓      |
| Stale dist → false-green tests      | 7 | 5 | 6 | High | REQ-ensure-siblings-built        | ✓      |
| Non-deterministic export → doc drift| 6 | 4 | 3 | Med  | REQ-export-determinism           | ✓      |
> CREATE: se-fmea mutates the graph with risk/mitigation REQ + S/O/D attrs. AP Severity-first.
> Render of this table is deterministic once the REQs exist.
```

## 11. Trade Study — CREATE (cat IRR, multi-input) · spike/concept record → CR decision + relation edges

**How (pragmatic — reuse what we already do):** a trade study *is* a spike or concept discussion with ≥2
options. Run it, record the option×criteria comparison in `docs/spikes/` (or `docs/records/`), pick one.
**Where it's archived in the graph:** the **decision** lands in a **CR** (`## Problem → ## Decision`, the
why) — the CR is the graph node. The chosen approach gets `relation(label='decides')`; rejected approaches
that exist as nodes get `relation(label='superseded-by')`. The spike doc is the evidence pointer. **No new
element type** — exactly the SP-1 pattern (the store-query concept record, kept internally).
```
# Trade Study: Store engine        (= SP-1 spike + decision, archived in CR-GC-1xx)

Inputs (multiple) — docs/spikes/sp1-store-query-concept.md:
| Option        | Embeddable | Cypher | Single-writer | Measured P95 | Verdict   |
|---------------|-----------|--------|---------------|--------------|-----------|
| Kuzu          | ✓         | ✓      | ✓             | 12 ms        | ✔ chosen  |
| SQLite + graph| ✓         | ✗      | ✓             | —            | rejected  |
| Neo4j embed   | △         | ✓      | ✗             | —            | rejected  |

Archived as:  CR-GC-1xx (decision + why)
                 ├─ relation(decides) ─────────▶ REQ-single-store
                 └─ evidence ─────────────────▶ docs/spikes/sp1-store-query-concept.md
> Render se-view:trade = walk relation(label ∈ {alternative, superseded-by, decides}) + CR status.
> The comparison matrix stays in the spike; only the decision + links live in the graph.
```

---

# B — graphcode project artifacts (not INCOSE)

## 12. Model Spec (full graph dump) — RENDER · all elements by type
```
# GraphCode — Modell-Spezifikation                      (current spec.md, GENERATED)

## SYS (1)   | SYS-graphcode | … |
## UC (6)    | UC-code-quality | … |
## REQ (106) | REQ-single-store | … |
## FUNC (37) | …
> graphcode-specific: dumps EVERY element type by uid. Not an SRS (which is the REQ slice, #2).
```

## 13. Change Log — RENDER · CR rollup + audit_trail
```
# graphcode — Change Log

By milestone:  M4 → CR-GC-216 (open), CR-GC-217 (done) …   |  35 CR total: 33 done · 2 open
Recent applied mutations (audit_trail):
  2026-06-21  claude-code   add-edge verify ×3        auto-apply
  2026-06-21  claude-code   add-node REQ-…            auto-apply
> GENERATED — CR nodes by status + audit trail. Never a hand-maintained CHANGELOG.
```

## 14. Implementation Plan — CREATE (cat FMEA) · `se-plan` → MS/CR, **leaf → root**

Realization climbs the decomposition: build the **leaves first** (low-level FUNC/REQ), then integrate
upward (FCHAIN → UC → SYS). **Tests follow the same climb, and the pyramid narrows** — you do NOT test
every node, only where coverage isn't already carried higher up. *"You might never need all of them."*
```
# graphcode — Implementation Plan (se-plan)             leaf ▲ root

Lvl 4 · Leaves     FUNC/REQ            build first       test: UNIT (one per leaf — many)
  CR-GC-100  FUNC-mutate · FUNC-open-store · FUNC-eval-rules     TEST-* unit         ≤5 files  [no dep]
  CR-GC-101  FUNC-impact · FUNC-expand · graph_* tools           TEST-* unit         ≤5 files  ◀ 100
Lvl 3 · Chains     FCHAIN              integrate leaves  test: INTEGRATION (fewer)
  CR-GC-103  FCHAIN-apply-gate  (mutate ▸ evaluate ▸ persist)    TEST-gate-integ     ≤5 files  ◀ 101
Lvl 2 · Use cases  UC                  integrate chains  test: ACCEPTANCE / scenario (fewer still)
  CR-GC-116  UC-code-quality end-path                            TEST-uc-quality     ≤4 files  ◀ 103
Lvl 1 · System     SYS                 integrate all     test: E2E (one — the tip)
  CR-GC-2xx  npx init ▸ mutate ▸ export ▸ reseed ▸ readiness     TEST-e2e            ≤3 files  ◀ 116

depends-on:  100 ◀ 101 ◀ 103 ◀ 116 ◀ 2xx      (no CR before its leaves — se-plan rejects forward-deps)

Test economy — "never all of them": once TEST-gate-integ exercises mutate+evaluate+persist together, the
unit tests for the trivial glue FUNCs are redundant → drop them. One E2E at the tip covers the whole
init→readiness path; you don't re-test each level's happy path below it. Test where the risk is, per level.
> CREATE: the leaf→root cut + level assignment + which tests to keep is judgment. se-plan emits MS/CR + the
> depends-on chain; the test-level mapping mirrors the pyramid (#7).
```

## 15. Assumption Review (was "IRR") — CREATE (cat IRR) · commit-pinned → CRs
```
# graphcode — Assumption Review @ ec4860b                (immutable snapshot)

Open / unproven assumptions detected in the model at this commit:
| # | Assumption (unproven)                                   | Evidence? | → Promotion       |
|---|---------------------------------------------------------|-----------|-------------------|
| 1 | kuzu-wasm query latency acceptable at 10k nodes         | none      | CR-GC-…  (spike)  |
| 2 | OpenCode sidecar BYOK covers all client auth modes      | partial   | CR-GC-…           |
| 3 | Format-E round-trip lossless for nested attributes      | ✓ R-219   | closed            |
> CREATE: judgment — finds claims lacking evidence. Pinned to commit ec4860b, never re-rendered.
> Each open assumption is promoted to a CR → then indirectly tracked in the graph.
```

---

## Decision needed (per document)

For each of the 15: **keep / drop / rename**, and for the 9 currently skill-only renders (#1,3,5,6,7,8,9
+ conops/trade as render-after-create), confirm they move to deterministic `MarkdownView` exports. My
recommendation: keep all 15; rename "IRR"→"Assumption Review" (#15) to stop implying INCOSE; the SRS (#2)
and Model-Spec (#12) are **distinct** documents (REQ-slice vs full dump) — don't merge them.
