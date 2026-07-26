/**
 * TEST-readiness-completeness / TEST-completeness-actor-bounded /
 * TEST-completeness-single-value — CR-GC-250 acceptance.
 *
 * Proves the structural completeness dimension closes the graph-view-edit
 * false-green (irr-3e4e26c A2/A12/A13): a gate reads NOT-green while a mandated
 * chain leg is empty, measured over the DRIVING population so absence counts —
 * even though no error-severity rule fires. Deterministic unit cases on the pure
 * computeReadiness (no mocks, no gate needed). Warnings are NOT promoted: the
 * gate verdict gains a completeness invariant, rule severities are untouched.
 */
import { describe, it, expect } from 'vitest';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { computeReadiness, summarizeReadiness } from '../src/readiness.js';
import { scoreCompleteness, COMPLETENESS_SLICES } from '../src/readiness-completeness.js';

type G = Pick<Graph, 'nodes' | 'edges'>;
const node = (uid: string, type: string, attributes: Record<string, unknown> = {}): Graph['nodes'][number] =>
  ({ uid, type, name: uid, description: '', attributes }) as Graph['nodes'][number];
const edge = (sourceId: string, targetId: string, edgeType: string) =>
  ({ sourceId, targetId, edgeType, attributes: {} }) as Graph['edges'][number];
const gate = (g: G, id: string) => computeReadiness([], g).phaseGates.find((x) => x.id === id)!;

// --- SRR: UC without an FCHAIN is never green (the headline defect) -----------

describe('CR-GC-250 SRR — UC chain completeness', () => {
  it('a UC with 0 FCHAIN drives SRR red though no error-severity rule fires', () => {
    const g: G = { nodes: [node('SYS-x', 'SYS'), node('UC-x', 'UC')], edges: [edge('SYS-x', 'UC-x', 'compose')] };
    const srr = gate(g, 'SRR');
    // SYS→UC covered; UC→FCHAIN + UC→REQ missing → 1/3, gate blocked.
    expect(srr.completeness.covered).toBe(1);
    expect(srr.completeness.total).toBe(3);
    expect(srr.passed).toBe(false);
    expect(srr.blocking.some((b) => b.includes('completeness') && b.includes('UC→FCHAIN'))).toBe(true);
    // The graph is error-clean — the old score (rules only) would have read 1.0.
    expect(computeReadiness([], g).violations.every((v) => v.severity !== 'error')).toBe(true);
  });

  it('completing the UC chain (FCHAIN + REQ) turns SRR green', () => {
    const g: G = {
      nodes: [node('SYS-x', 'SYS'), node('UC-x', 'UC'), node('FCHAIN-x', 'FCHAIN'), node('REQ-x', 'REQ')],
      edges: [edge('SYS-x', 'UC-x', 'compose'), edge('UC-x', 'FCHAIN-x', 'compose'), edge('UC-x', 'REQ-x', 'compose')],
    };
    const srr = gate(g, 'SRR');
    expect(srr.completeness.covered).toBe(srr.completeness.total);
    expect(srr.passed).toBe(true);
  });
});

// --- PDR: FCHAIN must be actor-bounded (trigger + consumer) -------------------

describe('CR-GC-250 PDR — FCHAIN actor-bounded', () => {
  const base = (): Graph['nodes'][number][] => [
    node('FCHAIN-c', 'FCHAIN'), node('FUNC-a', 'FUNC'), node('ACTOR-in', 'ACTOR'),
    node('ACTOR-out', 'ACTOR'), node('FLOW-in', 'FLOW'), node('FLOW-out', 'FLOW'),
  ];

  it('a chain with a function but no actor trigger/consumer holds PDR red', () => {
    const g: G = { nodes: base(), edges: [edge('FCHAIN-c', 'FUNC-a', 'compose')] };
    const pdr = gate(g, 'PDR');
    // FCHAIN→FUNC covered, actor-bounded missing → not complete.
    expect(pdr.completeness.missing.some((m) => m.startsWith('FCHAIN-actor-bounded'))).toBe(true);
    expect(pdr.passed).toBe(false);
  });

  it('ACTOR→FLOW→FUNC entry AND FUNC→FLOW→ACTOR exit makes the chain complete', () => {
    const g: G = {
      nodes: base(),
      edges: [
        edge('FCHAIN-c', 'FUNC-a', 'compose'),
        edge('ACTOR-in', 'FLOW-in', 'io'), edge('FLOW-in', 'FUNC-a', 'io'),   // trigger
        edge('FUNC-a', 'FLOW-out', 'io'), edge('FLOW-out', 'ACTOR-out', 'io'), // consumer
      ],
    };
    const pdr = gate(g, 'PDR');
    expect(pdr.completeness.covered).toBe(pdr.completeness.total);
    expect(pdr.passed).toBe(true);
  });

  it('trigger without consumer is still incomplete (both ends required)', () => {
    const g: G = {
      nodes: base(),
      edges: [
        edge('FCHAIN-c', 'FUNC-a', 'compose'),
        edge('ACTOR-in', 'FLOW-in', 'io'), edge('FLOW-in', 'FUNC-a', 'io'), // only entry
      ],
    };
    expect(gate(g, 'PDR').passed).toBe(false);
  });
});

