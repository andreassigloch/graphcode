# CR-GC-220 — Renderer: deterministic MarkdownView for every render-able artifact

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 4
**Graph (SSOT):** seedet (gate-only) `REQ-deterministic-render`, `FUNC-render-views` (→ `src/exporter-views.ts`),
`TEST-views-conformance` (→ `tests/exporter.test.ts`), `CR-GC-220`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [readiness-artifact-model.md](../../proposals/readiness-artifact-model.md) · [document-specimens.md](../../proposals/document-specimens.md)

## Problem (Why)

Heute rendern nur **4** Views deterministisch (`spec`/`architecture`/`cr-list`/`references`, `MarkdownViewSchema`).
Alle übrigen SE-Artefakte (SRS, NFR, RTM, ICD, Test-Concept, VCRM, Int-Plan, Change-Log + die Render-Form von
FMEA/ConOps/Trade/Impl-Plan) existieren nur als `se-view:*`-**Skills** — agent-gerendert, also **nicht-deterministisch**.
Determinismus-Regel: Rendern ist eine reine Funktion des Graphen → gehört in Code. Nicht-deterministisches Rendern ist der Defekt.

## Decision

- `MarkdownViewSchema` erweitern um: `srs`, `nfr`, `rtm`, `icd`, `testconcept`, `testmatrix`, `intplan`, `changelog`,
  `fmea`, `conops`, `trade`, `implplan`. (`spec` = Voll-Dump bleibt; **`srs` = REQ-Slice** ist distinkt — Specimen #2 vs #12.)
- Render-Funktionen nach **`src/exporter-views.ts`** auslagern (exporter.ts < 500 Zeilen) — je View die Projektion
  gem. Specimen: **SRS** nach 29148-Struktur (statement/rationale/priority/verification/trace, gruppiert nach UC/FUNC),
  **Test-Concept** als Pyramide nach SYS/UC/FUNC-Level mit **berechneter E2E-Lücke** (✗ bei 0 System-Tests),
  RTM/VCRM als Matrix.
- `VIEW_FILENAMES` + `scripts/export-graph.mjs` für alle Views; Refuse-to-clobber-Guard bleibt.

## Akzeptanz

- `node scripts/export-graph.mjs` rendert alle Views nach `docs/views/`; 2× Lauf = **byte-identisch**.
- Test-Concept-View weist System-Level-E2E als ✗ aus, wenn 0 E2E-Tests (berechnet, nicht still leer).
- SRS-View ≠ Model-Spec-View (REQ-Slice vs Voll-Dump).
- `npm run build` + `npm test` grün; `exporter.ts` < 500 Zeilen.

## Dependencies

— (Foundation). Nachgelagert: CR-GC-222 (Tab nutzt die Render-Row-Liste), CR-GC-224/225 (Skills triggern diese Views).
