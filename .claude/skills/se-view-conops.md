---
name: se-view:conops
version: 2
description: Concept of Operations view (actors/system/use-cases) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Concept of Operations** view — it renders the actor/system/use-case structure that `se-conops` (CR-GC-223) *created* in the graph; it does not author concerns. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["conops"] }` — materializes the deterministic ConOps view to `docs/views/conops.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run). To *author* operational concerns, use `se-conops`, not this view.