// --- CDR: every FLOW carries a SCHEMA (schema-before-code) --------------------

describe('CR-GC-250 CDR — FLOW→SCHEMA', () => {
  it('a FLOW without a SCHEMA holds CDR red; adding the SCHEMA relation clears it', () => {
    const noSchema: G = { nodes: [node('FLOW-f', 'FLOW')], edges: [] };
    expect(gate(noSchema, 'CDR').passed).toBe(false);
    const withSchema: G = {
      nodes: [node('FLOW-f', 'FLOW'), node('SCHEMA-s', 'SCHEMA')],
      edges: [edge('FLOW-f', 'SCHEMA-s', 'relation')],
    };
    expect(gate(withSchema, 'CDR').passed).toBe(true);
  });
});

// --- TRR: concept stops counting as complete; binding required ---------------

describe('CR-GC-250 TRR — binding (testRef / realRef)', () => {
  it('a concept TEST (no testRef) is complete at CDR but incomplete at TRR', () => {
    const g: G = { nodes: [node('TEST-t', 'TEST', { concept: true, testRef: null })], edges: [] };
    expect(gate(g, 'CDR').passed).toBe(true); // TEST is not a CDR-slice source
    expect(gate(g, 'TRR').passed).toBe(false);
  });

  it('a bound TEST (real testRef) turns TRR green', () => {
    const g: G = { nodes: [node('TEST-t', 'TEST', { testRef: { file: 'tests/x.test.ts' } })], edges: [] };
    expect(gate(g, 'TRR').completeness.covered).toBe(gate(g, 'TRR').completeness.total);
    expect(gate(g, 'TRR').passed).toBe(true);
  });

  it('a leaf FUNC needs realRef; a decomposed parent FUNC is realized by its children', () => {
    const leafNoCode: G = { nodes: [node('FUNC-leaf', 'FUNC')], edges: [] };
    expect(gate(leafNoCode, 'TRR').passed).toBe(false);
    const parent: G = {
      nodes: [node('FUNC-p', 'FUNC'), node('FUNC-c', 'FUNC', { realRef: { file: 'src/x.ts' } })],
      edges: [edge('FUNC-p', 'FUNC-c', 'compose')],
    };
    // parent is non-leaf (holds), child is a leaf with realRef (holds) → complete.
    expect(gate(parent, 'TRR').passed).toBe(true);
  });
});

// --- Drift lock: every meta-model 1..* leg is assigned to a phase -------------

describe('CR-GC-250 drift lock — cardinality legs are covered', () => {
  it('every meta-model 1..* compose pattern has a matching completeness leg', () => {
    const legIds = new Set(Object.values(COMPLETENESS_SLICES).flat().map((l) => l.id));
    const mandatory = (SE_DESCRIPTOR.patterns ?? []).filter(
      (p) => (p as { cardinality?: string }).cardinality === '1..*',
    );
    expect(mandatory.length).toBeGreaterThan(0);
    for (const p of mandatory) {
      expect(legIds.has(`${p.source}→${p.target}`), `${p.source}→${p.target} (1..*) not assigned to a phase`).toBe(true);
    }
  });
});

// --- Single value per gate + on-click detail (REQ-completeness-single-value) --

describe('CR-GC-250 single value — one number per gate, detail on demand', () => {
  const g: G = { nodes: [node('SYS-x', 'SYS'), node('UC-x', 'UC')], edges: [] };

  it('each phase gate exposes exactly one completeness {covered,total}', () => {
    for (const gt of computeReadiness([], g).phaseGates) {
      expect(typeof gt.completeness.covered).toBe('number');
      expect(typeof gt.completeness.total).toBe('number');
    }
  });

  it('summary keeps the covered/total value but drops the per-leg missing detail', () => {
    const full = computeReadiness([], g);
    const summary = summarizeReadiness(full);
    const srrFull = full.phaseGates.find((x) => x.id === 'SRR')!;
    const srrSum = summary.phaseGates.find((x) => x.id === 'SRR')!;
    expect(srrSum.completeness.covered).toBe(srrFull.completeness.covered);
    expect(srrSum.completeness.total).toBe(srrFull.completeness.total);
    expect(srrFull.completeness.missing.length).toBeGreaterThan(0); // detail available in full
    expect(srrSum.completeness.missing).toEqual([]);                 // stripped in summary
  });

  it('scoreCompleteness is vacuously complete (1) when no source elements exist', () => {
    const empty = scoreCompleteness('SRR', { nodes: [], edges: [] });
    expect(empty).toEqual({ covered: 0, total: 0, missing: [] });
  });
});
