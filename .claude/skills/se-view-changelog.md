---
name: se-view:changelog
version: 2
description: Change Log view (CR history) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Change Log** view (the CR history). Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["changelog"] }` — materializes the deterministic Change Log view to `docs/views/changelog.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
