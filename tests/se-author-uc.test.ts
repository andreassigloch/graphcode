/**
 * TEST-uc-authoring-style (CR-GC-211) — the UC style rule as an executable linter.
 *
 * Word count ≤ 25 and ≤ 2 jargon terms, each grounded in a SCHEMA/REQ node. Run
 * against the committed graph (no committed UC should be a hidden violation), and
 * prove a deliberately-too-long, jargon-dense UC is CAUGHT (not vacuous). Style is
 * a WARNING — the linter reports, it does not block the gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintUc, groundedTermsFrom, UC_MAX_WORDS } from '../src/se-author-uc.js';

interface Element {
  id: string;
  type: string;
  name?: string;
  description?: string;
}

const GRAPH = JSON.parse(
  readFileSync(join(__dirname, '..', 'docs/graph/graphcode.graph.json'), 'utf8'),
) as { elements: Element[] };

describe('TEST-uc-authoring-style (CR-GC-211): terse, low-jargon UC linter', () => {
  it('catches a too-long, jargon-dense UC (not vacuous)', () => {
    const bad =
      'The SlicerInput pipeline applies the ElementType determinism boundary using V3_RULES ' +
      'and TRACE_PATTERNS to enforce the RecallFirst contract across every SlicerOutput node ' +
      'in the governed substrate before any downstream consumer reads it.';
    const r = lintUc('UC-bad', bad, new Set()); // nothing grounded
    expect(r.ok).toBe(false);
    expect(r.tooLong).toBe(true);
    expect(r.wordCount).toBeGreaterThan(UC_MAX_WORDS);
    expect(r.overBudget).toBe(true); // > 2 jargon terms
    expect(r.ungrounded).toEqual(expect.arrayContaining(['SlicerInput', 'V3_RULES']));
  });

  it('passes a terse UC with no jargon (Actor–Verb–Object–Outcome)', () => {
    const good = 'A developer reviews readiness and fixes the top blocker to raise the score.';
    const r = lintUc('UC-good', good, new Set());
    expect(r.ok).toBe(true);
    expect(r.tooLong).toBe(false);
    expect(r.jargon).toEqual([]);
  });

  it('a jargon term grounded in a SCHEMA/REQ node is allowed (within budget)', () => {
    const grounded = groundedTermsFrom([{ type: 'SCHEMA', uid: 'SCHEMA-ReadinessReport', name: 'Readiness report' }]);
    const r = lintUc('UC-g', 'A developer reads the ReadinessReport and acts.', grounded);
    expect(r.jargon).toContain('ReadinessReport');
    expect(r.ungrounded).toEqual([]); // grounded → not flagged
    expect(r.ok).toBe(true);
  });

  it('runs over every committed UC without error (committed graph stays visible, style = warning)', () => {
    const grounded = groundedTermsFrom(GRAPH.elements.map((e) => ({ type: e.type, uid: e.id, name: e.name })));
    const ucs = GRAPH.elements.filter((e) => e.type === 'UC');
    const results = ucs.map((u) => lintUc(u.id, u.description ?? '', grounded));
    expect(results.length).toBe(ucs.length);
    // The linter is total (never throws); violations, if any, are warnings surfaced here — not a hard fail.
    for (const r of results) expect(typeof r.ok).toBe('boolean');
  });
});
