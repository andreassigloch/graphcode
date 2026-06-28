---
name: se-view:testconcept
version: 2
description: Test Concept (pyramid + computed E2E gap) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Test Concept** view (the SYS/UC/FUNC test pyramid with the computed E2E gap). Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter, which renders this view as a pure function of the graph.

1. Call `graph_export` `{ "views": ["testconcept"] }` — materializes the deterministic Test Concept view to `docs/views/testconcept.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
