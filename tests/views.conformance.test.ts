/**
 * TEST-views-conformance (CR-GC-308) — a view may only read what the ontology
 * and the rules declare.
 *
 * The failure class this guards against is "compliance 1.0 on an empty view": the
 * graph is rule-clean, every gate is green, and the document still renders `—`,
 * because the exporter walks an edge or an attribute key that nothing produces. It
 * is silent by construction — no rule fires, no test fails, the number on the
 * dashboard is perfect. The Graphview field test named it the single most important
 * finding.
 *
 * Four instances existed (FMEA attribute keys, FMEA mitigation edge, Trade `role`
 * vs `label`, MS→CR compose). Fixing them is CR-GC-308's other half; THIS file is
 * the part that stops the fifth.
 *
 * The rule: where a contracts rule already checks a fact, the rule is the source and
 * the view merely renders it — same edges, same attribute keys.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRACE_PATTERNS } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import { exportMarkdown, MARKDOWN_VIEWS } from '../src/exporter.js';

/**
 * Comments stripped. These greps assert what the CODE reads — the doc comments
 * deliberately quote the old, wrong vocabulary to explain why it was wrong, and a
 * naive grep would either fail on that prose or force us to delete the explanation.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const VIEW_SOURCES = ['helpers', 'srs', 'incose', 'graphcode'].map((f) => {
  const raw = readFileSync(new URL(`../src/views/${f}.ts`, import.meta.url), 'utf8');
  return { file: `src/views/${f}.ts`, text: raw, code: stripComments(raw) };
});

/** Every (source, type, target) the meta-model declares, as a lookup. */
const declaredPairs = new Set(
  TRACE_PATTERNS.map((p) => `${p.source} ${p.type} ${p.target}`),
);

function isDeclared(source: string, type: string, target: string): boolean {
  return declaredPairs.has(`${source} ${type} ${target}`) || declaredPairs.has(`${source} ${type} *`);
}

describe('CR-GC-308: no exporter walks an undeclared node pair', () => {
  it('MS compose CR is NOT in the meta-model — the premise of the dead-branch fix', () => {
    // Pinned explicitly: if a future contracts bump ever declares it, this test goes
    // red and whoever removed the branch gets told to reconsider, rather than the
    // branch quietly staying wrong in the other direction.
    expect(isDeclared('MS', 'compose', 'CR')).toBe(false);
    // What IS legal, and what the views must use instead:
    expect(isDeclared('CR', 'relation', 'MS')).toBe(true);
    expect(isDeclared('MS', 'compose', 'REQ')).toBe(true);
  });

  it('no view resolves a CR through the illegal MS→CR compose edge', () => {
    // Behavioural, not a source grep: a graph wired ONLY the illegal way must yield
    // no CR anywhere. The dead branch was invisible precisely because the legal
    // `relation` branch sat next to it and the union filled the hole — so greping
    // for it is fragile, while this fails the moment someone re-adds the union.
    const illegalOnly: Graph = {
      nodes: [
        { uid: 'MS-1', type: 'MS', name: 'Erster', description: 'MS.', attributes: {} },
        { uid: 'CR-x', type: 'CR', name: 'Irgendein CR', description: 'CR.', attributes: { status: 'open' } },
      ],
      edges: [{ sourceId: 'MS-1', targetId: 'CR-x', edgeType: 'compose', attributes: {} }],
    };
    // changelog: the CR still EXISTS, so it is listed — but under "(unassigned)",
    // never under MS-1. Suppressing it entirely would be the opposite error.
    const changelog = exportMarkdown(illegalOnly, 'changelog', 'x');
    const msSection = changelog.slice(changelog.indexOf('## `MS-1`'), changelog.indexOf('## (unassigned)'));
    expect(msSection, 'MS-1 must claim no CR').toContain('— no CR —');
    expect(changelog.slice(changelog.indexOf('## (unassigned)'))).toContain('CR-x');

    // implplan / intplan roll CRs up per milestone — MS-1 must come out empty.
    for (const view of ['implplan', 'intplan'] as const) {
      expect(exportMarkdown(illegalOnly, view, 'x'), view).not.toContain('CR-x');
    }
  });

  it('…while the LEGAL relation edge still resolves it (the fix removed only the dead half)', () => {
    const legal: Graph = {
      nodes: [
        { uid: 'MS-1', type: 'MS', name: 'Erster', description: 'MS.', attributes: {} },
        { uid: 'CR-x', type: 'CR', name: 'Irgendein CR', description: 'CR.', attributes: { status: 'open' } },
      ],
      edges: [{ sourceId: 'CR-x', targetId: 'MS-1', edgeType: 'relation', attributes: {} }],
    };
    for (const view of ['changelog', 'implplan', 'intplan'] as const) {
      expect(exportMarkdown(legal, view, 'x'), view).toContain('CR-x');
    }
  });

  it('REQ relation REQ is undeclared — the FMEA mitigation column read it anyway', () => {
    // This is why the mitigation column was structurally unfillable: R-18 flags the
    // edge the exporter was looking for, so a compliant graph can never contain one.
    expect(isDeclared('REQ', 'relation', 'REQ')).toBe(false);
    expect(isDeclared('REQ', 'compose', 'REQ')).toBe(true);
  });
});

