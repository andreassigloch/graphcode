/**
 * @sigloch/graphcode — public surface.
 *
 * The harness owns exactly one Kuzu store per repo at `<repoRoot>/.graphcode/kuzu`
 * (REQ-single-kuzu-owner, REQ-disk-persistence). `createHarness()` is the
 * production wiring; tests construct `GraphCodeHarness` directly with an
 * injected adapter on a temp disk path.
 *
 * @author andreas@siglochconsulting
 */
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { z } from 'zod/v4';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { HarnessConfigSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from './harness.js';
import { HookSystem } from './hooks.js';
import { registerEmitters } from './emit.js';

export { GraphCodeHarness } from './harness.js';
export { HookSystem } from './hooks.js';
export type { HookType, HookResult, HookData, HookHandler, HookOptions, HookSystemConfig } from './hooks.js';

// MCP-stdio tool surface (CR-GC-101) — graph instead of grep, gate-symmetric writes.
export { bindToolsToHarness } from './mcp-tools.js';
export type { MCPTool, MCPToolRegistry } from './mcp-tools.js';

// MCP-stdio server (CR-GC-111) — bind the registry to @modelcontextprotocol/sdk
// over stdio (REQ-single-transport); `graphcode mcp` (src/cli.ts) is the entry.
export { bindRegistryToMcpServer, buildMcpServer, serveStdio } from './mcp-server.js';

// Hook emission (CR-GC-102) — live-update event + append-only trajectory + version cache.
export { registerEmitters, computeDomains, makeUpdateEventHook, makeTrajectoryHook, ResponseCache } from './emit.js';
export type { UpdateDomain, LiveUpdateEvent, TrajectoryEntry, RegisterEmittersOptions } from './emit.js';

// Format-E codec (CR-GC-103) — deterministic, commit-/merge-safe round-trip.
export { GraphCodeCodec } from './codec.js';

// Graph→Markdown/JSON re-exporter (CR-GC-113, MOD-docs) — the single SSOT sync
// path: render the live in-memory graph back into commit-able docs.
export {
  exportGraphJson,
  exportMarkdown,
  MarkdownViewSchema,
  MARKDOWN_VIEWS,
  VIEW_FILENAMES,
} from './exporter.js';
export type { MarkdownView } from './exporter.js';

// New-member bootstrap (CR-GC-122) — fill an EMPTY member graph from ungoverned
// Format-E THROUGH the gate (FUNC-import / REQ-bootstrap-through-gate). Distinct
// from harness.seedFromJson() (a direct load of the already-governed SSOT).
export { bootstrap, TEMPLATE_FORMAT_E, BootstrapResultSchema } from './bootstrap.js';
export type { BootstrapResult, BootstrapMode } from './bootstrap.js';

// Readiness scorer (CR-GC-107) — family compliance from contracts V3_RULES (L2), no foreign BQ rules.
export { scoreReadiness, computeReadiness, getFamilyRuleIds } from './readiness.js';
export type { ReadinessReport, ReadinessDimension } from './readiness.js';

// CLI scaffold lifecycle (CR-GC-112) — self-contained `init|update|remove` installer (MOD-cli).
export { scaffold, CliCommandSchema, InstallResultSchema } from './scaffold.js';
export type { CliCommand, InstallResult } from './scaffold.js';

// Host + read-only SSE bridge (CR-GC-114, MOD-host-bridge) — owns the single
// Kuzu store and serves /health + /events (SSE) to a live viewer. Read-only:
// no mutating HTTP verb is reachable (the write path is MCP-stdio).
export { HostBridge, serveHost } from './host.js';
export type { HostBridgeOptions, HealthPayload } from './host.js';

export type {
  HarnessConfig,
  MutateCommand,
  MutateResult,
  RuleViolation,
  MutateTier,
} from '@sigloch/contracts/harness';

/** Default Kuzu store location relative to the repo root. */
export const KUZU_DIR = '.graphcode/kuzu';

/**
 * Wire a harness over a disk-backed Kuzu store at `<repoRoot>/.graphcode/kuzu`.
 * Caller must `await harness.initialize()` before mutating. NEVER `:memory:` —
 * persistence is on disk (REQ-disk-persistence).
 *
 * Emitters are registered by default (REQ-mutation-emits-event / REQ-trajectory-emit):
 * every mutation emits exactly one live-update event and one append-only trajectory
 * line under `<repoRoot>/.aimprove`. A host passes `onUpdateEvent` to wire its SSE
 * broadcast; the harness core stays headless (no HTTP).
 */
export async function createHarness(
  config: z.input<typeof HarnessConfigSchema>,
  opts?: { onUpdateEvent?: (event: import('./emit.js').LiveUpdateEvent) => void },
): Promise<GraphCodeHarness> {
  const cfg = HarnessConfigSchema.parse(config);
  const kuzuPath = join(cfg.repoRoot, KUZU_DIR);
  // graphcode owns the per-repo `.graphcode/` workspace (SPEC §4). Kuzu opens the
  // store at `kuzuPath` but needs its parent to exist — create it on first run.
  mkdirSync(dirname(kuzuPath), { recursive: true });
  const storage = new KuzuAdapter({
    ontology: SE_DESCRIPTOR,
    path: kuzuPath,
  });
  const hooks = new HookSystem({ preCommitTimeout: cfg.preCommitTimeout });
  registerEmitters(hooks, {
    outDir: join(cfg.repoRoot, '.aimprove'),
    onEvent: opts?.onUpdateEvent,
  });
  return new GraphCodeHarness(cfg, storage, hooks);
}
