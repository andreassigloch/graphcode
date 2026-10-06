/**
 * TEST-mcp-readiness (CR-GC-129) — graph_readiness exposes family readiness over MCP.
 *
 * The readiness score (CR-GC-107 / MOD-readiness) was only reachable as a library
 * function — an agent over the MCP surface could not get it (the retired
 * GET /api/graph/readiness served it before CR-GC-111). graph_readiness binds
 * scoreReadiness(harness) to the registry so se-review / se-status read it over
 * the protocol.
 *
 * Real disk Kuzu on a temp repo, no mocks: spec a small graph through the gate,
 * then call the bound tool and assert the ReadinessReport shape AND that family
 * contracts rule-IDs (R-/RD-), never foreign BQ-*, drive the score.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { getFamilyRuleIds, MARK_LABELS } from '../src/kernel/measure/readiness.js';
import { ALL_RULE_DEFS, Mark } from '@sigloch/contracts/se';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  // Kuzu needs the .graphcode parent to exist (createHarness mkdirs it; direct construction doesn't).
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'auth-service' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A gate-valid member: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose (R-17).
const CLEAN_MEMBER: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: { kinds: ['non-functional'] } } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

// A FUNC with no satisfy edge → R-02 (FUNC must satisfy REQ, WARNING). Persists through the gate
// (delta semantics: only NEW error-violations block), so it surfaces in the readiness report.
const ORPHAN_FUNC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'FUNC-login', type: 'FUNC', name: 'Login flow', description: 'no satisfy edge', attributes: {} } },
];

describe('TEST-mcp-readiness: graph_readiness scores family readiness over the binding', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-readiness-mcp-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('returns the ReadinessReport shape for a clean gated member (compliance 1.0, no errors)', async () => {
    const tools = bindToolsToHarness(harness);
    const applied = await harness.mutate(CLEAN_MEMBER);
    expect(applied.success).toBe(true);

    const report = await tools.graph_readiness.handler({});

    // Shape: compliance dimension + per-rule counts + sorted raw violations + timestamp.
    expect(typeof report.compliance.score).toBe('number');
    expect(typeof report.compliance.label).toBe('string');
    expect(report.compliance.totalElements).toBe(harness.getGraph().nodes.length);
    expect(report.compliance.totalElements).toBe(4);
    expect(report.compliance.elementsWithErrors).toBe(0);
    expect(report.compliance.score).toBe(1);
    expect(Array.isArray(report.violations)).toBe(true);
    expect(typeof report.violationsByRule).toBe('object');
    // computedAt is a real ISO-8601 timestamp.
    expect(Number.isNaN(Date.parse(report.computedAt))).toBe(false);
  });

  it('is family-measured (R-/RD-), never BQ-: an R-02 warning drives violationsByRule', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    // The orphan FUNC is a WARNING (R-02), so the gate accepts it (no NEW error-violation).
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const report = await tools.graph_readiness.handler({ detail: true });
    const familyIds = getFamilyRuleIds();

    // The warning surfaced and is keyed by a family contracts rule-ID.
    expect(report.violationsByRule['R-02']).toBeGreaterThanOrEqual(1);
    // Every fired rule-ID is a family rule-ID; none is a foreign BQ-* rule.
    for (const ruleId of Object.keys(report.violationsByRule)) {
      expect(familyIds.has(ruleId)).toBe(true);
      expect(/^BQ-/i.test(ruleId)).toBe(false);
    }
    for (const v of report.violations) {
      expect(/^BQ-/i.test(v.ruleId)).toBe(false);
    }
    // A warning is not an error → compliance (error-severity) stays 1.0.
    expect(report.compliance.score).toBe(1);
  });

  // CR-GC-748 (contracts 11 / graphcode-client 2, CR-SM-395): das Werkzeug reicht die Marken des Clients
  // durch. Die Gates mit ihrem Zustand (CR-GC-745), die Bau-Gates und die zweite Achse `phase_readiness`
  // (CR-GC-296) gibt es nicht mehr — auch nicht als leeres Feld.
  describe('CR-GC-748: die Marken am Werkzeug', () => {
    const stufe = (ruleId: string) => ALL_RULE_DEFS.find((r) => r.id === ruleId)?.stage;

    it('Entwurf: fuenf Marken in Reihenfolge, je erreicht oder offen — und kein Gate-Feld daneben', async () => {
      const tools = bindToolsToHarness(harness);
      expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);

      const report = await tools.graph_readiness.handler({ detail: true });
      expect(report.marks.map((m) => m.id)).toEqual(Mark.options);
      for (const m of report.marks) {
        expect(m.reached).toBe(m.holding.length === 0);
        expect(m.label).toBe(MARK_LABELS[m.id]);
      }
      for (const alt of ['phaseGates', 'implGates', 'phase_readiness']) expect(report).not.toHaveProperty(alt);
      // Im Entwurf meldet keine Bindungsregel: nichts ist gebunden, kein Auftrag ist offen.
      expect(report.violations.filter((v) => stufe(v.ruleId) === 11)).toEqual([]);
      // Bau ist trotzdem nicht erreicht — es gibt Ungebautes, und das sagt ein Befund, kein Schweigen.
      const bau = report.marks.find((m) => m.id === 'Bau')!;
      expect(bau.reached).toBe(false);
      expect(bau.holding.length).toBeGreaterThan(0);
    });

    it('mit einer Bindung sind die Bindungsregeln faellig — die Funktion ohne Code haelt Bau', async () => {
      const tools = bindToolsToHarness(harness);
      expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
      expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);
      const bound = await tools.graph_mutate.handler({
        formatE: ['## Nodes', '### TEST', '~ TEST-reset', '@testRefs [{"file":"tests/reset.test.ts","tool":"vitest"}]'].join('\n'),
        consumerId: 'test',
      });
      expect(bound.success).toBe(true);

      const report = await tools.graph_readiness.handler({ detail: true });
      const bau = report.marks.find((m) => m.id === 'Bau')!;
      expect(bau.reached).toBe(false);
      expect(bau.holding.some((h) => h.elementId === 'FUNC-login' && stufe(h.ruleId) === 11)).toBe(true);
    });
  });

  // CR-GC-203 item 2 — graph_readiness summary mode keeps the result within the MCP limit.
  it('summary is the default (drops raw violations + what holds each mark, keeps verdicts + counts); detail:true restores them', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });

    // Summary drops the heavy per-element lists…
    expect(summary.violations).toEqual([]);
    for (const m of summary.marks) expect(m.holding).toEqual([]);
    // …but keeps the verdict per mark, scores + counts (the R-02 warning is still counted).
    expect(summary.marks.map((m) => [m.id, m.reached])).toEqual(detail.marks.map((m) => [m.id, m.reached]));
    expect(summary.violationsByRule['R-02']).toBeGreaterThanOrEqual(1);
    expect(summary.violationsByRule).toEqual(detail.violationsByRule);
    expect(summary.compliance.score).toBe(detail.compliance.score);
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(detail).length);

    // detail:true restores the full lists.
    expect(detail.violations.length).toBeGreaterThanOrEqual(1);
    expect(detail.marks.some((m) => m.holding.length > 0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CR-GC-325: the 8 RULE_TO_DIMENSION topic scores — the other projection of
  // the SAME rule stream. Before this CR `computeReadiness` ran inside nextStep
  // and seven of its eight results were thrown away; a dashboard that wanted the
  // architecture axis had to recompute it (which graph-view-edit actually did).
  // -------------------------------------------------------------------------

  it('dimension_readiness (CR-GC-325): all 8 dimensions, each with its denominator, in summary and detail', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });

    for (const report of [summary, detail]) {
      // Completeness: a MISSING dimension must not read as "all good" (req 5).
      expect(report.dimension_readiness.map((d) => d.dimension)).toEqual([
        'req',
        'uc',
        'arch',
        'alloc',
        'ver',
        'schema',
        'cr',
        'ms',
      ]);
      for (const d of report.dimension_readiness) {
        // The denominator is mandatory — a score without `applicable` is not
        // interpretable (req 4: ms reads 0 % off 67 findings over 15 elements).
        expect(typeof d.applicable, `${d.dimension}.applicable`).toBe('number');
        expect(typeof d.violations, `${d.dimension}.violations`).toBe('number');
        // contracts 9.x (CR-SM-270): score ist number | null — null heißt „nicht
        // messbar" (leere Kernmenge), nie 0 %.
        if (d.score === null) {
          expect(d.coreApplicable, `${d.dimension}: null nur bei leerer Kernmenge`).toBe(0);
        } else {
          expect(d.score).toBeGreaterThanOrEqual(0);
          expect(d.score).toBeLessThanOrEqual(1);
        }
        // CR-GC-514: reine Messung — das Ergebnis traegt kein Urteil `ready`.
        expect(Object.keys(d)).not.toContain('ready');
      }
    }
  });

  // CR-GC-560: dieselbe Invariante, jetzt gegen `graph_generate`. Sie hing vorher an
  // `graph_next_step` — dem zweiten Steuerungswerkzeug auf derselben Messung, das
  // CR-GC-561/562 entfernen. Die Frage bleibt dieselbe: EINE Rechnung, nicht zwei.
  it('is ONE computation, not two: graph_generate reads the same snapshot as graph_readiness', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const readiness = await tools.graph_readiness.handler({});
    const step = await tools.graph_generate.handler({});

    expect(step.readiness.length, 'fixture has findings, so dimensions are measurable').toBeGreaterThan(0);
    for (const d of step.readiness) {
      const score = readiness.dimension_readiness.find((r) => r.dimension === d.dimension);
      expect(score, `dimension ${d.dimension} missing from dimension_readiness`).toBeDefined();
      expect(d.score).toBe(score!.score);
      expect(d.violations).toBe(score!.violations);
    }
    // Und die Fokus-Dimension ist eine, die der Snapshot wirklich scort.
    if (step.focusDimension && !step.focusDimension.startsWith('seed:')) {
      expect(step.readiness.some((d) => d.dimension === step.focusDimension)).toBe(true);
    }
  });
});
