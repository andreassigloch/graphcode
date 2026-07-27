# CR-GC-222 — Artefakt-Tab: render/analysis-Kind-Split + zwei Stale-Mechanismen

**Status:** Open (2026-06-28) · **Milestone:** `MS-6-adoption` · **Max Files:** 3
**Graph (SSOT):** seedet (gate-only) `REQ-artifact-kind-split`, `FUNC-classify-artifact` (→ `src/viewer/panels.ts`),
`TEST-artifact-kind` (→ `tests/panels.test.ts`), `CR-GC-222`; unter `MS-6-adoption`. Pointer, nicht autoritativ.
**Proposal:** [readiness-artifact-model.md §6](../../proposals/readiness-artifact-model.md) · [document-specimens.md](../../proposals/document-specimens.md)

## Problem (Why)

`artifactsPanel` kennt nur **ein** Stale-Signal (`staleVsGraph`, mtime). Für **Renders** korrekt (Graph neuer → re-export),
für **Creations** falsch: eine FMEA / Assumption-Review veraltet nicht durch eine Datei-mtime, sondern wenn der
**analysierte Scope** wandert. Gelb bedeutet dadurch zweierlei (re-export vs re-analyze) und kollabiert heute fälschlich.

## Decision

- `ArtifactStatus` erhält `kind: 'render' | 'analysis'`.
- **Render-Pfad:** bestehende mtime-Klassifikation (`docs/views` vs Graph). **Analysis-Pfad:** neuer Klassifikator
  keyed auf „Scope/Commit gewandert" (🟢 deckt aktuellen Scope · 🟡 re-analyze · 🔴 nie durchgeführt).
- Row-Set + Labels gem. Proposal; **zwei Gruppen**: „INCOSE / SE-standard" vs „graphcode-spezifisch" —
  **Nicht-INCOSE nicht als INCOSE labeln**. „IRR" → „Assumption Review". Labels = Artefaktnamen (kein `id==label`).
- FMEA/Creations verlassen den mtime-Pfad; die `analysis`-Currency wird als Provider an **CR-GC-221** geliefert.

## Akzeptanz

- Panel liefert je Row `kind`; Creation-Rows werden **nie** über mtime klassifiziert.
- Tab zeigt die zwei Gruppen getrennt; „Assumption Review" statt „IRR"; keine Nicht-INCOSE-Falschlabels.
- `tests/panels.test.ts`: Render-Row stale-by-mtime, Analysis-Row stale-by-scope; `npm test` + `build` grün.

## Dependencies

**CR-GC-220** (Render-Views = Render-Row-Quelle), **CR-GC-221** (konsumiert die `analysis`-Currency).
