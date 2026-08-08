/**
 * TEST-help-projection (CR-GC-228) — help.ts is a pure projection (no DB): every
 * HelpEntry carries all three layers; helpForRules covers the live V3_RULES;
 * contextualHelp ranks BOTH rule and creation blockers (CR-GC-221), errors first.
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { RULE_TO_PHASE } from '@sigloch/contracts/se';
import { computeReadiness, ABSENT_CREATION_PROVIDER } from '../src/readiness.js';
import { helpEntry, helpForRules, contextualHelp } from '../src/viewer/help.js';

describe('TEST-help-projection (CR-GC-228): help.ts projects HELP_CONTENT + the live sources', () => {
  it('helpEntry returns all three layers for a panel / gate / rule / artifact', () => {
    for (const id of ['readiness', 'SRR', 'R-01', 'fmea']) {
      const e = helpEntry(id);
      expect(e, id).toBeDefined();
      expect(e!.plain.length).toBeGreaterThan(0);
      expect(e!.se.length).toBeGreaterThan(0);
      expect((e!.prompt ?? '').length, `${id} prompt`).toBeGreaterThan(0); // these four carry an exact-prompt
    }
    // Derived skeleton: a rule carries severity + owning gate from the live registries.
    const r01 = helpEntry('R-01')!;
    expect(r01.kind).toBe('rule');
    expect(r01.severity).toBe('error');
    // The gate comes from the live map, so assert THAT it is derived from it — not a
    // literal. Pinning 'SRR' here is what let the readiness model drift away from
    // contracts' RULE_TO_PHASE on 21 rules without a test noticing (CR-GC-312).
    expect(r01.ownedByGate).toBe(RULE_TO_PHASE['R-01']);
    expect(r01.source).toBe('derived');
    // A gate uses its INCOSE label; an artifact its catalog label; a token has no prompt.
    expect(helpEntry('SRR')!.title).toMatch(/System Requirements Review/);
    expect(helpEntry('fmea')!.kind).toBe('artifact');
    const tok = helpEntry('REQ')!;
    expect(tok.kind).toBe('token');
    expect(tok.prompt).toBeUndefined();
    // Unknown id → undefined.
    expect(helpEntry('NOPE-999')).toBeUndefined();
  });

  it('helpForRules covers every live V3_RULES rule, grouped by owning gate (no hand-count)', () => {
    const groups = helpForRules();
    const covered = new Set(Object.values(groups).flat().map((e) => e.id));
    for (const r of SE_DESCRIPTOR.rules as Array<{ id: string }>) {
      expect(covered.has(r.id), `rule ${r.id} not in helpForRules`).toBe(true);
    }
    // Grouping follows RULE_TO_PHASE, so check the rule lands in the group that map
    // names — not in a group this test remembers (CR-GC-312).
    expect(groups[RULE_TO_PHASE['R-01']].map((e) => e.id)).toContain('R-01');
    expect(groups.impl.map((e) => e.id)).toEqual(expect.arrayContaining(['MS-01', 'MS-02']));
  });

  it('contextualHelp ranks BOTH rule and creation blockers, errors first (CR-GC-221)', () => {
    const violations: RuleViolation[] = [
      { ruleId: 'R-02', severity: 'warning', elementId: 'FUNC-x', message: 'FUNC-x does not satisfy any requirement' },
      { ruleId: 'R-01', severity: 'error', elementId: 'REQ-y', message: 'REQ-y has no verification trace' },
    ];
    const graph: Pick<Graph, 'nodes' | 'edges'> = {
      nodes: [{ uid: 'REQ-y', type: 'REQ', name: 'y', description: '', attributes: {} }],
      edges: [],
    };
    // ABSENT provider → phase gates block on their required creations (PDR: fmea/trade, …).
    const report = computeReadiness(violations, graph, ABSENT_CREATION_PROVIDER);
    const measures = contextualHelp(report, violations);

    const kinds = new Set(measures.map((m) => m.blockerKind));
    expect(kinds.has('rule')).toBe(true);
    expect(kinds.has('creation')).toBe(true);
    // A known creation blocker (fmea, a PDR creation) is surfaced, keyed on the artifact id.
    const fmea = measures.find((m) => m.blockerKind === 'creation' && m.entry.id === 'fmea');
    expect(fmea).toBeDefined();
    expect(fmea!.entry.kind).toBe('artifact');
    expect(fmea!.gateId).toBeTruthy();
    // Every measure carries the help layers.
    for (const m of measures) {
      expect(m.entry.plain.length).toBeGreaterThan(0);
      expect(m.entry.se.length).toBeGreaterThan(0);
    }
    // Errors rank before warnings.
    const firstWarning = measures.findIndex((m) => m.severity === 'warning');
    const lastError = measures.map((m) => m.severity).lastIndexOf('error');
    if (firstWarning >= 0 && lastError >= 0) expect(lastError).toBeLessThan(firstWarning);
  });
});
