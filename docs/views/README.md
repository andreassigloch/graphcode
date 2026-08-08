# Views

**Live dashboard (GVE):** read [`dashboard.url`](dashboard.url) — GVE writes its actual bound
address there when it starts against this repo and removes it on shutdown (the port is dynamic:
Vite bumps on conflict, so never assume the 4317 default). File absent = server not running.

You normally start nothing: `graphcode mcp` — which your agent host launches from `.mcp.json` —
spawns GVE itself, along with the read-only SSE bridge. Start it by hand only against a repo with
no agent session running:

```bash
npx @sigloch/graph-view-edit --repo /path/to/graphcode   # then: cat docs/views/dashboard.url
```

The `.md` files in this directory are **GENERATED** by `graph_export` /
`node scripts/export-graph.mjs` from `docs/graph/graphcode.graph.json` (SSOT) —
do not hand-edit them. This README is the only hand-maintained file here.

## `views/` vs. `records/` — why the IRR lives elsewhere

Two directories, two different kinds of document. The distinction is *derivability*, not topic:

| | `docs/views/` | `docs/records/` |
|---|---|---|
| What | deterministic **projections** of the graph | commit-stamped **judgement** documents |
| Written by | `graph_export` (the exporter) | a create skill, e.g. `se-irr` |
| Re-derivable | yes — same graph → byte-identical file | no; it is a snapshot of a human/agent decision |
| Header | `GENERATED … DO NOT HAND-EDIT` | none — the file *is* the record |
| On model change | re-render, the old content is gone | untouched; a new review = a new stamped file |

So `docs/records/irr.md` (Internal Readiness Review) is not a view that ended up in the wrong
folder — nothing in the graph could reproduce it.

The recurring confusion is **ConOps**, because two skills share the name: `se-conops` (CREATE —
authors operational requirements through the gate) and `se-view:conops` (RENDER — projects them).
ConOps, unlike the IRR, *is* graph-derived and therefore lives here as `conops.md`.
