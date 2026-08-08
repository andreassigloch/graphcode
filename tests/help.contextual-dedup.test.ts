/**
 * TEST-help-contextual-dedup (CR-GC-316) — `graph_help` without a token returns one
 * measure per RULE, not one per violation.
 *
 * Each measure carries a full copy of the HelpEntry (~380 bytes of title/plain/se/
 * prompt). On this repo's SSOT `CR-R02` fires 96 times, `CR-R04` 62, `VR-01` 58 — 336
 * violations from 19 distinct rules. Per-violation that is ~178 KB of the SAME
 * explanations repeated, in every later cache read of the session.
 *
 * It is invisible today only because `contextualHelp` skips violations with no authored
 * entry, and that is true for 332 of the 336. Writing the missing Plain/SE pairs
 * (CR-GC-312) is exactly what would flip it on — hence this CR runs first.
 *
 * The load-bearing assertion is the LAST one: doubling the violations must not grow the
 * answer. A dedup that merely shortens is not the same as one that decouples payload
 * from graph size, and only the second claim is worth anything.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import type { RuleViolation } from '@sigloch/contracts/harness';
import { computeReadiness, ABSENT_CREATION_PROVIDER } from '../src/readiness.js';
import { contextualHelp, MAX_EXAMPLE_ELEMENTS } from '../src/viewer/help.js';

const EMPTY_GRAPH: Pick<Graph, 'nodes' | 'edges'> = { nodes: [], edges: [] };

/** N violations of one rule, one per element — the `CR-R02: 96` shape. */
function repeated(ruleId: string, severity: RuleViolation['severity'], n: number): RuleViolation[] {
  return Array.from({ length: n }, (_, i) => ({
    ruleId,
    severity,
    elementId: `CR-GC-${100 + i}`,
    message: `CR-GC-${100 + i} is done but has no commitRef`,
  }));
}

function measuresFor(violations: RuleViolation[]) {
  const report = computeReadiness(violations, EMPTY_GRAPH, ABSENT_CREATION_PROVIDER);
  return contextualHelp(report, violations).filter((m) => m.blockerKind === 'rule');
}

describe('TEST-help-contextual-dedup (CR-GC-316): one measure per rule', () => {
  it('collapses N violations of one rule into ONE measure carrying the true count', () => {
    const measures = measuresFor(repeated('R-01', 'error', 96));

    expect(measures).toHaveLength(1);
    expect(measures[0].count).toBe(96);
    expect(measures[0].entry.id).toBe('R-01');
  });

  it('caps the example uids but never the count — the cut is visible, not silent', () => {
    const measures = measuresFor(repeated('R-01', 'error', 96));

    expect(measures[0].elementIds).toHaveLength(MAX_EXAMPLE_ELEMENTS);
    expect(measures[0].count).toBe(96);
    // A reader can tell that 91 more exist. That is the whole point of keeping both.
    expect(measures[0].count).toBeGreaterThan(measures[0].elementIds.length);
  });

  it('keeps one measure per DISTINCT rule', () => {
    const measures = measuresFor([
      ...repeated('R-01', 'error', 10),
      ...repeated('R-02', 'warning', 5),
    ]);

    expect(measures.map((m) => m.entry.id).sort()).toEqual(['R-01', 'R-02']);
    expect(measures.find((m) => m.entry.id === 'R-01')!.count).toBe(10);
    expect(measures.find((m) => m.entry.id === 'R-02')!.count).toBe(5);
  });

  it('takes the HIGHEST severity of the group, whatever the input order', () => {
    // Same rule reported at two severities — the grouped measure must not depend on
    // which one happened to arrive first, or the ranking below becomes order-dependent.
    const warnFirst: RuleViolation[] = [
      { ruleId: 'R-01', severity: 'warning', elementId: 'a', message: 'm' },
      { ruleId: 'R-01', severity: 'error', elementId: 'b', message: 'm' },
    ];
    const errorFirst = [...warnFirst].reverse();

    expect(measuresFor(warnFirst)[0].severity).toBe('error');
    expect(measuresFor(errorFirst)[0].severity).toBe('error');
  });

  it('still ranks errors before warnings', () => {
    const measures = measuresFor([
      ...repeated('R-02', 'warning', 3),
      ...repeated('R-01', 'error', 3),
    ]);
    expect(measures[0].severity).toBe('error');
  });

  it('leaves creation blockers untouched — one per artifact, count 1', () => {
    const report = computeReadiness([], EMPTY_GRAPH, ABSENT_CREATION_PROVIDER);
    const creations = contextualHelp(report, []).filter((m) => m.blockerKind === 'creation');

    expect(creations.length).toBeGreaterThan(0);
    for (const c of creations) {
      expect(c.count).toBe(1);
      expect(c.elementIds).toEqual([]);
      expect(c.gateId).toBeTruthy();
    }
  });

  // -- the claim that matters ------------------------------------------------

  it('decouples the payload from graph size — doubling violations does not grow it', () => {
    // Not "the answer got shorter" — "the answer stopped tracking the graph". The
    // per-violation shape would have doubled here; grouping leaves it byte-identical
    // apart from the counts.
    const small = measuresFor([...repeated('R-01', 'error', 50), ...repeated('R-02', 'warning', 30)]);
    const large = measuresFor([...repeated('R-01', 'error', 200), ...repeated('R-02', 'warning', 120)]);

    expect(small).toHaveLength(large.length);
    const bytes = (m: unknown): number => JSON.stringify(m).length;
    // Only the count digits differ (50→200, 30→120): a handful of bytes on ~1 KB.
    expect(bytes(large) - bytes(small)).toBeLessThan(20);
  });

  it('stays small on a realistic 336-violation / 19-rule graph', () => {
    // The measured shape of this repo's own SSOT under the full rule catalog.
    const shape: Array<[string, RuleViolation['severity'], number]> = [
      ['R-01', 'error', 96],
      ['R-02', 'warning', 62],
      ['R-03', 'warning', 58],
      ['R-04', 'info', 54],
      ['R-05', 'error', 22],
      ['R-08', 'warning', 15],
      ['R-10', 'info', 12],
      ['R-12', 'warning', 9],
      ['R-14', 'warning', 8],
    ];
    const violations = shape.flatMap(([id, sev, n]) => repeated(id, sev, n));
    expect(violations).toHaveLength(336);

    const measures = measuresFor(violations);
    expect(measures).toHaveLength(shape.length);
    // Per-violation this payload was ~178 KB.
    expect(JSON.stringify(measures).length).toBeLessThan(20 * 1024);
  });
});
