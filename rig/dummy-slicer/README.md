# Rig: dummy-slicer

A **self-contained, fictional** consumer repo for exercising graphcode's graph-first loop
**without touching graphify**. Spec-era state: the model (a recall-first doc slicer) is fully
specified in the graph; `FN-slice` is **not yet realized** (no `codeRef`).

## What's here

- `model/dummy-slicer.graph.json` — the spec-era graph (SSOT for the rig). In a real consumer
  this is materialized at `docs/graph/*.graph.json` via `graph_export`; it lives under `model/`
  here only so graphcode's own `deny-graph-write` hook (CR-GC-201) doesn't false-positive on a
  fixture.
- `docs/SPEC.md` — **stale, INPUT-ONLY, deliberately WRONG** (recall 0.70, optional sourceRef).
  The trap: an agent that ingests it builds to the wrong spec. CR-GC-214 blocks reading it.
- `spikes/score.ts` — the reference scoring impl (the "referenceImpl" = a `codeRef` target).
- `src/slice.ts` — the un-realized stub to implement.
- `.mcp.json` — binds the **local** graphcode build (`../../dist/cli.js mcp`), not the npm release.
- `.claude/` — registers the CR-GC-214 read-deny hook.

## Arms

- **Arm B (enforcement):** `graph_context FN-slice` serves the definition-of-done; the CR-GC-214
  hook denies `Read docs/SPEC.md` (INPUT-ONLY) and allows `Read src/slice.ts`. Run via
  `scripts/armB.mjs` (deterministic) and/or a headless `claude -p` agentic loop.
- **Arm C (local model):** feed the `graph_context FN-slice` bundle to a local model
  (LM Studio, qwen3.6-27b on a 48GB M4) and check it implements `slice()` from the bundle alone.
  Run via `scripts/armC.mjs` against `http://localhost:1234/v1`.

The graph is the rig's SSOT — never hand-edit `src/` to "match"; query `graph_context`.
