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
      node('FUNC-a', 'FUNC'),
      node('FUNC-b', 'FUNC'),
      node('FUNC-c', 'FUNC'),
      node('FLOW-x', 'FLOW'),
      node('FCHAIN-chain', 'FCHAIN'),
      node('TEST-int', 'TEST', {
        testRef: { file: 'tests/x.test.ts', level: 'integration' },
        testResult: 'passed',
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
    ],
  };
}

/** Same graph, nodes and edges reversed — a permutation, not a different model. */
function shuffled(g: Graph): Graph {
  return { nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
}

describe('TEST-views-auditor (CR-GC-317): RTM layers', () => {
  const md = renderRtm(fixture(), 'x');

  it('groups requirements by their compose anchor', () => {
    expect(md).toContain('### System (SYS.2)');
    expect(md).toContain('### funktional (SWE.1)');
    expect(md).toContain('### abgeleitet');
    expect(md).toContain('### ohne Anker (unassigned)');
  });

  it('places each requirement under the layer its anchor implies', () => {
    const section = (heading: string): string => {
      const start = md.indexOf(`### ${heading}`);
      const rest = md.slice(start + 1);
      const next = rest.indexOf('\n### ');
      return next === -1 ? rest : rest.slice(0, next);
    };
    expect(section('System (SYS.2)')).toContain('REQ-sys');
    expect(section('funktional (SWE.1)')).toContain('REQ-uc');
    expect(section('abgeleitet')).toContain('REQ-derived');
    expect(section('ohne Anker (unassigned)')).toContain('REQ-orphan');
  });

  it('lists a double-anchored REQ under BOTH layers — no invented winner', () => {
    // The load-bearing one. Collapsing to a single layer would be a silent modelling
    // decision made by the renderer.
    const rows = md.split('\n').filter((l) => l.includes('`REQ-both`'));
    expect(rows).toHaveLength(2);
  });

  it('counts a double-anchored REQ once in the coverage gap', () => {
    // REQ-both has no verify and appears twice — the gap must not double-count it.
    // Six REQs lack verify here: sys, uc, derived, both, orphan, chain… minus chain,
    // which TEST-int verifies. So five.
    expect(md).toMatch(/Coverage gap = 5 REQ without verify/);
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
