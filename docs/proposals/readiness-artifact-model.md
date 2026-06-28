# Proposal — Updated Phase Gates, Implementation Gates & Artifacts

**Status:** Draft (2026-06-28) · **Branch:** `documents` · **Author:** andreas@siglochconsulting + Claude
**Supersedes (on accept):** CR-GC-125 readiness model's `lean = no artifacts` stance.
**Realizes as:** a CR chain (see §7) — this proposal is the design note, not yet the change.

> Scope: redefine how `src/readiness.ts` scores the four phase gates and four impl gates, and what the
> INCOSE artifact tab (`artifactsPanel`, `src/viewer/panels.ts`) shows — so that **judgment work
> (ConOps, FMEA, IRR, Trade, Plans) becomes a gate precondition**, not an invisible omission.

## 1. Problem (Why)

Today readiness is scored **only** from `@sigloch/contracts` V3_RULES (`computeReadiness`). Two consequences:

1. **Rule-green ≠ analysis-done.** A phase gate passes iff its owned element-rules fire no error. The graph
   can be perfectly rule-clean while the **FMEA was never performed**, the **operational concept (ConOps)
   was never authored**, and **no one reviewed the unproven assumptions (IRR)**. The gate is blind to it.
2. **`lean = no artifacts` is now wrong.** CR-GC-125 declared "the graph IS the single SE artifact; no
   separate deliverables; FMEA out of scope." But the artifact tab already lists 10 INCOSE artifacts, and
   FMEA/IRR/ConOps are real **creation** tasks, not optional ASIL evidence.

## 2. The rule — create vs render (the determinism test)

Every artifact is exactly one of two operations. The test: **does the artifact originate content, or
re-project content that already entered the model another way?**

- **RENDER** — a deterministic projection of existing graph structure. No judgment, no new knowledge.
  Re-derivable by `exportMarkdown`. *Non-deterministic rendering is a defect.* Staleness = file mtime <
  graph mtime → fixed by **re-export** (mechanical).
- **CREATE** — the artifact is the **entry point** through which its content first enters the model
  (judgment). Cannot be auto-derived. Staleness = the analyzed scope moved → fixed by **re-analysis**
  (an agent/human), never a re-export.

Two creation styles:

- **category IRR** — authored as an immutable, commit-pinned record (`docs/records/`), then promoted to
  **CRs** → *indirectly* in the graph. Used when the output is narrative judgment: **IRR** (unproven
  assumptions), **ConOps** (operational concept).
- **category FMEA** — the analysis **mutates the graph directly** (risk/mitigation `REQ` + S/O/D
  attributes). Used when the output is structured graph content: **FMEA** (functional risk).

## 3. Updated INCOSE scope — `lean`, refined

`lean` is kept, but redefined:

> The graph remains the SSOT. **RENDER** artifacts are deterministic projections of it — not separate
> authored deliverables (this is what `lean` always meant). **CREATION** artifacts are the judgment inputs
> the gates *require*: their performance is a gate precondition and their freshness is tracked in the
> artifact tab. FMEA and IRR move from "out of scope" to **in scope as lightweight creations** (no ASIL-D
> isolation evidence, no automotive full-evidence package — that stays `full`-scope, still not graphcode).

## 4. Updated Phase Gates (SRR/PDR/CDR/TRR)

Each gate gains a **second condition**. `passed` becomes:

> `passed = rule-clean (all owned V3_RULES error-free)  AND  artifacts-current (every required CREATION
> artifact is 🟢)`

The rule set per gate is unchanged (still a disjoint+exhaustive partition of the 15 element rules); the
**creation artifacts** column is new.

| Gate | Owned rules (RENDER/structural check — unchanged) | Required creations (NEW judgment check) | Render artifacts surfaced |
|---|---|---|---|
| **SRR** System Requirements Review | R-17, R-14, R-01 | **ConOps**, **IRR** | spec, nfr, references |
| **PDR** Preliminary Design Review | R-15, R-16, R-10, R-02 | **FMEA**, **Trade Study** | architecture, icd |
| **CDR** Critical Design Review | R-03, R-04, R-12, R-18, R-20, RD-01..03 | **Impl Plan** (`se-plan`: CR-slices + milestones) | rtm |
| **TRR** Test Readiness Review | R-05, R-08, R-19 | — (test concepts authored inline with each REQ) | testconcept, testmatrix, changelog, **intplan** |

Effect: a phase can be rule-green yet gate-red because its FMEA/ConOps/Plan was never done — exactly the
hole in §1.1. The `ReadinessGate.blocking[]` gains entries like `"FMEA not performed (PDR creation)"`.

## 5. Updated Implementation Gates (SAR/FCA/SVR/FRR)

