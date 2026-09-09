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

export { GraphCodeHarness } from './kernel/harness.js';
export { HookSystem } from './kernel/hooks.js';
export type { HookType, HookResult, HookData, HookHandler, HookOptions, HookSystemConfig } from './kernel/hooks.js';

// MCP-stdio tool surface (CR-GC-101) — graph instead of grep, gate-symmetric writes.
export { bindToolsToHarness } from './surface/mcp-tools.js';
export type { MCPTool, MCPToolRegistry } from './kernel/tool-contract.js';

// MCP-stdio server (CR-GC-111) — bind the registry to @modelcontextprotocol/sdk
// over stdio (REQ-single-transport); `graphcode mcp` (src/cli.ts) is the entry.
export { bindRegistryToMcpServer, buildMcpServer, serveStdio } from './surface/mcp-server.js';

// Hook emission (CR-GC-102) — live-update event + version cache. The learning
// feed is a projection of the operations log (CR-252, materializeTrajectory), not
// a hook — no parallel write path.
export { registerEmitters, computeDomains, makeUpdateEventHook, ResponseCache } from './surface/emit.js';
export { materializeTrajectory } from './projections/trajectory.js';
export type { UpdateDomain, LiveUpdateEvent, RegisterEmittersOptions } from './surface/emit.js';

// Format-E codec (CR-GC-103) — deterministic, commit-/merge-safe round-trip.
export { GraphCodeCodec } from './projections/codec.js';

// Graph→Markdown/JSON re-exporter (CR-GC-113, MOD-docs) — the single SSOT sync
// path: render the live in-memory graph back into commit-able docs.
export {
  exportGraphJson,
  isCanonicalSnapshot,
  exportMarkdown,
  MarkdownViewSchema,
  MARKDOWN_VIEWS,
  VIEW_FILENAMES,
} from './projections/exporter.js';
export type { MarkdownView } from './projections/exporter.js';

// New-member bootstrap (CR-GC-122) — fill an EMPTY member graph from ungoverned
// Format-E THROUGH the gate (FUNC-import / REQ-bootstrap-through-gate). Distinct
// from harness.seedFromJson() (a direct load of the already-governed SSOT).
export { bootstrap, TEMPLATE_FORMAT_E, BootstrapResultSchema } from './surface/bootstrap.js';
export type { BootstrapResult, BootstrapMode } from './surface/bootstrap.js';

// Readiness scorer (CR-GC-107) — family compliance from contracts V3_RULES (L2), no foreign BQ rules.
export { scoreReadiness, computeReadiness, getFamilyRuleIds } from './kernel/measure/readiness.js';
export type { ReadinessReport, ReadinessDimension } from './kernel/measure/readiness.js';

// CLI scaffold lifecycle (CR-GC-112) — self-contained `init|update|remove` installer (MOD-cli).
export { scaffold, CliCommandSchema, InstallResultSchema } from './surface/scaffold.js';
export type { CliCommand, InstallResult } from './surface/scaffold.js';

// ===========================================================================
// Viewer surface (`src/surface/`) — PROVISIONAL. The read-only data layer an
// external live viewer/renderer (`graph-view-edit`) plugs into. graphcode itself
// stays headless; these exports stabilize when that renderer lands. See README
// "Viewer integration — coming soon". Live-update events come from `./emit.js`.
// ===========================================================================

// Host + read-only SSE bridge (CR-GC-114, MOD-host-bridge) — owns the single
// Kuzu store and serves /health + /events (SSE) to a live viewer. Read-only:
// no mutating HTTP verb is reachable (the write path is MCP-stdio).
export { HostBridge, serveHost } from './surface/host.js';
export type { HostBridgeOptions } from './surface/host.js';
// SCHEMA-health-report (CR-GC-414) — der Vertrag der /health-Antwort, damit ein
// Konsument die Form pruefen kann statt sie zu erraten.
export { HealthPayloadSchema } from './surface/health.js';
export type { HealthPayload } from './surface/health.js';

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
export { callHost, HOST_SOCK_BASENAME, startHostSocket } from './surface/host-shim.js';
export type { HostSocket } from './surface/host-shim.js';

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
} from './projections/panels.js';
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
} from './projections/panels.js';

export type {
  HarnessConfig,
  MutateCommand,
  MutateResult,
  RuleViolation,
  MutateTier,
} from '@sigloch/contracts/harness';

// Implementation-plan ordering (CR-GC-209) — the testable core behind the `se-plan` skill.
export { deriveImplPlan } from './loop/se-plan.js';
export type { ImplPlanResult } from './loop/se-plan.js';

// Durable operations log (CR-GC-232 → CR-207) — the one family-wide implementation
// now lives in the store module (@sigloch/graph-api-core); re-exported here for the
// host/CLI that resume the version and read the trail. No local audit-log fork (former FileAuditLog lifted to the store).
export { FileOperationsLog, AUDIT_FILE, AUDIT_BASENAME, DEFAULT_COMPACT_BYTES } from '@sigloch/graph-api-core';
export type { AuditEntry, OperationsLog } from '@sigloch/graph-api-core';

// In-context help (CR-GC-227 content + CR-GC-228 data layer) — the read-only layer
// every help surface (graph_help tool, se:help skill, renderer) projects from.
export { helpEntry, helpForRules, contextualHelp } from './projections/help.js';
export type { HelpEntry, ContextualMeasure } from './projections/help.js';
export { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS, HELP_ELEMENT_STATES } from './projections/help-content.js';
export type { HelpContentEntry, HelpVocabEntry } from './projections/help-content.js';

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
} from './kernel/config.js';
export type { GraphcodeConfig, LoadedConfig, PolicySource } from './kernel/config.js';

export { elementToNode } from './kernel/element-node.js';
// CR-GC-475: Composition Root und Store-Pfad liegen in ihrer Schicht; das Barrel re-exportiert.
export { KUZU_DIR } from './kernel/workspace.js';
export { createHarness } from './surface/create-harness.js';
// CR-GC-491: DER Messaufbau — ein Bootstrap fuer Rig, Spike, Alternativenvergleich und Test.
// Er komponiert ueber `createHarness`, damit die Repo-Config und der policy-gebaute Descriptor
// mitreisen; `new GraphCodeHarness(...)` faellt still auf DEFAULT_CONFIG zurueck.
export { openMeasured, discriminate, stampLine } from './surface/measured.js';
export type { Measured, Provenance, PolicyProvenance, Discrimination, OpenMeasuredOptions } from './surface/measured.js';
