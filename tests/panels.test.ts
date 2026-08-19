/**
 * TEST-dashboard-panels (CR-GC-115) — the headless MOD-dashboard data-layer.
 *
 * graphcode ships the read-only view-models behind each panel; the Cytoscape
 * renderer lives in graph-view-edit. Asserts the shapers project real MCP-tool
 * outputs into panels: readiness with a blocking drill-down
 * (REQ-readiness-transparent), recommendations that surface the CR-GC-203
 * fix-context (fixHint + top ranked candidate), the artifact traffic-light
 * (REQ-artifact-freshness), and the subscribe→panel mapping
 * (FUNC-subscribe-updates). All shapers are pure (REQ-dashboard-readonly).
 *
 * Real disk Kuzu (temp dir) for the readiness/violations inputs. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { scoreReadiness } from '../src/readiness.js';
import {
  readinessPanel,
  recommendationsPanel,
  artifactFreshness,
  analysisFreshness,
  artifactsPanel,
  creationCurrencyProvider,
  impactPanel,
  healthPanel,
  panelsForEvent,
} from '../src/viewer/panels.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { LiveUpdateEvent } from '../src/emit.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

// REQ-uncovered has no verify trace → R-01; TEST-cover is the candidate to link.
const FIXTURE = {
  elements: [
    { id: 'REQ-uncovered', type: 'REQ', name: 'Uncovered requirement', description: 'needs a verifying test' },
    { id: 'TEST-cover', type: 'TEST', name: 'Coverage test', description: '' },
  ],
  traces: [] as Array<{ source: string; target: string; type: string }>,
};

describe('TEST-dashboard-panels: headless MOD-dashboard data-layer (CR-GC-115)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-panels-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('readinessPanel exposes 4 phase + 4 impl gates each with a blocking drill-down (REQ-readiness-transparent)', () => {
    const panel = readinessPanel(scoreReadiness(harness));
    expect(typeof panel.compliancePct).toBe('number');
    expect(panel.phaseGates).toHaveLength(4);
    expect(panel.implGates).toHaveLength(4);
    for (const g of [...panel.phaseGates, ...panel.implGates]) {
      expect(Array.isArray(g.blocking)).toBe(true); // the drill-down, not just a light
      expect(typeof g.passed).toBe('boolean');
    }
  });

  it('recommendationsPanel surfaces fixHint + the top ranked candidate, error-first (uses CR-GC-203 item 1)', () => {
    const recs = recommendationsPanel(harness.evaluateRules());
    expect(recs.total).toBeGreaterThan(0);
    expect(recs.items[0].severity).toBe('error'); // error-severity ranks first

    const r01 = recs.items.find((i) => i.ruleId === 'R-01' && i.elementId === 'REQ-uncovered');
    expect(r01).toBeDefined();
    expect(r01!.fixHint).toBeTruthy();
    expect(r01!.topCandidate?.id).toBe('TEST-cover');
  });

  it('artifactFreshness + artifactsPanel give the live/stale/absent traffic-light (REQ-artifact-freshness)', () => {
    expect(artifactFreshness(true, false)).toBe('live');
    expect(artifactFreshness(true, true)).toBe('stale');
    expect(artifactFreshness(false, false)).toBe('absent');

    // Render rows are classified by mtime (staleVsGraph); labels come from the catalog.
    const panel = artifactsPanel([
      { id: 'srs', exists: true, staleVsGraph: false },
      { id: 'rtm', exists: true, staleVsGraph: true },
      { id: 'icd', exists: false, staleVsGraph: false },
    ]);
    expect(panel.liveCount).toBe(1);
    expect(panel.staleCount).toBe(1);
    expect(panel.absentCount).toBe(1);
    expect(panel.artifacts.every((a) => a.kind === 'render')).toBe(true);
  });

  it('CR-GC-222: analysis rows classify by scope-currency, NEVER mtime', () => {
    expect(analysisFreshness('current')).toBe('live');
    expect(analysisFreshness('stale')).toBe('stale');
    expect(analysisFreshness('absent')).toBe('absent');

    const panel = artifactsPanel([
      { id: 'rtm', exists: true, staleVsGraph: true }, // render → stale by mtime
      { id: 'fmea', currency: 'stale' }, // analysis → stale by scope
      // A creation is NEVER mtime-classified: staleVsGraph is ignored, only currency counts.
      { id: 'conops', exists: true, staleVsGraph: false, currency: 'absent' },
    ]);
    const byId = (id: string) => panel.artifacts.find((a) => a.id === id)!;
    expect(byId('rtm').kind).toBe('render');
    expect(byId('rtm').freshness).toBe('stale');
    expect(byId('fmea').kind).toBe('analysis');
    expect(byId('fmea').freshness).toBe('stale');
    // conops carries a "fresh" mtime signal but its currency is absent → red (no mtime leakage).
    expect(byId('conops').kind).toBe('analysis');
    expect(byId('conops').freshness).toBe('absent');
  });

  it('CR-GC-222: two groups, IRR relabeled "Assumption Review", labels are names not ids', () => {
    const panel = artifactsPanel([
      { id: 'fmea', currency: 'current' },
      { id: 'assumption-review', currency: 'current' },
      { id: 'srs', exists: true, staleVsGraph: false },
    ]);
    const byId = (id: string) => panel.artifacts.find((a) => a.id === id)!;
    // The renamed IRR is "Assumption Review" and is graphcode-specific (not labeled INCOSE).
    expect(byId('assumption-review').label).toBe('Assumption Review');
    expect(byId('assumption-review').group).toBe('graphcode');
    // INCOSE/SE-standard rows keep the incose group + real artifact names (not the id).
    expect(byId('fmea').group).toBe('incose');
    expect(byId('srs').label).toBe('Requirements Spec (SRS)');
    expect(panel.artifacts.every((a) => a.label !== a.id)).toBe(true);
  });

  it('CR-GC-222: creationCurrencyProvider supplies CR-221 readiness with analysis currency', () => {
    const provider = creationCurrencyProvider([
      { id: 'fmea', currency: 'stale' },
      { id: 'conops', currency: 'current' },
    ]);
    expect(provider('fmea')).toBe('stale');
    expect(provider('conops')).toBe('current');
    expect(provider('trade')).toBe('absent'); // never analyzed → 🔴 absent
  });

  it('panelsForEvent maps invalidation domains to the panels to refresh, deduped (FUNC-subscribe-updates)', () => {
    const event: LiveUpdateEvent = { type: 'invalidate', domains: ['rules', 'readiness'], ts: new Date().toISOString() };
    const panels = panelsForEvent(event);
    expect(panels).toContain('recommendations');
    expect(panels).toContain('readiness');
    expect(panels.filter((p) => p === 'readiness')).toHaveLength(1); // deduped across domains
  });

  it('impactPanel + healthPanel are pure read-only shapers', () => {
    expect(impactPanel({ rootId: 'MOD-x', nodeCount: 5, edgeCount: 7 })).toEqual({
      root: 'MOD-x',
      blastRadiusNodes: 5,
      blastRadiusEdges: 7,
    });
    const h = healthPanel({ status: 'ok', store: 'reachable', gate: 'functional', versions: { ontology: '3.4.0' } });
    expect(h.ok).toBe(true);
    expect(h.versions.ontology).toBe('3.4.0');
  });
});