Impl gates stay milestone/CR-bound (`ready iff every CR -relation-> MS is done AND MS scope error-clean`).
One addition closes a **vacuous-green** hole:

- Creation artifacts are realized into the graph as CRs (IRR→CRs, ConOps→UC/CR, `se-plan`→CRs,
  FMEA→risk-REQ CR). The impl gate already requires those CRs done — **good**.
- **But** if a required creation was never performed, no CR represents it, so the milestone has no blocker
  → falsely ready. Fix: an impl gate also blocks if a creation artifact required by its milestone's phase
  is **🔴 absent**. The artifact tab (§6) becomes a first-class gate input, not a passive panel.

| Impl gate | Milestone | Phase coupling (which creations must exist) |
|---|---|---|
| **SAR** System Acceptance Review | MS-1-specification | SRR creations (ConOps, IRR) |
| **FCA** Functional Configuration Audit | MS-2-coding-vv | PDR creations (FMEA, Trade) |
| **SVR** System Verification Review | MS-3-mvp-readiness | CDR/TRR creations (Plans) |
| **FRR** Functional Readiness Review | MS-4-mvp2 | all prior creations current |

## 6. Updated Artifacts (the INCOSE tab)

The tab splits into two groups with **two staleness mechanisms** — the single `staleVsGraph` boolean is the
current defect (it applies an mtime check to analyses that don't refresh on mtime).

**Renders** — `docs/views/*.md` vs graph mtime · 🟢 view ≥ graph · 🟡 graph newer → *re-export* · 🔴 missing
```
spec          Requirements Spec (SRS)        rtm           Req-Test Traceability Matrix
architecture  Architecture (SDD)             nfr           NFR Register
cr-list       Change Log                     testconcept   Test Concept
references    Requirements Traceability      testmatrix    Test Matrix (VCRM)
icd           Interface Control Document     intplan       Integration & Test Plan
```

**Creations** — vs analyzed scope / commit · 🟢 covers current scope · 🟡 model moved → *re-analyze* · 🔴 never done
```
conops        Concept of Operations          category IRR   (record → UC/ACTOR via CRs)
irr           Unproven-Assumptions Review     category IRR   (commit-pinned snapshot → CRs)
trade         Trade Study                     category IRR   (decision + relation edges)
fmea          FMEA (functional risk)          category FMEA  (risk/mitigation REQ + S/O/D, direct)
implplan      Implementation Plan             category FMEA  (se-plan: MS/CR nodes, direct)
```

Note: "Integration & Test Plan" is a **render** of the milestone/CR/gate structure the Impl Plan
*created* — it originates nothing (verified: `se-view:intplan` queries only pre-existing MS/CR/edges).
See [document-specimens.md](document-specimens.md) for the reclassified list (INCOSE vs graphcode-specific)
and a specimen of each document.

`ArtifactStatus` gains `kind: 'render' | 'analysis'`; analyses get a classifier keyed on "scope moved past
the analysis," not file mtime. The 9 render rows currently still only exist as `se-view:*` skills → they
become deterministic views (thin-trigger decision) and materialize to `docs/views/`.

## 7. Realization — CR chain (each ≤5 files)

1. **CR-A — readiness model:** `ReadinessGate` gains `creationArtifacts: string[]`; `scorePhaseGate` ANDs
   in artifact-currency; `scoreImplGate` blocks on 🔴-absent required creations. Update `TEST-readiness-model`.
2. **CR-B — artifact tab:** `artifactsPanel` gains `kind` + the analysis classifier; split row set; stop
   feeding FMEA/IRR through the mtime path.
3. **CR-C — render convergence:** the 12 `se-view:*` skills become deterministic `MarkdownView` exports +
   thin-trigger skills; extend the enum/`exporter.ts`. (May split per view group.)
4. **CR-D — creation skills:** rename FMEA render `irr`→`fmea`; add `se-irr` (assumption detection),
   `se-conops`, `se-trade` create skills; land `se-plan` (CR-GC-209).
5. **CR-E — docs:** supersede the CR-GC-125 `lean = no artifacts` wording; update ADR reference.

## 8. Resolved — Impl Plan vs Int Plan

- **Impl Plan = CREATE.** `se-plan` (CR-GC-209) originates the **CR-slices** (≤5-file cuts — judgment) and
  the **milestones**, emitting `MS`/`CR` nodes directly (category-FMEA style: direct graph mutation).
- **Int Plan = RENDER.** Once the milestones/CRs/`depends-on` exist, the Integration & Test Plan is a
  deterministic projection of them + the impl gates — it originates nothing (`se-view:intplan` reads only
  pre-existing MS/CR/edges/readiness).

The `depends-on` topological ordering is the deterministic part — it belongs to the Int Plan render, not the
Impl Plan create.
