# Views

**Live dashboard (GVE):** read [`dashboard.url`](dashboard.url) — GVE writes its actual bound
address there when it starts against this repo and removes it on shutdown (the port is dynamic:
Vite bumps on conflict, so never assume the 4317 default). File absent = server not running.

```bash
npx @sigloch/graph-view-edit --repo /path/to/graphcode   # then: cat docs/views/dashboard.url
```

The `.md` files in this directory are **GENERATED** by `graph_export` /
`node scripts/export-graph.mjs` from `docs/graph/graphcode.graph.json` (SSOT) —
do not hand-edit them. This README is the only hand-maintained file here.
