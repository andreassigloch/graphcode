---
name: se-view:arch
version: 2
description: Architecture allocation view (SDD) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Architecture (SDD) view**. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter, which renders this view as a pure function of the graph.

1. Call `graph_export` `{ "views": ["architecture"] }` — materializes the deterministic Architecture view to `docs/views/architecture.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
