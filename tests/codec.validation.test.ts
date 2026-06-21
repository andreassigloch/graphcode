/**
 * TEST-codec-validation — validate() and implicit-add rejection (CR-GC-103).
 *
 * Assertions:
 *   (a) validate() returns valid:false with errors for an unknown node type.
 *   (b) validate() returns valid:false with errors for an invalid edge pair.
 *   (c) validate() returns valid:true for a well-formed graph.
 *   (d) encode() throws on a graph with an invalid node type.
 *   (e) decode() throws on Format-E text with an edge referencing an undeclared node
 *       (implicit-add must fail loudly, not silently add).
 *   (f) decode() throws when FormatECodec.parse() returns errors.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeCodec } from '../src/codec.js';

const codec = new GraphCodeCodec();

// ---------------------------------------------------------------------------
// Minimal valid graph: SYS node only
// ---------------------------------------------------------------------------
const validSysNode = {
  uid: 'SYS-test',
  type: 'SYS',
  name: 'Test System',
  description: 'Test',
  attributes: {},
};

const validReqNode = {
  uid: 'REQ-001',
  type: 'REQ',
  name: 'Test REQ',
  description: 'A requirement',
  attributes: {},
};

const validGraph: Graph = {
  nodes: [validSysNode, validReqNode],
  edges: [
    {
      sourceId: 'SYS-test',
      targetId: 'REQ-001',
      edgeType: 'satisfy', // SYS -satisfy-> REQ is a valid pair
      attributes: {},
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TEST-codec-validation: validate()', () => {
  it('(a) invalid node type → valid:false with error', () => {
    const g: Graph = {
      nodes: [{ uid: 'FOO-bar', type: 'FOO', name: 'Bad', attributes: {} }],
      edges: [],
    };
    const result = codec.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('FOO');
  });

  it('(b) invalid edge pair → valid:false with error', () => {
    // REQ -compose-> SYS is not a valid pair for "compose"
    const g: Graph = {
      nodes: [validReqNode, validSysNode],
      edges: [
        {
          sourceId: 'REQ-001',
          targetId: 'SYS-test',
          edgeType: 'compose', // compose only valid between SYS/MOD/UC pairs
          attributes: {},
        },
      ],
    };
    const result = codec.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('compose'))).toBe(true);
  });

  it('(c) valid graph → valid:true, no errors', () => {
    const result = codec.validate(validGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('(c2) duplicate node uid → valid:false (CR-GC-200 — the nodeTypeMap silently dedupes)', () => {
    const g: Graph = {
      nodes: [validReqNode, { ...validReqNode, name: 'Collision REQ' }], // two nodes share REQ-001
      edges: [],
    };
    const result = codec.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate node uid') && e.includes('REQ-001'))).toBe(true);
  });
});

describe('TEST-codec-validation: encode() rejects invalid graphs', () => {
  it('(d) encode() throws on unknown node type', () => {
    const g: Graph = {
      nodes: [{ uid: 'BOGUS-node', type: 'BOGUS', name: 'Bogus', attributes: {} }],
      edges: [],
    };
    expect(() => codec.encode(g)).toThrow(/validation failed/);
    expect(() => codec.encode(g)).toThrow(/BOGUS/);
  });
});

describe('TEST-codec-validation: decode() rejects implicit-add', () => {
  it('(e) decode() throws when edge references undeclared node (implicit-add)', () => {
    // Format-E text with an edge referencing a target node NOT listed in ## Nodes.
    // CR -relation-> MOD is a valid SE pair so FormatECodec.parse() accepts the
    // edge line — the implicit-add guard is then hit inside our decode().
    const text = `## Nodes
+ CR-GC-103.CR|Codec CR [__name:Codec CR]

## Edges
+ CR-GC-103.CR -relation-> MOD-missing.MOD`;

    expect(() => codec.decode(text)).toThrow(/implicit-add rejected/);
    expect(() => codec.decode(text)).toThrow(/MOD-missing\.MOD/);
  });

  it('(f) decode() throws when FormatECodec.parse() returns errors', () => {
    // Gibberish that produces parse errors
    const text = `## Nodes
+ UnknownType-node.XXXXX|bad type`;

    expect(() => codec.decode(text)).toThrow();
  });
});
