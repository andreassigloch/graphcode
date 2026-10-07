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
import { countByStage } from '@sigloch/graphcode-client';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { getFamilyRuleIds, MARK_LABELS } from '../src/kernel/measure/readiness.js';
import { ALL_RULE_DEFS, Mark, STAGE_SETS } from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

/** Name der Stufe einer Regel, aus dem Katalog gelesen (CR-GC-757). */
const stufenName = (ruleId: string): string => {
  const st = ALL_RULE_DEFS.find((r) => r.id === ruleId)!.stage;
  return st === 'immer' ? 'immer' : STAGE_SETS[st - 1]!;
};

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

  it('returns the ReadinessReport shape for a clean gated member (no error finding, no compliance percentage)', async () => {
    const tools = bindToolsToHarness(harness);
    const applied = await harness.mutate(CLEAN_MEMBER);
    expect(applied.success).toBe(true);

    const report = await tools.graph_readiness.handler({});

    // Shape: marks + per-rule counts + sorted raw violations + timestamp.
    // CR-GC-758 (CR-SM-402): the compliance percentage is gone without a replacement — not kept as an empty field.
    expect(report).not.toHaveProperty('compliance');
    expect(report.marks.map((m) => m.id)).toEqual(Mark.options);
    expect(harness.getGraph().nodes.length).toBe(4);
    // "No errors" is now said by the findings themselves: the clean member carries no error finding.
    const detail = await tools.graph_readiness.handler({ detail: true });
    expect(detail.violations.filter((v) => v.severity === 'error')).toEqual([]);
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
    // A warning is not an error: R-02 reports as a warning, and the report carries no error finding.
    const r02 = report.violations.filter((v) => v.ruleId === 'R-02');
    expect(r02.length).toBe(report.violationsByRule['R-02']);
    expect(r02.every((v) => v.severity === 'warning')).toBe(true);
    expect(report.violations.filter((v) => v.severity === 'error')).toEqual([]);
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
    expect(JSON.stringify(summary).length).toBeLessThan(JSON.stringify(detail).length);

    // detail:true restores the full lists.
    expect(detail.violations.length).toBeGreaterThanOrEqual(1);
    expect(detail.marks.some((m) => m.holding.length > 0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CR-GC-757: findings per stage — the other projection of the SAME rule stream.
  // (Before: CR-GC-325, eight percentage scores per dimension with a denominator.
  // The dimension is gone; what is left is a count of what reports, per stage.)
  // CR-GC-758: the stream is the REPORT's (`violations`, gate catalogue incl. code conformance) —
  // the findings the marks are computed from —, no longer the steering snapshot.
  // -------------------------------------------------------------------------

  it('stages (CR-GC-757/758): all 13 stages in order, a plain count of the report\'s findings each, in summary and detail', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const summary = await tools.graph_readiness.handler({});
    const detail = await tools.graph_readiness.handler({ detail: true });
    // The findings of the report — only `detail:true` lists them; the summary counts the same ones.
    const befunde = detail.violations;
    expect(befunde.length).toBeGreaterThan(0);

    for (const report of [summary, detail]) {
      // Completeness: a MISSING stage must not read as "nothing reports here" — all 13, in order.
      expect(report.stages.map((s) => s.name)).toEqual([...STAGE_SETS, 'immer']);
      expect(report.stages).toHaveLength(13);
      for (const s of report.stages) {
        // A count, nothing else: no score, no denominator, no verdict.
        expect(Object.keys(s).sort(), s.name).toEqual(['findings', 'name']);
        expect(Number.isInteger(s.findings) && s.findings >= 0, s.name).toBe(true);
      }
      // The sum is the number of findings of the report — nothing dropped, nothing counted twice.
      expect(report.stages.reduce((n, s) => n + s.findings, 0)).toBe(befunde.length);
      // Each stage counts exactly the findings of the rules the catalogue puts there.
      for (const s of report.stages) {
        const erwartet = befunde.filter((v) => stufenName(v.ruleId) === s.name).length;
        expect(s.findings, s.name).toBe(erwartet);
      }
      // The same function the client (viewer) counts with — no second way to count.
      expect(report.stages).toEqual(countByStage(befunde).map((s) => ({ name: s.name, findings: s.findings })));
      // The old block is gone, not kept beside the new one.
      expect(report).not.toHaveProperty('dimension_readiness');
    }
    // The fixture really has findings (R-02 on the orphan FUNC, stage Funktion) — otherwise 13 zeros would pass.
    expect(summary.stages.find((s) => s.name === 'Funktion')!.findings).toBeGreaterThanOrEqual(1);
    expect(summary.stages).toEqual(detail.stages);
  });

  // CR-GC-758: der Bericht hat EINEN Befundstrom. Vorher (CR-GC-560) stand hier „graph_generate liest
  // denselben Snapshot wie graph_readiness" — das gilt nicht mehr: der Bericht zaehlt seine Stufen in den
  // Befunden der Marken (Gate-Katalog inkl. Code-Abgleich), die Schrittwahl weiter im Steuerkatalog.
  it('the stages of the report count the same findings as the marks; graph_generate keeps counting in the steering catalogue', async () => {
    const tools = bindToolsToHarness(harness);
    expect((await harness.mutate(CLEAN_MEMBER)).success).toBe(true);
    expect((await harness.mutate(ORPHAN_FUNC)).success).toBe(true);

    const report = await tools.graph_readiness.handler({ detail: true });
    const schluessel = (v: { ruleId: string; elementId?: string }) => `${v.ruleId}@${v.elementId ?? ''}`;
    const imBericht = new Set(report.violations.map(schluessel));

    // Every finding that holds a mark is a finding of the report — the marks read no second stream.
    const haltend = report.marks.flatMap((m) => m.holding);
    expect(haltend.length, 'fixture holds at least one mark').toBeGreaterThan(0);
    for (const h of haltend) expect(imBericht.has(schluessel(h)), schluessel(h)).toBe(true);
    // …and the stages sum exactly those findings: one number per stage, from the same list.
    expect(report.stages.reduce((n, s) => n + s.findings, 0)).toBe(report.violations.length);
    // Every finding that holds a mark is counted in the stage its rule belongs to.
    for (const h of haltend) {
      expect(report.stages.find((s) => s.name === stufenName(h.ruleId))!.findings, schluessel(h)).toBeGreaterThanOrEqual(1);
    }

    // The step choice counts in the steering snapshot (ALL_RULE_DEFS) — its own catalogue, its own numbers.
    const step = await tools.graph_generate.handler({});
    const snapshot = takeSteeringSnapshot(harness.getGraph(), harness.getMetricPolicy());
    expect(step.readiness.length, 'fixture has findings, so stages carry a count').toBeGreaterThan(0);
    expect(step.readiness).toEqual(
      snapshot.stages.filter((s) => s.findings > 0).map((s) => ({ stage: s.name, findings: s.findings })),
    );
    expect(step.readiness.reduce((n, s) => n + s.findings, 0)).toBe(snapshot.violations.length);
    // Und die Fokus-Stufe ist eine, in der der Snapshot wirklich Befunde zaehlt.
    expect(step.focusStage).not.toBeNull();
    if (step.focusStage && !step.focusStage.startsWith('seed:')) {
      expect(step.readiness.some((d) => d.stage === step.focusStage)).toBe(true);
    }
  });
});
