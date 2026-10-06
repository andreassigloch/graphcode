/**
 * TEST-dashboard-panels (CR-GC-115) — the headless MOD-dashboard data-layer.
 *
 * graphcode ships the read-only view-models behind each panel; the Cytoscape
 * renderer lives in graph-view-edit. Asserts the shapers project real MCP-tool
 * outputs into panels: readiness with the findings that hold each mark
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
import { Mark } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { scoreReadiness } from '../src/kernel/measure/readiness.js';
import {
  readinessPanel,
  recommendationsPanel,
  artifactFreshness,
  analysisSignals,
  artifactsPanel,
  impactPanel,
  healthPanel,
  panelsForEvent,
} from '../src/projections/panels.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { LiveUpdateEvent } from '../src/surface/emit.js';

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

  it('readinessPanel exposes the marks, each with the findings that hold it (REQ-readiness-transparent)', () => {
    const panel = readinessPanel(scoreReadiness(harness));
    expect(typeof panel.compliancePct).toBe('number');
    expect(panel.marks.map((m) => m.id)).toEqual(Mark.options);
    for (const m of panel.marks) {
      expect(Array.isArray(m.holding)).toBe(true); // the drill-down, not just a light
      expect(m.reached).toBe(m.holding.length === 0);
    }
    // REQ-uncovered has no verifying test: an open mark SAYS so — the answer to "why not".
    const offen = panel.marks.find((m) => !m.reached)!;
    expect(panel.marks.some((m) => m.holding.some((h) => h.elementId === 'REQ-uncovered'))).toBe(true);
    expect(offen.holding.length).toBeGreaterThan(0);
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

  it('CR-GC-222/748: an analysis row reads on record or absent — NEVER mtime, and never stale', () => {
    const panel = artifactsPanel([
      { id: 'rtm', exists: true, staleVsGraph: true }, // render → stale by mtime
      { id: 'fmea', exists: true, staleVsGraph: true }, // analysis on record: the mtime signal is ignored
      { id: 'conops', exists: false, staleVsGraph: false },
    ]);
    const byId = (id: string) => panel.artifacts.find((a) => a.id === id)!;
    expect(byId('rtm').kind).toBe('render');
    expect(byId('rtm').freshness).toBe('stale');
    expect(byId('fmea').kind).toBe('analysis');
    expect(byId('fmea').freshness).toBe('live');
    expect(byId('conops').kind).toBe('analysis');
    expect(byId('conops').freshness).toBe('absent');
  });

  it('CR-GC-222: two groups, IRR relabeled "Assumption Review", labels are names not ids', () => {
    const panel = artifactsPanel([
      { id: 'fmea', exists: true },
      { id: 'assumption-review', exists: true },
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

  it('CR-GC-748: analysisSignals reads the stamps off the graph — one signal per analysis, on record or not', () => {
    const graph = (stamps: Record<string, unknown>) => ({
      nodes: [{ uid: 'SYS-x', type: 'SYS', name: 'x', description: '', attributes: { analysisFreshness: stamps } }],
    });
    const leer = analysisSignals(graph({}));
    expect(leer.length).toBeGreaterThan(0);
    expect(leer.every((sig) => sig.exists === false)).toBe(true);
    const mitFmea = analysisSignals(graph({ fmea: { graphVersion: 3 } }));
    expect(mitFmea.find((sig) => sig.id === 'fmea')!.exists).toBe(true);
    expect(mitFmea.filter((sig) => sig.exists).map((sig) => sig.id)).toEqual(['fmea']);
    // The signals feed the artifact tab as they are: every one is an analysis row of the catalog.
    expect(artifactsPanel(mitFmea).artifacts.every((a) => a.kind === 'analysis')).toBe(true);
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
