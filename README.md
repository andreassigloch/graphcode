# GraphCode — Claude Code Sidecar Harness

**GraphCode** = Harness für Familie (Prio 1a), splittet aus aimprove.

**Purpose:** Claude Code Sidecar + Local GraphService + MCP-Tools + Hook-System.

## Current Phase: Carve-Out

**Prio 0:** Arbeitsfähigkeit in aktueller Config
1. `aimprove-harness` läuft im aimpro-Verzeichnis
2. **→ Kopie der Harness-Core-Features hierher**
3. **→ Refactor: Harness-Funktionalität extrahieren** (nicht: Generator, nicht: Learning-Engine, nur: Graph Operations + Hooks)

## Structure (Building)

```
graphcode/
├── README.md                    (dieser Datei)
├── package.json                 (TBD: Dependencies)
├── tsconfig.json                (TBD: TypeScript config)
│
├── src/
│   ├── index.ts                 (Export + Harness entrypoint)
│   ├── harness.ts               (Core Harness Logic)
│   ├── graph-service.ts         (Local GraphService wrapper)
│   ├── mcp-tools.ts             (MCP Tool Suite: graph_*, rules_*, etc.)
│   ├── hooks.ts                 (Pre-commit, Post-apply, Nightly Batch)
│   └── codec.ts                 (Format-E Codec bridge to contracts)
│
├── tests/
│   ├── harness.test.ts          (Harness Core)
│   ├── graph-service.test.ts    (GraphService mutations)
│   └── mcp-tools.test.ts        (MCP Tool functionality)
│
└── docs/
    ├── ARCHITECTURE.md          (Design: Harness vs. aimprove split)
    ├── MCP-TOOLS.md             (Graph_* Tools spec)
    ├── HOOKS.md                 (Pre/Post/Nightly)
    └── INTEGRATION.md           (How aimprove uses GraphCode)
```

## Carve-Out Strategy

**Source:** `/Users/Andreas/Developer/dev/aimpro/src/` (aimprove-harness code)

**Identify & Extract (Prio 0):**

1. **Graph Operations (harness-core)**
   - `loadGraph()` — DB read
   - `saveGraph()` — DB write
   - `mutate(command)` — Apply mutations (with Gate validation)
   - Dependencies: `@sigloch/graph-api-core`, `@sigloch/contracts/se`

2. **MCP Tools (transport-abstraction)**
   - `graph_elements()` — Read
   - `graph_mutate()` — Write with Gate
   - `rules_evaluate()` — Rule-check
   - `audit_trail()` — History
   - Transport: MCP-stdio (Claude Code native)

3. **Hooks System (extension-points)**
   - `pre-commit` — Validation before write
   - `post-apply` — Notification/cleanup after mutation
   - `nightly-batch` — Learning/aggregation trigger
   - Storage: File-based (`.graphcode/hooks/`)

4. **Local Storage (Kuzu only, no HTTP)**
   - KuzuAdapter from @sigloch/graph-api-core
   - Persistence: Repo-local `.graphcode/kuzu/`
   - No multi-tenant, no auth (Claude Code = local)

**Separate from GraphCode (stays in aimprove):**
- Generator logic (F1–F15 pipelines)
- Orchestrator (Observe/Evaluate/Distill/Inject/Monitor)
- Learning-Engine (Trajectory/Outcome emission)
- Dashboard (optional UI)

## Key Design Decisions

| Decision | Rationale | Implication |
|---|---|---|
| **Repo-centric (1 instance/repo)** | Claude Code runs per project, not centralized | Harness instantiated on CLI start, not daemon |
| **MCP-stdio only (initial)** | Claude Code native, zero HTTP setup | aimprove can HTTP-wrap it later (P2) |
| **Kuzu + local persistence** | Permanent, queryable, no `:memory:` | `.graphcode/kuzu/` is artifact (gitignore) |
| **No learning-logic here** | Learning = separate module (learning-core, Prio 5) | Harness emits Trajectory/Outcome files, not trains |
| **Hooks extensible** | Other tools/agents can hook in | Pre/Post/Nightly = plugin-points |

## Building Blocks (From aimprove)

### 1. Harness Core (`harness.ts`)
```typescript
export class GraphCodeHarness {
  constructor(repoPath: string, kuzu?: KuzuAdapter) { }
  
  // Graph operations (from aimprove GraphService)
  loadGraph(): Promise<OntologyGraph> { }
  saveGraph(elements, traces): Promise<void> { }
  mutate(command: MutateCommand): Promise<MutateResult> { } // with Gate
  
  // Hooks
  registerHook(type: 'pre-commit' | 'post-apply' | 'nightly-batch', handler): void { }
  
  // Cleanup
  close(): Promise<void> { }
}
```

### 2. MCP Tools (`mcp-tools.ts`)
```typescript
export const MCP_TOOLS = {
  graph_elements: { ... },        // read-only
  graph_mutate: { ... },          // with Gate
  rules_evaluate: { ... },         // validate
  audit_trail: { ... },            // history
};
```

### 3. Hooks System (`hooks.ts`)
```typescript
export class HookSystem {
  registerHook(type, handler): void { }
  runPreCommitHooks(data): Promise<HookResult> { }
  runPostApplyHooks(result): Promise<void> { }
  scheduleNightlyBatch(handler): void { }  // cron-ish
}
```

## Testing Strategy

- **Unit:** Harness Core (mutations, Gate validation)
- **Integration:** MCP Tools + local Kuzu
- **Conformance:** Format-E codec round-trip
- **E2E:** Claude Code CLI integration (after aimprove imports)

## Next Step for User

1. **Copy current aimprove-harness code** → `/Users/Andreas/Developer/dev/graphcode/src/`
2. **Identify harness-only files** (not generator/learning/dashboard)
3. **Build GraphCode locally** (npm install, npm run build)
4. **Test harness-core** (unit tests on Graph operations)
5. **Start aimprove refactor** (import GraphCode instead of inline harness)

→ First milestone: **Harness lauffähig** (CR-195 sequence)

---

## Governance SSOT (canonical — in bok, do not copy here)

GraphCode follows the No-Duplication model (`bok/docs/governance/REPO-BOUNDARY.md`):
the spec lives in **bok**; this repo links to it and owns the **implementation + its CRs**.

| Topic | Canonical source |
|---|---|
| Full spec (modules, Zod-Interfaces, Drift-Locks, Design-Decisions) | `bok/docs/governance/graphcode-governance.md` |
| Carve-Out CR-Plan (CR-GC-100→103) | `bok/docs/governance/graphcode-governance.md` §5 — **gated** hinter §6 Checkpoint (unsigned) |
| Drift-Locks L1–L4 (GraphCode-Enforcement) | `bok/docs/governance/graphcode-governance.md` §3 |
| Schnittstellen-Matrix (Consumers) | `bok/docs/governance/USAGE-MATRIX.md` |
| Familie-Architektur | `bok/docs/konzept/aise-family-architecture.md` |

**CRs:** werden in `graphcode/docs/cr/open/` geöffnet, sobald der §6 Governance-Checkpoint
abgezeichnet ist (CR-Lokalität: GraphCode-CRs leben hier, nicht in bok).

---

**Owner:** Governance-Guardian + Harness-Lead (TBD)  
**Repository:** /Users/andreas/Developer/dev/graphcode/
