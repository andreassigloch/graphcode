# src/ — realized in M2 (Coding & V&V)

The runtime modules are **realized from the graph spec** (the committed snapshot under
`docs/graph/`), not hand-stubbed.

**One module, one directory (CR-GC-429 §4):** the file system agrees with the graph's
`FUNC -allocate-> MOD [0..1]` grammar — each directory below is one `MOD-*`, and
`MOD.path` in the graph points at it. Only the two package entry points stay at the root.

| Directory | Module (graph) |
|---|---|
| `index.ts`, `cli.ts` | entry points (`main`/`bin`) — bound via `realRef`, not by path |
| `harness/` | `MOD-harness` — Apply-Gate, store lifecycle, import/reseed, merge, config |
| `cli/` | `MOD-cli` — scaffold/init/update, verbs (run/rewind/import-code), status, gve, session lifecycle |
| `codec/` | `MOD-codec` — Format-E encode/decode |
| `conformance/` | `MOD-conformance` — CodeFacts extraction, RC rules, the ONE evaluation surface, test-report ingest |
| `completeness/` | `MOD-completeness` — the completeness dimension (browser-safe) |
| `element-slice/` | `MOD-element-slice` — element listing/slicing |
| `executor/` | `MOD-executor` — embedded run loop (prompt/parse/rank/preflight) |
| `hooks/` | `MOD-hooks` — pre-commit / post-apply / event + trajectory emit |
| `schema-migration/` | `MOD-schema-migration` — schema fingerprint + guard |
| `steering/` | `MOD-steering` — snapshot, next-step, generate, fit-advisory, readiness, target profile |
| `tools/` | `MOD-mcp-tools` — MCP server + registry, the tool groups, authoring/test-selection surfaces |
| `viewer/` | `MOD-host-bridge` — SSE/WS host, host-shim, health, help, panels |
| `views/` | `MOD-docs` — exporter + the deterministic view projections |

`MOD-skills` lives under `.claude/commands/` (already structured); `MOD-dashboard` is the
neighbour package `@sigloch/graph-view-edit`; `MOD-metrics-engine` binds externally into
sigloch-modules; `MOD-repo-root` owns no files.

**Module size:** 500 lines per file (`CLAUDE.md`). Two documented exceptions, tracked in
CR-GC-261: `steering/readiness.ts` and `harness/harness.ts` (moving the Apply-Gate is a
governance change, not a formatting one).

Interfaces are the `FLOW→SCHEMA` contracts (`@sigloch/contracts` Zod).
