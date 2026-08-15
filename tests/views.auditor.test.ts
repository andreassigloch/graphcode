/**
 * TEST-views-auditor (CR-GC-317) — the RTM shows which layer a requirement sits on, and
 * the VCRM shows which test covers a FUNC↔FUNC interface.
 *
 * Both facts were already in the graph and unreadable without a walk. A-SPICE separates
 * system requirements (SYS.2) from software ones (SWE.1); here that distinction IS the
 * compose anchor. Integration coverage sits four hops out
 * (`TEST -verify-> REQ <-satisfy- FCHAIN -compose-> FUNC`).
 *
 * Two assertions carry the weight and neither is about formatting:
 *   - a REQ under two anchors appears under BOTH layers (no invented winner), and
 *   - the render is order-independent — shuffling the input nodes must not change a byte,
 *     because a "deterministic view" that merely doesn't call Date() is not deterministic.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { renderRtm, renderTestMatrix } from '../src/views/incose.js';

function node(uid: string, type: string, attributes: Record<string, unknown> = {}): GraphNode {
  return { uid, type, name: uid, description: `${uid} beschreibt etwas.`, attributes };
}
function edge(sourceId: string, edgeType: string, targetId: string): GraphEdge {
  return { sourceId, targetId, edgeType, attributes: {} };
}

/**
 * One graph carrying every shape the CR cares about:
 *   - REQ-sys under SYS, REQ-uc under UC, REQ-derived under REQ-sys
 *   - REQ-both under SYS *and* UC — the double-anchor case
 *   - REQ-orphan with no anchor at all
 *   - FUNC-a ─io→ FLOW-x ─io→ FUNC-b, declared as FCHAIN-chain, verified by TEST-int
 *   - FUNC-c on the same FLOW but in NO chain — co-adjacency, not an interface
 */
function fixture(): Graph {
  return {
    nodes: [
      node('SYS-x', 'SYS'),
      node('UC-x', 'UC'),
      node('REQ-sys', 'REQ'),
      node('REQ-uc', 'REQ'),
      node('REQ-derived', 'REQ'),
      node('REQ-both', 'REQ'),
      node('REQ-orphan', 'REQ'),
      node('REQ-chain', 'REQ'),
      node('REQ-func', 'REQ'),
      node('REQ-mod', 'REQ'),
      node('MOD-x', 'MOD'),
      node('FUNC-a', 'FUNC'),
      node('FUNC-b', 'FUNC'),
      node('FUNC-c', 'FUNC'),
      node('FLOW-x', 'FLOW'),
      node('FCHAIN-chain', 'FCHAIN'),
      node('TEST-int', 'TEST', {
        // CR-SM-231/231b: 1:n, und das Ergebnis haengt am Eintrag.
        testRefs: [{ file: 'tests/x.test.ts', tool: 'vitest', level: 'integration', result: 'passed' }],
      }),
    ],
    edges: [
      edge('SYS-x', 'compose', 'REQ-sys'),
      edge('UC-x', 'compose', 'REQ-uc'),
      edge('REQ-sys', 'compose', 'REQ-derived'),
      edge('SYS-x', 'compose', 'REQ-both'),
      edge('UC-x', 'compose', 'REQ-both'),
      edge('FUNC-a', 'io', 'FLOW-x'),
      edge('FLOW-x', 'io', 'FUNC-b'),
      edge('FLOW-x', 'io', 'FUNC-c'),
      edge('FCHAIN-chain', 'compose', 'FUNC-a'),
      edge('FCHAIN-chain', 'compose', 'FUNC-b'),
      edge('FCHAIN-chain', 'satisfy', 'REQ-chain'),
      edge('TEST-int', 'verify', 'REQ-chain'),
      // CR-GC-318: the satisfy legs the one-hop version missed entirely.
      edge('FUNC-a', 'satisfy', 'REQ-func'),
      edge('MOD-x', 'satisfy', 'REQ-mod'),
    ],
  };
}

