# Migrating a graph across the REQ-kinds major (contracts 10.x)

For maintainers of a repo whose committed graph predates `@sigloch/contracts` 10.x. Moved out of the
README with CR-GC-889.

contracts 10.x narrows `REQ.kinds` to exactly one of `functional | non-functional`, moves
`risk`/`mitigation` to `attributes.role`, drops `precondition`/`postcondition`, and lets a FCHAIN
satisfy only `non-functional`. An old graph still boots; R-18 flags the affected `satisfy` edges.
`scripts/migrate-req-kinds.mjs` (CR-GC-669) moves it in two steps:

```bash
node scripts/migrate-req-kinds.mjs propose --repo <repo> [--graph <name>] --out decisions.json
# review: every entry with decidedBy "heuristic" or "open" is a per-REQ decision — edit kinds/
# role/dropSatisfy/addSatisfy, then set decidedBy to your name
node scripts/migrate-req-kinds.mjs apply --repo <repo> [--graph <name>] --decisions decisions.json
```

`apply` writes one batch through `graph_mutate` and exports via `graph_export` — no hand edit. It
refuses unconfirmed heuristic entries (`--accept-heuristic` only for trial runs on copies) and a
decision file that no longer matches the graph. It opens the repo's store itself, so stop the
repo's MCP host first.
