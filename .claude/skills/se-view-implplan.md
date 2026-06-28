---
name: se-view:implplan
version: 2
description: Implementation Plan view (MS/CR structure) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Implementation Plan** view — it renders the MS/CR structure that `se-plan` (CR-GC-209) *created*; it does not originate a plan. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["implplan"] }` — materializes the deterministic Implementation Plan view to `docs/views/implplan.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run). To *create or reorder* the plan, use `se-plan`, not this view.