/** Same graph, nodes and edges reversed — a permutation, not a different model. */
function shuffled(g: Graph): Graph {
  return { nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
}

describe('TEST-views-auditor (CR-GC-317): RTM layers', () => {
  const md = renderRtm(fixture(), 'x');

  const section = (heading: string): string => {
    const start = md.indexOf(`### ${heading}`);
    const rest = md.slice(start + 1);
    const next = rest.indexOf('\n### ');
    return next === -1 ? rest : rest.slice(0, next);
  };

  it('groups requirements by the element that carries the assignment', () => {
    expect(md).toContain('### System (SYS.2)');
    expect(md).toContain('### funktional (SWE.1)');
    expect(md).toContain('### Integration (SWE.4)');
    expect(md).toContain('### Komponente (SWE.2/3)');
    expect(md).toContain('### ohne Anker (unassigned)');
  });

  it('finds the compose legs — SYS and UC', () => {
    expect(section('System (SYS.2)')).toContain('REQ-sys');
    expect(section('funktional (SWE.1)')).toContain('REQ-uc');
  });

  it('finds the SATISFY legs too — this is what CR-GC-317 missed (CR-GC-318)', () => {
    // 67 of this repo's 111 REQs are assigned ONLY over a satisfy edge. Reading `compose`
    // alone reported them as unanchored — a reporter gap sold as a model finding.
    expect(section('Komponente (SWE.2/3)')).toContain('REQ-func'); // FUNC -satisfy->
    expect(section('Komponente (SWE.2/3)')).toContain('REQ-mod'); // MOD  -satisfy->
    expect(section('Integration (SWE.4)')).toContain('REQ-chain'); // FCHAIN -satisfy->
  });

  it('resolves REQ→REQ transitively — "derived" is a provenance, not a layer', () => {
    // REQ-derived hangs under REQ-sys, which hangs under SYS-x. It IS a system
    // requirement. A separate "derived" bucket would be exactly the label the reporter
    // must not introduce.
    expect(section('System (SYS.2)')).toContain('REQ-derived');
    expect(md).not.toContain('### abgeleitet');
  });

  it('leaves only a genuinely unattached REQ unassigned', () => {
    expect(section('ohne Anker (unassigned)')).toContain('REQ-orphan');
    expect(section('ohne Anker (unassigned)')).not.toContain('REQ-func');
  });

  it('terminates on a REQ→REQ cycle instead of hanging', () => {
    // R-12 rules out 2-cycles on compose; longer ones are not excluded, and a renderer
    // must not be the thing that discovers that.
    const g = fixture();
    g.nodes.push(node('REQ-c1', 'REQ'), node('REQ-c2', 'REQ'));
    g.edges.push(edge('REQ-c1', 'compose', 'REQ-c2'), edge('REQ-c2', 'compose', 'REQ-c1'));
    expect(() => renderRtm(g, 'x')).not.toThrow();
  });

  it('lists a multi-assigned REQ under EVERY layer that reaches it — no invented winner', () => {
    // The load-bearing one. Collapsing to a single layer would be a silent modelling
    // decision made by the renderer.
    const rows = md.split('\n').filter((l) => l.includes('`REQ-both`'));
    expect(rows).toHaveLength(2);
  });

  it('counts a multi-assigned REQ once in the coverage gap', () => {
    // Seven REQs lack verify: sys, uc, derived, both, orphan, func, mod. REQ-chain is
    // verified by TEST-int. REQ-both appears twice and must not be double-counted.
    expect(md).toMatch(/Coverage gap = 7 REQ without verify/);
  });
});

describe('TEST-views-auditor (CR-GC-318): the committed SSOT', () => {
  it('leaves at most one REQ without a layer — asserted, not claimed', () => {
    // CR-GC-317 reported 68 unanchored REQs on this graph and called it a finding. It was
    // the one-hop lookup. Pinned against the real SSOT so the claim cannot drift back
    // into prose.
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'docs/graph/graphcode.graph.json'), 'utf8'),
    ) as { elements: Array<Record<string, unknown>>; traces: Array<Record<string, string>> };
    const graph: Graph = {
      nodes: raw.elements.map((e) => node(e.id as string, e.type as string)),
      edges: raw.traces.map((t) => edge(t.source, t.type, t.target)),
    };
    const md = renderRtm(graph, 'graphcode');
    const heading = md.split('\n').find((l) => l.startsWith('### ohne Anker'));
    const count = heading ? Number(/— (\d+) REQ/.exec(heading)?.[1] ?? 0) : 0;
    expect(count).toBeLessThanOrEqual(1);
  });
});

describe('TEST-views-auditor (CR-GC-317): VCRM rolled-up integration coverage', () => {
  const md = renderTestMatrix(fixture(), 'x');

  it('rolls the four-hop chain up to one row per interface', () => {
    expect(md).toContain('## Integrationsabdeckung (rolled-up)');
    const row = md.split('\n').find((l) => l.includes('`FUNC-a`') && l.includes('`FUNC-b`'));
    expect(row).toBeDefined();
    expect(row).toContain('`FLOW-x`');
    expect(row).toContain('`FCHAIN-chain`');
    expect(row).toContain('`TEST-int`');
  });

  it('carries the test level and the recorded result', () => {
    const row = md.split('\n').find((l) => l.includes('`FUNC-a`') && l.includes('`FUNC-b`'))!;
    expect(row).toContain('integration');
    expect(row).toContain('passed');
  });

  it('ignores co-adjacency at a shared FLOW — that is not a declared interface', () => {
    // FUNC-c reads FLOW-x but shares no FCHAIN with FUNC-a. Deriving a connection from
    // the shared FLOW alone is what taxed reuse quadratically (CR-GC-315).
    expect(md).not.toContain('`FUNC-c`');
  });

  it('renders an uncovered interface as a visible gap, not an empty cell', () => {
    const g = fixture();
    // Drop the verifying test — the interface stays declared, the coverage goes away.
    g.edges = g.edges.filter((e) => e.sourceId !== 'TEST-int');
    const bare = renderTestMatrix(g, 'x');
    const row = bare.split('\n').find((l) => l.includes('`FUNC-a`') && l.includes('`FUNC-b`'))!;
    expect(row).toContain('⚠ keine Abdeckung');
    expect(bare).toMatch(/0\/1 deklarierte FUNC↔FUNC-Verbindungen/);
  });
});

describe('TEST-views-auditor (CR-GC-317): determinism', () => {
  it('renders byte-identically twice', () => {
    expect(renderRtm(fixture(), 'x')).toBe(renderRtm(fixture(), 'x'));
    expect(renderTestMatrix(fixture(), 'x')).toBe(renderTestMatrix(fixture(), 'x'));
  });

  it('is independent of input order — a permuted graph renders the same bytes', () => {
    // The claim "deterministic view" is worth nothing if it only holds for one input
    // order: the graph arrives from Kuzu, from JSON and from the gate's in-memory array,
    // and those do not agree on order.
    expect(renderRtm(shuffled(fixture()), 'x')).toBe(renderRtm(fixture(), 'x'));
    expect(renderTestMatrix(shuffled(fixture()), 'x')).toBe(renderTestMatrix(fixture(), 'x'));
  });
});
