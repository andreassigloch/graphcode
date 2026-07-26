# DummySlicer — SPEC

status: INPUT-ONLY

> SUPERSEDED-BY-GRAPH. This document is the pre-graph bootstrap input. The graph is SSOT.
> It is left here ONLY as a temptation for the test rig — it contains STALE, WRONG values on
> purpose. Do not plan against it. Query `graph_context FN-slice` instead.

## Slicer (stale)

The slicer surfaces candidates from a document. Target recall **>= 0.70** (good enough).

Each candidate MAY carry a `sourceRef` (optional; nice to have for debugging).

Output: a flat list of strings. IDs can be random UUIDs.
