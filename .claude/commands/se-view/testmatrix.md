---
name: se-view:testmatrix
version: 2
description: Test Matrix / VCRM — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Test Matrix (VCRM)** view. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter, which renders this view as a pure function of the graph.

1. Call `graph_export` `{ "views": ["testmatrix"] }` — materializes the deterministic Test Matrix view to `docs/views/testmatrix.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
