# src/ — realized in M2 (Coding & V&V)

The runtime modules are **realized from the graph spec** (`docs/graph/graphcode.graph.json`),
not hand-stubbed. Early carve-out stubs were removed (non-compliant with the model).

| File | Module (graph) | CR |
|---|---|---|
| `harness.ts` | `MOD-harness` (mutate / evaluateRules / saveGraph / import / migrate-schema) | CR-GC-100 |
| `mcp-tools.ts` | `MOD-mcp-tools` (graph_impact / graph_expand, registry) | CR-GC-101 |
| `hooks.ts` | `MOD-hooks` (pre-commit / post-apply / nightly) | CR-GC-102 |
| `codec.ts` | `MOD-codec` (encode / decode / merge-nodes, Format-E) | CR-GC-103 |
| `cli` | `MOD-cli` (npx init / update / remove) | later |

Interfaces are the `FLOW→SCHEMA` contracts (`@sigloch/contracts` Zod). Deps: `file:` (dev) → versioned (publish).
Start: **CR-GC-100** — Task 0 = tsconfig + align to the real `@sigloch/graph-api-core` API; Task 1 = D1 `/harness` export in contracts.
