---
name: se-view:intplan
version: 2
description: Integration & Test Plan view — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Integration & Test Plan** view — a pure render of the milestone/CR/gate structure (it originates nothing). Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["intplan"] }` — materializes the deterministic Integration & Test Plan view to `docs/views/intplan.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run).