describe('CR-GC-308: the FMEA view reads the keys FM-01..03 write', () => {
  // The exact vocabulary of @sigloch/contracts/se fmea-rules.ts.
  const RULE_KEYS = ['severity', 'occurrence', 'detection'];
  const INVENTED_KEYS = [/attributes\['S'\]/, /attributes\['O'\]/, /attributes\['D'\]/];

  const fmeaSource = VIEW_SOURCES.find((s) => s.file === 'src/views/graphcode.ts')!.code;

  it('uses the FM-01 attribute names, not the invented single letters', () => {
    for (const key of RULE_KEYS) expect(fmeaSource).toContain(key);
    for (const bad of INVENTED_KEYS) expect(fmeaSource).not.toMatch(bad);
  });

  it('carries no local Action-Priority formula', () => {
    // CR-SM-229 (actionPriority/apMethod in contracts) is not published, so the AP
    // column is dropped rather than guessed. The `S >= 8 ? High : ...` cutoffs were
    // invented here and matched no standard — a second source of truth for a
    // safety-relevant classification is worse than no column.
    expect(fmeaSource).not.toMatch(/>=\s*8\s*\?\s*'High'/);
  });
});

describe('CR-GC-308: rendering a rule-clean FMEA graph fills every column', () => {
  /** A risk REQ modelled exactly as FM-01/02/03 prescribe. */
  function fmeaGraph(): Graph {
    const n = (uid: string, type: string, name: string, attributes: Record<string, unknown> = {}) => ({
      uid,
      type,
      name,
      description: `${name}.`,
      attributes,
    });
    return {
      nodes: [
        n('REQ-ausfall', 'REQ', 'Store faellt aus', {
          kinds: ['risk'],
          severity: 9,
          occurrence: 3,
          detection: 4,
        }),
        n('REQ-backup', 'REQ', 'Automatisches Backup', { kinds: ['mitigation'] }),
        n('TEST-ausfall', 'TEST', 'Ausfalltest', {
          // CR-SM-231b: das Ergebnis haengt am testRefs-Eintrag, nicht am Knoten.
          testRefs: [{ file: 'tests/ausfall.test.ts', tool: 'vitest', result: 'passed' }],
        }),
        n('REQ-langsam', 'REQ', 'Store wird langsam', {
          kinds: ['risk'],
          severity: 3,
          occurrence: 2,
          detection: 2,
        }),
        n('TEST-langsam', 'TEST', 'Lasttest', {
          testRefs: [{ file: 'tests/last.test.ts', tool: 'vitest', result: 'pending' }],
        }),
      ],
      edges: [
        { sourceId: 'REQ-ausfall', targetId: 'REQ-backup', edgeType: 'compose', attributes: {} },
        { sourceId: 'TEST-ausfall', targetId: 'REQ-ausfall', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-langsam', targetId: 'REQ-langsam', edgeType: 'verify', attributes: {} },
      ],
    };
  }

  it('renders S/O/D from the rule-declared attributes', () => {
    const md = exportMarkdown(fmeaGraph(), 'fmea', 'x');
    expect(md).toMatch(/\| 9 \| 3 \| 4 \|/);
  });

  it('fills the mitigation column from the compose edge FM-02 prescribes', () => {
    // Before the fix this column was empty in all 16 rows of the field test — the
    // exporter looked for a `relation` edge that R-18 forbids.
    expect(exportMarkdown(fmeaGraph(), 'fmea', 'x')).toContain('REQ-backup');
  });

  it('distinguishes "test exists" from "test passed" (FM-03)', () => {
    const md = exportMarkdown(fmeaGraph(), 'fmea', 'x');
    // REQ-ausfall has a PASSED test, REQ-langsam only a pending one. Both carry a
    // verify edge — the old view showed ✓ for both, which is the dangerous reading.
    const rows = md.split('\n').filter((l) => l.startsWith('|') && l.includes('faellt aus'));
    const pending = md.split('\n').filter((l) => l.startsWith('|') && l.includes('wird langsam'));
    expect(rows[0]).toContain('✓');
    expect(pending[0]).toContain('✗');
  });
});

describe('CR-GC-308: Trade view and se-trade skill agree on the attribute key', () => {
  it('the skill writes `label`, the same key the exporter reads', () => {
    const skill = readFileSync(new URL('../.claude/commands/se-trade.md', import.meta.url), 'utf8');
    expect(skill).toContain('attributes.label');
    // `role` was the invention; `label` is the family convention, already declared on
    // MS -relation-> MS[depends-on] in TRACE_PATTERNS.
    expect(skill).not.toContain('attributes.role');
  });

  it('a decision written the way the skill says renders in trade.md', () => {
    const graph: Graph = {
      nodes: [
        { uid: 'CR-wahl', type: 'CR', name: 'Store-Wahl', description: 'Kuzu statt Neo4j.', attributes: { status: 'done' } },
        { uid: 'MOD-store', type: 'MOD', name: 'store', description: 'Der Store.', attributes: {} },
      ],
      edges: [
        { sourceId: 'CR-wahl', targetId: 'MOD-store', edgeType: 'relation', attributes: { label: 'decides' } },
      ],
    };
    const md = exportMarkdown(graph, 'trade', 'x');
    expect(md).toContain('CR-wahl');
    expect(md).toContain('decides');
  });
});

describe('CR-GC-308: every view still renders (no regression from the key changes)', () => {
  it('all 15 views produce a GENERATED header on an empty graph', () => {
    for (const v of MARKDOWN_VIEWS) {
      const md = exportMarkdown({ nodes: [], edges: [] }, v, 'x');
      expect(md, v).toContain('GENERATED by @sigloch/graphcode exportMarkdown');
    }
  });
});
