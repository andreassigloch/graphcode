/**
 * MOD-dashboard — headless panel data-layer (CR-GC-115).
 *
 * graphcode is NOT a viewer (the Cytoscape renderer is the next aise-family
 * project, graph-view-edit). What graphcode owns is the READ-ONLY data layer
 * behind every dashboard panel: pure functions that shape the MCP-tool outputs
 * (graph_readiness / graph_impact / rules_get_violations / host /health) into
 * view-models the external renderer mounts. No HTTP, no DOM, no mutation —
 * REQ-dashboard-readonly is structural (these are pure projections of read-only
 * inputs). The renderer fills FUNC-render-graph's mount-slot; these shape the
 * rest.
 *
 * @author andreas@siglochconsulting
 */
import type { ReadinessReport, ReadinessGate, CreationCurrency, CreationCurrencyProvider } from '../readiness.js';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { LiveUpdateEvent, UpdateDomain } from '../emit.js';

// ---------------------------------------------------------------------------
// FUNC-render-readiness + FUNC-render-impl-gates — readiness panel.
// REQ-readiness-transparent: every gate carries its blocking elements as a
// drill-down, so a closed gate shows WHY (not just a red light).
// ---------------------------------------------------------------------------

export interface GatePanel {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  /** The blocking elements — the drill-down behind the traffic light. */
  blocking: string[];
  /**
   * Structural completeness (CR-GC-250): ONE value per gate (covered/total) for
   * the panel; `missing[]` is the on-click per-leg drill-down, same mechanic as
   * `blocking`. REQ-completeness-single-value.
   */
  completeness: ReadinessGate['completeness'];
}

export interface ReadinessPanel {
  compliancePct: number;
  totalElements: number;
  elementsWithErrors: number;
  phaseGates: GatePanel[];
  implGates: GatePanel[];
}

function toGatePanel(g: ReadinessGate): GatePanel {
  return { id: g.id, label: g.label, passed: g.passed, score: g.score, blocking: g.blocking, completeness: g.completeness };
}

export function readinessPanel(report: ReadinessReport): ReadinessPanel {
  return {
    compliancePct: Math.round(report.compliance.score * 1000) / 10,
    totalElements: report.compliance.totalElements,
    elementsWithErrors: report.compliance.elementsWithErrors,
    phaseGates: report.phaseGates.map(toGatePanel),
    implGates: report.implGates.map(toGatePanel),
  };
}

// ---------------------------------------------------------------------------
// FUNC-render-recommendations — the TOP actions, graph-deduced from the
// violations (uses the CR-GC-203 item-1 fix-context: fixHint + the top ranked
// candidate). Severity-ordered, NOT a generator — just the highest-leverage
// fixes the rules already point to.
// ---------------------------------------------------------------------------

export interface RecommendationItem {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  elementId?: string;
  message: string;
  fixHint?: string;
  /** The single top-ranked candidate to link (CR-GC-203 items 1+3), if any. */
  topCandidate?: { id: string; type: string; name: string };
}

