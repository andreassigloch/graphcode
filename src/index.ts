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
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { createSeDescriptor } from '@sigloch/graph-api-core';
import { HarnessConfigSchema } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from './harness.js';
import { loadGraphcodeConfig } from './config.js';
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

// Hook emission (CR-GC-102) — live-update event + version cache. The learning
// feed is a projection of the operations log (CR-252, materializeTrajectory), not
// a hook — no parallel write path.
export { registerEmitters, computeDomains, makeUpdateEventHook, materializeTrajectory, ResponseCache } from './emit.js';
export type { UpdateDomain, LiveUpdateEvent, RegisterEmittersOptions } from './emit.js';

// Format-E codec (CR-GC-103) — deterministic, commit-/merge-safe round-trip.
export { GraphCodeCodec } from './codec.js';

// Graph→Markdown/JSON re-exporter (CR-GC-113, MOD-docs) — the single SSOT sync
// path: render the live in-memory graph back into commit-able docs.
export {
  exportGraphJson,
  isCanonicalSnapshot,
  exportMarkdown,
  elementToNode,
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

// ===========================================================================
// Viewer surface (`src/viewer/`) — PROVISIONAL. The read-only data layer an
// external live viewer/renderer (`graph-view-edit`) plugs into. graphcode itself
// stays headless; these exports stabilize when that renderer lands. See README
// "Viewer integration — coming soon". Live-update events come from `./emit.js`.
// ===========================================================================

// Host + read-only SSE bridge (CR-GC-114, MOD-host-bridge) — owns the single
// Kuzu store and serves /health + /events (SSE) to a live viewer. Read-only:
// no mutating HTTP verb is reachable (the write path is MCP-stdio).
export { HostBridge, serveHost } from './viewer/host.js';
export type { HostBridgeOptions, HealthPayload } from './viewer/host.js';

// Write-path shim client (CR-GC-241, formalizing CR-GC-235's Phase A internal
// mechanism as a public export): forwards ONE MCP tool call — including
// graph_mutate — over the elected host's local Unix socket
// (`<repoRoot>/.graphcode/host.sock`) to the SAME Apply-Gate every MCP-stdio
// session uses. No second Kuzu owner, no new outward protocol (still local,
// still no AuthN — same trust boundary as repo access, CR-GC-235's own
// scoping). This is graph-view-edit's write transport: its own
// /api/mutate calls callHost(..., 'graph_mutate', {commands, baseVersion,
// consumerId}) instead of opening a competing harness. `startHostSocket` is
// exported alongside it purely for consumer-side integration TESTS — spin up
// a real temp-disk harness + its own throwaway socket to test callHost
// end-to-end, instead of pointing at (and risking mutating) a live repo.
export { callHost, HOST_SOCK_BASENAME, startHostSocket } from './host-shim.js';
export type { HostSocket } from './host-shim.js';

// Headless dashboard data-layer (CR-GC-115, MOD-dashboard) — pure read-only
// shapers over the MCP tools; the external graph-view-edit renderer consumes
// these view-models and fills the FUNC-render-graph mount-slot.
export {
  readinessPanel,
  recommendationsPanel,
  artifactsPanel,
  artifactFreshness,
  analysisFreshness,
  creationCurrencyProvider,
  ARTIFACT_CATALOG,
  impactPanel,
  healthPanel,
  panelsForEvent,
} from './viewer/panels.js';
export type {
  ReadinessPanel,
  GatePanel,
  RecommendationsPanel,
  RecommendationItem,
  ArtifactsPanel,
  ArtifactStatus,
  ArtifactSignal,
  ArtifactKind,
  ArtifactGroup,
  ArtifactCatalogEntry,
  Freshness,
  ImpactPanel,
  HealthPanel,
} from './viewer/panels.js';

export type {
  HarnessConfig,
  MutateCommand,
  MutateResult,
  RuleViolation,
  MutateTier,
} from '@sigloch/contracts/harness';

// Implementation-plan ordering (CR-GC-209) — the testable core behind the `se-plan` skill.
export { deriveImplPlan } from './se-plan.js';
export type { ImplPlanResult } from './se-plan.js';

// Durable operations log (CR-GC-232 → CR-207) — the one family-wide implementation
// now lives in the store module (@sigloch/graph-api-core); re-exported here for the
// host/CLI that resume the version and read the trail. No local audit-log fork (former FileAuditLog lifted to the store).
export { FileOperationsLog, AUDIT_FILE, AUDIT_BASENAME, DEFAULT_COMPACT_BYTES } from '@sigloch/graph-api-core';
export type { AuditEntry, OperationsLog } from '@sigloch/graph-api-core';

// In-context help (CR-GC-227 content + CR-GC-228 data layer) — the read-only layer
// every help surface (graph_help tool, se:help skill, renderer) projects from.
export { helpEntry, helpForRules, contextualHelp } from './viewer/help.js';
export type { HelpEntry, ContextualMeasure } from './viewer/help.js';
export { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS, HELP_ELEMENT_STATES } from './viewer/help-content.js';
export type { HelpContentEntry, HelpVocabEntry } from './viewer/help-content.js';

// Repo-Betriebs-Config (CR-GC-329) — hält die Urteilsschwellen der Architektur-Metriken
// an EINER Stelle und gibt sie mit den Kennzahlen heraus (graph_metrics.policy).
export {
  loadGraphcodeConfig,
  stripJsonComments,
  GraphcodeConfigSchema,
  ConfigError,
  CONFIG_FILENAME,
  DEFAULT_CONFIG,
  DEFAULT_FOCUS_THRESHOLD,
} from './config.js';
export type { GraphcodeConfig, LoadedConfig, PolicySource } from './config.js';

/** Default Kuzu store location relative to the repo root. */
export const KUZU_DIR = '.graphcode/kuzu';

/**
 * Wire a harness over a disk-backed Kuzu store at `<repoRoot>/.graphcode/kuzu`.
 * Caller must `await harness.initialize()` before mutating. NEVER `:memory:` —
 * persistence is on disk (REQ-disk-persistence).
 *
 * The live-update emitter is registered by default (REQ-mutation-emits-event):
 * every mutation emits exactly one live-update event. A host passes `onUpdateEvent`
 * to wire its SSE broadcast; the harness core stays headless (no HTTP). The learning
 * feed (`<repoRoot>/.graphcode/trajectory.jsonl`) is materialized in the tool layer
 * as a projection of the operations log (CR-252), not by a harness hook.
 */
export async function createHarness(
  config: z.input<typeof HarnessConfigSchema>,
  opts?: {
    onUpdateEvent?: (event: import('./emit.js').LiveUpdateEvent) => void;
    /** Store-Lock entzogen (CR-GC-372) — der Aufrufer beendet seine Session. */
    onLockLost?: () => void;
  },
): Promise<GraphCodeHarness> {
  const cfg = HarnessConfigSchema.parse(config);
  const kuzuPath = join(cfg.repoRoot, KUZU_DIR);
  // CR-GC-329: die Betriebs-Config des Repos — sie hält die Urteilsschwellen der
  // Architektur-Metriken. Fehlt die Datei, gilt der benannte contracts-Startwert
  // (`source: 'default'`); ist sie da und schemawidrig, bricht der Start hier ab,
  // statt still auf Defaults zu fallen.
  const graphcodeConfig = loadGraphcodeConfig(cfg.repoRoot);
  // graphcode owns the per-repo `.graphcode/` workspace (SPEC §4). Kuzu opens the
  // store at `kuzuPath` but needs its parent to exist — create it on first run.
  mkdirSync(dirname(kuzuPath), { recursive: true });
  const storage = new KuzuAdapter({
    // Dieselbe Descriptor-Herkunft wie im Gate (harness.ts) — die Policy ändert nur
    // die MT-Urteile, das DDL bleibt davon unberührt.
    ontology: createSeDescriptor(graphcodeConfig.config.metricPolicy),
    path: kuzuPath,
  });
  const hooks = new HookSystem({ preCommitTimeout: cfg.preCommitTimeout });
  registerEmitters(hooks, {
    onEvent: opts?.onUpdateEvent,
  });
  // O2 lock guards the store this factory just wired: <repoRoot>/.graphcode (CR-GC-218).
  // storePath enables the CR-GC-249 schema-drift guard (auto-reseed on meta-model change).
  return new GraphCodeHarness(cfg, storage, hooks, {
    lockDir: dirname(kuzuPath),
    storePath: kuzuPath,
    graphcodeConfig,
    onLockLost: opts?.onLockLost,
  });
}
