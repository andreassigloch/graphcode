# Views

**Live dashboard (GVE):** ask `npx @sigloch/graphcode status` — it names the host and the URL of
the viewer serving THIS repo. The machine-readable source is [`dashboard.url`](dashboard.url),
which GVE writes with its actual bound address on startup and removes on shutdown; file absent =
nothing running. The address is stable per repo (derived from the repo path, 43000–43999), so a
bookmark survives restarts.

You normally start nothing: `graphcode mcp` — which your agent host launches from `.mcp.json` —
spawns GVE itself, along with the read-only SSE bridge, and takes it down again when the session
ends. Start it by hand only against a repo with no agent session running:

```bash
npx @sigloch/graph-view-edit --repo /path/to/graphcode   # then: graphcode status
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