export interface RecommendationsPanel {
  items: RecommendationItem[];
  total: number;
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function recommendationsPanel(violations: RuleViolation[], limit = 5): RecommendationsPanel {
  const ranked = [...violations].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
  const items = ranked.slice(0, limit).map((v) => {
    const ctx = v.context as { candidate_targets?: Array<{ id: string; type: string; name: string }> } | undefined;
    return {
      ruleId: v.ruleId,
      severity: v.severity,
      elementId: v.elementId,
      message: v.message,
      fixHint: v.fixHint,
      topCandidate: ctx?.candidate_targets?.[0],
    };
  });
  return { items, total: violations.length };
}

// ---------------------------------------------------------------------------
// FUNC-render-artifacts — INCOSE-artifact freshness (REQ-artifact-freshness).
// Traffic-light: green = live (derivable from the current graph), yellow =
// a materialized doc exists but the graph changed since (stale), red = absent.
// ---------------------------------------------------------------------------

export type Freshness = 'live' | 'stale' | 'absent';

/**
 * Two artifact kinds with TWO distinct staleness mechanisms (CR-GC-222):
 * - `render`   — a deterministic `docs/views/*.md` projection; stale via file mtime vs graph.
 * - `analysis` — judgment work (FMEA/ConOps/Trade/…); stale when the analyzed SCOPE moved,
 *                NEVER via mtime. The single `staleVsGraph` boolean was the defect (it applied
 *                an mtime check to analyses that don't refresh on mtime).
 */
export type ArtifactKind = 'render' | 'analysis';

/** INCOSE/SE-standard vs graphcode-specific — so non-INCOSE rows are not mislabeled as INCOSE. */
export type ArtifactGroup = 'incose' | 'graphcode';

/** Catalog entry: the SSOT for an artifact's kind/group/label (labels are NAMES, never `id==label`). */
export interface ArtifactCatalogEntry {
  id: string;
  label: string;
  kind: ArtifactKind;
  group: ArtifactGroup;
}

/**
 * The canonical INCOSE-tab artifact catalog (readiness-artifact-model.md §6). Renders are the
 * deterministic CR-GC-220 views; the 5 analysis ids are exactly CR-GC-221's creation keys
 * (`conops`/`assumption-review`/`fmea`/`trade`/`implplan`). `irr` is renamed to "Assumption
 * Review" and grouped graphcode-specific (it is not a standard INCOSE artifact).
 */
export const ARTIFACT_CATALOG: readonly ArtifactCatalogEntry[] = [
  // Renders — INCOSE/SE-standard deterministic views (mtime-classified).
  { id: 'srs', label: 'Requirements Spec (SRS)', kind: 'render', group: 'incose' },
  { id: 'architecture', label: 'Architecture (SDD)', kind: 'render', group: 'incose' },
  { id: 'rtm', label: 'Req-Test Traceability Matrix', kind: 'render', group: 'incose' },
  { id: 'nfr', label: 'NFR Register', kind: 'render', group: 'incose' },
  { id: 'icd', label: 'Interface Control Document', kind: 'render', group: 'incose' },
  { id: 'testconcept', label: 'Test Concept', kind: 'render', group: 'incose' },
  { id: 'testmatrix', label: 'Test Matrix (VCRM)', kind: 'render', group: 'incose' },
  { id: 'intplan', label: 'Integration & Test Plan', kind: 'render', group: 'incose' },
  { id: 'changelog', label: 'Change Log', kind: 'render', group: 'incose' },
  { id: 'references', label: 'Requirements Traceability', kind: 'render', group: 'incose' },
  // Creations — judgment work (scope-classified, NEVER mtime).
  { id: 'conops', label: 'Concept of Operations', kind: 'analysis', group: 'incose' },
  { id: 'fmea', label: 'FMEA', kind: 'analysis', group: 'incose' },
  { id: 'trade', label: 'Trade Study', kind: 'analysis', group: 'incose' },
  { id: 'implplan', label: 'Implementation Plan', kind: 'analysis', group: 'incose' },
  { id: 'assumption-review', label: 'Assumption Review', kind: 'analysis', group: 'graphcode' },
];

/** Classify a RENDER artifact. `exists` = doc present; `staleVsGraph` = graph changed since render. */
export function artifactFreshness(exists: boolean, staleVsGraph: boolean): Freshness {
  if (!exists) return 'absent';
  return staleVsGraph ? 'stale' : 'live';
}

/** Classify an ANALYSIS artifact from its scope-currency — 🟢 current / 🟡 stale / 🔴 absent. */
export function analysisFreshness(currency: CreationCurrency): Freshness {
  return currency === 'current' ? 'live' : currency === 'stale' ? 'stale' : 'absent';
}

export interface ArtifactStatus {
  id: string;
  label: string;
  kind: ArtifactKind;
  group: ArtifactGroup;
  freshness: Freshness;
}

/** One artifact's freshness signal: render rows carry exists/staleVsGraph, analysis rows carry currency. */
export interface ArtifactSignal {
  id: string;
  /** RENDER: a materialized doc is present. */
  exists?: boolean;
  /** RENDER: the graph changed since the doc was generated (mtime). */
  staleVsGraph?: boolean;
  /** ANALYSIS: scope-currency of the judgment work (the ONLY signal read for analysis rows). */
  currency?: CreationCurrency;
}

export interface ArtifactsPanel {
  artifacts: ArtifactStatus[];
  liveCount: number;
  staleCount: number;
  absentCount: number;
}

/**
 * Shape artifact freshness signals into the tab view-model. The catalog decides each row's
 * kind/group/label; the kind decides WHICH mechanism classifies it — render rows go through
 * the mtime path, analysis rows through the scope-currency path (so a creation is NEVER
 * classified by mtime, even if a caller passes `staleVsGraph` — it is ignored). Renderer groups
 * by `group` to show "INCOSE / SE-standard" and "graphcode-specific" separately.
 */
export function artifactsPanel(signals: ArtifactSignal[]): ArtifactsPanel {
  const byId = new Map(ARTIFACT_CATALOG.map((e) => [e.id, e]));
  const statuses: ArtifactStatus[] = signals.map((s) => {
    const entry = byId.get(s.id);
    const kind: ArtifactKind = entry?.kind ?? 'render';
    const freshness =
      kind === 'analysis'
        ? analysisFreshness(s.currency ?? 'absent')
        : artifactFreshness(s.exists ?? false, s.staleVsGraph ?? false);
    return { id: s.id, label: entry?.label ?? s.id, kind, group: entry?.group ?? 'graphcode', freshness };
  });
  return {
    artifacts: statuses,
    liveCount: statuses.filter((s) => s.freshness === 'live').length,
    staleCount: statuses.filter((s) => s.freshness === 'stale').length,
    absentCount: statuses.filter((s) => s.freshness === 'absent').length,
  };
}

/**
 * Build the CreationCurrencyProvider that CR-GC-221's readiness scorer consumes (CR-GC-222
 * delivers the `analysis`-currency to 221). Maps each creation id → its scope-currency; an
 * unknown/never-analyzed creation reads as 🔴 absent.
 */
export function creationCurrencyProvider(
  analysis: Array<{ id: string; currency: CreationCurrency }>,
): CreationCurrencyProvider {
  const m = new Map(analysis.map((a) => [a.id, a.currency]));
  return (creation: string) => m.get(creation) ?? 'absent';
}

// ---------------------------------------------------------------------------
// FUNC-render-impact — blast-radius panel from graph_impact (live, not stored).
// ---------------------------------------------------------------------------

export interface ImpactPanel {
  root: string;
  blastRadiusNodes: number;
  blastRadiusEdges: number;
}

export function impactPanel(impact: { rootId: string; nodeCount: number; edgeCount: number }): ImpactPanel {
  return { root: impact.rootId, blastRadiusNodes: impact.nodeCount, blastRadiusEdges: impact.edgeCount };
}

// ---------------------------------------------------------------------------
// FUNC-render-health — health line from the host /health probe (not "lights on":
// store reachable + gate functional + ontology/rules/contracts versions).
// ---------------------------------------------------------------------------

export interface HealthPanel {
  ok: boolean;
  store: string;
  gate: string;
  versions: Record<string, unknown>;
}

export function healthPanel(health: {
  status?: string;
  store?: string;
  gate?: string;
  versions?: Record<string, unknown>;
}): HealthPanel {
  return {
    ok: health.status === 'ok',
    store: health.store ?? 'unknown',
    gate: health.gate ?? 'unknown',
    versions: health.versions ?? {},
  };
}

// ---------------------------------------------------------------------------
// FUNC-subscribe-updates — map a live-update event (CR-GC-114 SSE) to the panel
// ids that must refresh. The viewer subscribes once and re-fetches only those.
// ---------------------------------------------------------------------------

const DOMAIN_TO_PANELS: Record<UpdateDomain, string[]> = {
  graph: ['graph', 'impact', 'artifacts'],
  rules: ['recommendations', 'readiness'],
  readiness: ['readiness', 'implGates', 'artifacts'],
  suggestions: ['recommendations'],
};

/** Which panel ids a viewer should refresh for this invalidation event. */
export function panelsForEvent(event: LiveUpdateEvent): string[] {
  return [...new Set(event.domains.flatMap((d) => DOMAIN_TO_PANELS[d] ?? []))];
}
