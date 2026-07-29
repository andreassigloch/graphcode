---
name: se-view:trade
version: 2
description: Trade Study view (decisions + superseded options) — deterministic render, thin trigger of the CR-GC-220 exporter
---

Thin trigger for the **deterministic Trade Study** view — it renders the decisions/`relation` structure that `se-trade` (CR-GC-223) *recorded* in the graph; it does not make decisions. Do NOT re-render by hand — agent formatting is a non-deterministic parallel path to the CR-GC-220 exporter.

1. Call `graph_export` `{ "views": ["trade"] }` — materializes the deterministic Trade Study view to `docs/views/trade.md` and returns its path.
2. Output that file verbatim. Do not reformat, summarize, or re-query the graph — the export **is** the view (byte-identical on every re-run). To *make* a trade decision, use `se-trade`, not this view.
