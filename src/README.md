# src/ — realized in M2 (Coding & V&V)

The runtime modules are **realized from the graph spec** (`docs/graph/graphcode.graph.json`),
not hand-stubbed. Early carve-out stubs were removed (non-compliant with the model).

| File | Module (graph) | CR |
|---|---|---|
| `harness.ts` | `MOD-harness` (Apply-Gate / evaluateRules / store-lock O2 / write-mutex O3) | CR-GC-100 |
| `harness-import.ts` | `MOD-harness` — the non-gated import/seed/reseed path | CR-GC-260 |
| `mcp-tools.ts` | `MOD-mcp-tools` — composition root: builds the `ToolContext`, merges the four groups | CR-GC-101 |
| `tool-context.ts` | `MOD-mcp-tools` — the ONE carrier of `graphVersion` + the tool write chain | CR-GC-256 |
| `tools/{read,write,report,export}.ts` | `MOD-mcp-tools` — the 20 tools, one module per group | CR-GC-256 |
| `hooks.ts` | `MOD-hooks` (pre-commit / post-apply / nightly) | CR-GC-102 |
| `codec.ts` | `MOD-codec` (encode / decode / merge-nodes, Format-E) | CR-GC-103 |
| `exporter.ts` | `MOD-docs` — graph→JSON/Markdown entry + the `generatedHeader`/`byUid`/`cell` primitives | CR-GC-113 |
| `views/{helpers,srs,incose,graphcode}.ts` | `MOD-docs` — the 16 deterministic view projections | CR-GC-260 |
| `readiness.ts` | `MOD-readiness` — compliance + phase/impl gates + the report | CR-GC-107 |
| `readiness-completeness.ts` | `MOD-readiness` — the completeness dimension (browser-safe) | CR-GC-260 |
| `scaffold.ts` | `MOD-cli` — idempotent init / update / remove mechanics | CR-GC-121 |
| `scaffold-templates.ts` | `MOD-cli` — the catalog of installed artifacts + their bytes | CR-GC-260 |
| `cli.ts` | `MOD-cli` (npx init / update / remove) | CR-GC-112 |

**Module size:** 500 lines per file (`CLAUDE.md`). Two documented exceptions, tracked in
CR-GC-261: `readiness.ts` (505 — the next seam is imported by 6 files) and `harness.ts` (712 —
reaching 500 would mean moving the Apply-Gate, which is a governance change, not a formatting one).

Interfaces are the `FLOW→SCHEMA` contracts (`@sigloch/contracts` Zod). Deps: `file:` (dev) → versioned (publish).
Start: **CR-GC-100** — Task 0 = tsconfig + align to the real `@sigloch/graph-api-core` API; Task 1 = D1 `/harness` export in contracts.
