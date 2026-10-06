/**
 * TEST-readiness-model — CR-GC-125 acceptance test, rebuilt CR-GC-748.
 *
 * Proves the graphcode readiness model (REQ-readiness-model) is:
 *   (A) DEFINED from the family rule catalog (`@sigloch/contracts`) — never the aimprove BQ heuristic;
 *   (B) the marks SRR/PDR/CDR/TRR/Bau are read off the STAGE each rule carries at its definition
 *       (`ALL_RULE_DEFS[].mark`): every family rule lies before exactly one mark or belongs to every
 *       stage (`'immer'`) — nothing invented, nothing dropped, and no table of its own in graphcode;
 *   (C) the report passes the marks of the client through unchanged, and stays family-measured on
 *       the full SSOT.
 *
 * Gone with contracts 11 / graphcode-client 2 (CR-SM-395), and deleted here with them: the gate
 * partition `PHASE_GATE_RULES`, the four build gates bound to milestone ids, the required creations
 * per gate with their currency, the rule coverage per phase (`computePhaseReadiness`,
 * `currentPhaseGate`, CR-GC-296/745) and the precondition table (`RULE_PRECONDITION`, now `isDue`,
 * tested where it lives — contracts `se-rule-due.test.ts`). WHICH finding holds a mark is the
 * client's `marks.test.ts`; this file does not restate it.
 *
 * One integration block seeds the real SSOT on disk Kuzu (no mocks, no :memory:).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ALL_RULE_DEFS, Mark, MARK_STAGE } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from '../src/kernel/harness.js';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import {
  computeMarks,
  computeReadiness,
  scoreReadiness,
  getFamilyRuleIds,
  GRAPHCODE_INCOSE_SCOPE,
  MARK_LABELS,
} from '../src/kernel/measure/readiness.js';

const REPO_ROOT = join(__dirname, '..');

// --- (A) + (B): the model spans the family catalog, derived not invented ------

describe('TEST-readiness-model (A/B): model is defined over the family rules, lean scope', () => {
  const DEF = new Map(ALL_RULE_DEFS.map((r) => [r.id, r]));

  it('INCOSE scope is lean (graph is the single SE artifact)', () => {
    expect(GRAPHCODE_INCOSE_SCOPE).toBe('lean');
  });

  it('the marks are exactly the ones the catalog orders, each with a label', () => {
    expect(Object.keys(MARK_LABELS)).toEqual(Mark.options);
    expect(computeMarks([]).map((m) => m.id)).toEqual(Mark.options);
  });

  it('every family rule carries a stage; its mark is the one that stage lies before — or none for `immer`', () => {
    for (const id of getFamilyRuleIds()) {
      const def = DEF.get(id);
      expect(def, `${id} has no definition in ALL_RULE_DEFS`).toBeDefined();
      if (def!.stage === 'immer') {
        expect(def!.mark, id).toBeNull();
        continue;
      }
      expect(def!.mark, id).not.toBeNull();
      const vor = Mark.options[Mark.options.indexOf(def!.mark!) - 1];
      expect(def!.stage, id).toBeLessThanOrEqual(MARK_STAGE[def!.mark!]);
      if (vor) expect(def!.stage, id).toBeGreaterThan(MARK_STAGE[vor]);
    }
  });

  it('no family rule-ID is a foreign BQ-* rule', () => {
    for (const id of getFamilyRuleIds()) expect(/^BQ-/i.test(id)).toBe(false);
  });
});

// --- (C) unit: the report passes the marks through ---------------------------

describe('TEST-readiness-model (C): computeReadiness carries the marks of the client', () => {
  const graph: Pick<Graph, 'nodes' | 'edges'> = {
    nodes: [{ uid: 'REQ-x', type: 'REQ', name: 'x', description: '', attributes: {} }],
    edges: [],
  };
  const violations: RuleViolation[] = [
    { ruleId: 'R-01', severity: 'error', elementId: 'REQ-x', message: 'REQ-x has no verification trace' },
    { ruleId: 'R-02', severity: 'warning', elementId: 'FUNC-y', message: 'FUNC-y does not satisfy any requirement' },
  ];

  it('`marks` is `computeMarks` over the same findings — no second computation in between', () => {
    expect(computeReadiness(violations, graph).marks).toEqual(computeMarks(violations));
  });

  it('a mark is reached exactly when nothing holds it, and what holds it is one of the findings handed in', () => {
    const r = computeReadiness(violations, graph);
    for (const m of r.marks) {
      expect(m.reached, m.id).toBe(m.holding.length === 0);
      for (const h of m.holding) expect(violations).toContainEqual(h);
    }
    // An error holds the mark of its rule (read from the catalog, not written here) and every later one.
    const eigene = ALL_RULE_DEFS.find((d) => d.id === 'R-01')!.mark!;
    const ab = Mark.options.indexOf(eigene);
    for (const [i, m] of r.marks.entries()) {
      expect(m.holding.some((h) => h.ruleId === 'R-01'), m.id).toBe(i >= ab);
    }
  });

  it('no finding, no holder: every mark reads reached', () => {
    expect(computeReadiness([], graph).marks.every((m) => m.reached)).toBe(true);
  });
});

// --- (C-int) integration: the real SSOT ---------------------------------------

describe('TEST-readiness-model (C-int): scores the live SSOT, never BQ', () => {
  let measured: Measured;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    // CR-GC-492: Wurzel ECHT (Config + realRef-Aufloesung), Store im Wegwerf-Verzeichnis
    // (CR-GC-218 — der Live-Store gehoert einem laufenden Dev-Server). Der Handaufbau davor
    // fiel still auf DEFAULT_CONFIG statt auf graphcode.config.jsonc; heute zahlengleich,
    // invertierend sobald ein Budget wandert (CR-SM-303).
    measured = await openMeasured({
      graph: join(REPO_ROOT, 'docs', 'graph', 'graphcode.graph.json'),
      repoRoot: REPO_ROOT,
      systemId: 'graphcode',
      workspaceId: 'test-ws',
    });
    harness = measured.harness;
  });

  afterEach(async () => {
    await measured.close();
  });

  it('CR-GC-492: geurteilt wird mit der Config des Repos, nicht mit Startwerten', () => {
    expect(measured.provenance.policy.source).toBe('file');
  });

  it('report is lean-scoped with the five well-formed marks', () => {
    const r = scoreReadiness(harness);
    expect(r.incoseScope).toBe('lean');
    expect(r.marks.map((m) => m.id)).toEqual(Mark.options);
    for (const m of r.marks) {
      expect(typeof m.reached).toBe('boolean');
      expect(m.reached).toBe(m.holding.length === 0);
      expect(m.label).toBe(MARK_LABELS[m.id]);
    }
  });

  it('no holder and no violation references a foreign BQ-* rule, and every holder is a family rule', () => {
    const r = scoreReadiness(harness);
    const familyIds = getFamilyRuleIds();
    for (const m of r.marks) {
      for (const h of m.holding) {
        expect(/^BQ-/i.test(h.ruleId)).toBe(false);
        expect(familyIds.has(h.ruleId), h.ruleId).toBe(true);
      }
    }
    for (const v of r.violations) expect(/^BQ-/i.test(v.ruleId)).toBe(false);
    for (const k of Object.keys(r.violationsByRule)) expect(/^BQ-/i.test(k)).toBe(false);
  });
});
