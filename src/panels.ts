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
import type { ReadinessReport, ReadinessGate } from './readiness.js';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { LiveUpdateEvent, UpdateDomain } from './emit.js';

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
}

export interface ReadinessPanel {
  compliancePct: number;
  totalElements: number;
  elementsWithErrors: number;
  phaseGates: GatePanel[];
  implGates: GatePanel[];
}

function toGatePanel(g: ReadinessGate): GatePanel {
  return { id: g.id, label: g.label, passed: g.passed, score: g.score, blocking: g.blocking };
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

/** Classify one artifact. `exists` = a materialized doc is present;
 *  `staleVsGraph` = the graph changed since that doc was generated. */
export function artifactFreshness(exists: boolean, staleVsGraph: boolean): Freshness {
  if (!exists) return 'absent';
  return staleVsGraph ? 'stale' : 'live';
}

export interface ArtifactStatus {
  id: string;
  label: string;
  freshness: Freshness;
}

export interface ArtifactsPanel {
  artifacts: ArtifactStatus[];
  liveCount: number;
  staleCount: number;
  absentCount: number;
}

export function artifactsPanel(
  artifacts: Array<{ id: string; label: string; exists: boolean; staleVsGraph: boolean }>,
): ArtifactsPanel {
  const statuses = artifacts.map((a) => ({
    id: a.id,
    label: a.label,
    freshness: artifactFreshness(a.exists, a.staleVsGraph),
  }));
  return {
    artifacts: statuses,
    liveCount: statuses.filter((s) => s.freshness === 'live').length,
    staleCount: statuses.filter((s) => s.freshness === 'stale').length,
    absentCount: statuses.filter((s) => s.freshness === 'absent').length,
  };
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
