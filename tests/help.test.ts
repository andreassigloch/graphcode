/**
 * TEST-help-projection (CR-GC-228) — help.ts is a pure projection (no DB): every
 * HelpEntry carries all three layers; helpForRules covers the live catalog, grouped by mark;
 * contextualHelp explains the failing rules, errors first.
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, DEFAULT_METRIC_POLICY, Mark } from '@sigloch/contracts/se';
import { MARK_LABELS } from '../src/kernel/measure/readiness.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import { helpEntry, helpForRules, contextualHelp, RULES_WITHOUT_MARK } from '../src/projections/help.js';
import { TOOL_HELP } from '../src/projections/tool-help.js';

describe('TEST-help-projection (CR-GC-228): help.ts projects HELP_CONTENT + the live sources', () => {
  it('helpEntry returns all three layers for a panel / mark / rule / artifact', () => {
    for (const id of ['readiness', 'SRR', 'R-01', 'fmea']) {
      const e = helpEntry(id);
      expect(e, id).toBeDefined();
      expect(e!.plain.length).toBeGreaterThan(0);
      expect(e!.se.length).toBeGreaterThan(0);
      expect((e!.prompt ?? '').length, `${id} prompt`).toBeGreaterThan(0); // these four carry an exact-prompt
    }
    // Derived skeleton: a rule carries severity, stage and mark from the live registries.
    const r01 = helpEntry('R-01')!;
    expect(r01.kind).toBe('rule');
    expect(r01.severity).toBe('error');
    // Stage and mark come from the rule definition, so assert THAT they are derived from it —
    // not a literal (CR-GC-312: a pinned gate is how the model drifted on 21 rules unnoticed).
    const def = (id: string) => ALL_RULE_DEFS.find((r) => r.id === id)!;
    expect(r01.stage).toBe(def('R-01').stage);
    expect(r01.mark).toBe(def('R-01').mark);
    // A rule over all elements belongs to no single mark.
    const immer = ALL_RULE_DEFS.find((r) => r.stage === 'immer' && helpEntry(r.id))!;
    expect(helpEntry(immer.id)).toMatchObject({ stage: 'immer' });
    expect(helpEntry(immer.id)!.mark).toBeUndefined();
    expect(r01.source).toBe('derived');
    // A mark uses its label; an artifact its catalog label; a token has no prompt.
    expect(helpEntry('SRR')!.title).toMatch(/System Requirements Review/);
    expect(helpEntry('fmea')!.kind).toBe('artifact');
    const tok = helpEntry('REQ')!;
    expect(tok.kind).toBe('token');
    expect(tok.prompt).toBeUndefined();
    // Unknown id → undefined.
    expect(helpEntry('NOPE-999')).toBeUndefined();
  });

  it('helpForRules covers every live V3_RULES rule, grouped by mark (no hand-count)', () => {
    const groups = helpForRules();
    const covered = new Set(Object.values(groups).flat().map((e) => e.id));
    for (const r of SE_DESCRIPTOR.rules as Array<{ id: string }>) {
      expect(covered.has(r.id), `rule ${r.id} not in helpForRules`).toBe(true);
    }
    // The groups are the marks plus the one for rules that belong to none.
    expect(Object.keys(groups)).toEqual([...Mark.options, RULES_WITHOUT_MARK]);
    // Grouping follows the rule definition, so check each rule lands in the group ITS mark
    // names — not in a group this test remembers (CR-GC-312).
    for (const [group, entries] of Object.entries(groups)) {
      for (const e of entries) expect(ALL_RULE_DEFS.find((r) => r.id === e.id)!.mark ?? RULES_WITHOUT_MARK, e.id).toBe(group);
    }
    // No rule twice.
    const ids = Object.values(groups).flat().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // CR-GC-748: nur noch Regelbefunde. Die „creation blocker" (CR-GC-221) und das nicht durchschrittene
  // Gate (CR-GC-746) sind mit der Gate-Rechnung entfallen — was eine Marke haelt, IST ein Regelbefund.
  it('contextualHelp explains the failing rules, one measure each, errors first', () => {
    const violations: RuleViolation[] = [
      { ruleId: 'R-02', severity: 'warning', elementId: 'FUNC-x', message: 'FUNC-x does not satisfy any requirement' },
      { ruleId: 'R-01', severity: 'error', elementId: 'REQ-y', message: 'REQ-y has no verification trace' },
    ];
    const measures = contextualHelp(violations);
    expect(measures.map((m) => m.entry.id)).toEqual(['R-01', 'R-02']);
    for (const m of measures) {
      expect(m.entry.kind).toBe('rule');
      expect(m.entry.plain.length).toBeGreaterThan(0);
      expect(m.entry.se.length).toBeGreaterThan(0);
    }
  });

  it('CR-GC-748: ein leerer Graph ergibt keine leere Liste — die Existenz-Regel des Systems ist die Massnahme', () => {
    const leer: Graph = { nodes: [], edges: [] };
    const befunde = takeSteeringSnapshot(leer, DEFAULT_METRIC_POLICY).violations.map((v) => ({
      ruleId: v.rule_id, severity: v.severity, elementId: v.element_id, message: v.message,
    }));
    const measures = contextualHelp(befunde);
    expect(measures.length).toBeGreaterThan(0);
    expect(measures.every((m) => ALL_RULE_DEFS.find((r) => r.id === m.entry.id)?.role === 'existence')).toBe(true);
  });

  it('die Marken erklaeren sich: jede hat einen Eintrag, und die Werkzeug-Hilfe nennt das Feld und alle Marken', () => {
    for (const id of Mark.options) expect(helpEntry(id)).toMatchObject({ kind: 'mark', title: MARK_LABELS[id] });
    const se = TOOL_HELP.graph_readiness!.se;
    expect(se).toContain('`marks`');
    for (const id of Mark.options) expect(se).toContain(id);
    for (const alt of ['phaseGates', 'implGates', 'phase_readiness', 'stateLabel']) expect(se).not.toContain(alt);
  });
});
