---
name: se-view:nfr
version: 2
description: NFR Register — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic NFR Register** view. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter, which renders this view as a pure function of the graph.

1. Call `graph_export` `{ "views": ["nfr"] }` — materializes the deterministic NFR Register view to `docs/views/nfr.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
