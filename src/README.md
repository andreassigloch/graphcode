# src/ — realized in M2 (Coding & V&V)

The runtime modules are **realized from the graph spec** (the committed snapshot under
`docs/graph/`), not hand-stubbed.

**One module, one directory (CR-GC-429 §4, recut in CR-GC-447):** the file system agrees
with the graph's `FUNC -allocate-> MOD [0..1]` grammar — each directory below is one
`MOD-*`, and `MOD.path` in the graph points at it. Only the two package entry points stay
at the root.

| Directory | Module (graph) | Role |
|---|---|---|
| `index.ts`, `cli.ts` | entry points (`main`/`bin`) | bound via `realRef`, not by path |
| `kernel/` | `MOD-kernel` | Store ∘ Gate ∘ Regeln ∘ OpLog — the one Kuzu owner; `apply(Command[]) → Verdict`, `query(TypedQuery) → Slice` |
| `projections/` | `MOD-projections` | Messung · Readiness · Codec · Export · Views · Trajectory — pure Graph → X |
| `loop/` | `MOD-loop` | Autopilot + Executor — a client like any other |
| `surface/` | `MOD-surface` | MCP-stdio · CLI · Host-Socket · Viewer/SSE — adapters, no logic |

`MOD-agent-surface` lives under `.claude/commands/` (the skill drivers, `path` set there);
`MOD-dashboard` is the neighbour package `@sigloch/graph-view-edit` (`external: true`).

**Where the 17 old directories went** (CR-GC-446 cut the model, CR-GC-447 the code):

| old | new |
|---|---|
| `harness/`, `conformance/conformance.ts` + `evaluation.ts`, `element-slice/`, `schema-migration/`, `hooks/hooks.ts` | `kernel/` |
| `codec/`, `views/`, `completeness/`, `conformance/testreport.ts`, the measuring half of `steering/`, the report/export half of `tools/` | `projections/` |
| `executor/`, the deciding half of `steering/` (`generate`, `steering`, `se-plan`, `target-profile`), `tools/suggest.ts` | `loop/` |
| `cli/`, `viewer/`, the MCP-verb half of `tools/`, `hooks/emit.ts` | `surface/` |

Two files were **split by responsibility**, not moved (CR-GC-447):
`viewer/host.ts` → `kernel/own-kuzu.ts` (who owns the one store) + `surface/host.ts` (the
read-only HTTP/SSE transport above it); `hooks/emit.ts` → `surface/emit.ts` (the live-update
event) + `projections/trajectory.ts` (the learning feed as a projection of the OpLog).

**Module size:** 500 lines per file (`CLAUDE.md`). Two documented exceptions, tracked in
CR-GC-261: `kernel/measure/readiness.ts` and `kernel/harness.ts` (moving the Apply-Gate is a
governance change, not a formatting one).

**Measurement lives in `kernel/measure/`** (CR-GC-467, Entscheidung 1; moves CR-GC-468–471):
readiness, fit-advisory, test-selection, nd-similarity — graph → number, used by the gate to
judge. `projections/` renders them, it does not own them. The layer order
`kernel ← loop ← projections ← surface ← index/cli` is enforced by
`tests/import-boundaries.test.ts`.

Interfaces are the `FLOW→SCHEMA` contracts (`@sigloch/contracts` Zod).
