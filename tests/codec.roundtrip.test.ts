/**
 * TEST-roundtrip — acceptance test for GraphCodeCodec (CR-GC-103).
 *
 * Fixture: SSOT graph docs/graph/graphcode.graph.json (full SSOT graph).
 * This is a stronger fixture than rasentraktor because it exercises the full
 * SE ontology in production shape (all 12 node types, complex attribute values,
 * descriptions with special chars).
 *
 * Assertions:
 *   (a) encode(g) is deterministic: two calls produce byte-identical strings.
 *   (b) decode(encode(g)) deep-equals g (round-trip conformance, L3).
 *   (c) encode(decode(encode(g))) equals encode(g) (idempotent after round-trip).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { GraphCodeCodec } from '../src/codec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load SSOT fixture
// ---------------------------------------------------------------------------

interface OntologyJson {
  elements: Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    status?: string;
    created_at?: string;
    attributes?: Record<string, unknown>;
    kinds?: unknown[];
    method?: unknown;
    [k: string]: unknown;
  }>;
  traces: Array<{
    source: string;
    target: string;
    type: string;
    weight?: number;
    created_at?: string;
    [k: string]: unknown;
  }>;
}

/**
 * Convert the materialized OntologyJson (docs/graph/*.graph.json) to the
 * Graph shape used by GraphCodeCodec.
 *
 * Mapping:
 *   node.uid         = element.id
 *   node.type        = element.type
 *   node.name        = element.name
 *   node.description = element.description
 *   node.createdAt   = element.created_at
 *   node.attributes  = { status, kinds, method, ...element.attributes }
 *   edge.sourceId    = trace.source
 *   edge.targetId    = trace.target
 *   edge.edgeType    = trace.type
 *   edge.attributes  = { weight, created_at }
 *
 * Attribute values are stringified so round-trip comparison is String-stable.
 */
function ontologyJsonToGraph(raw: OntologyJson): Graph {
  const nodes: GraphNode[] = raw.elements.map((el) => {
    const attributes: Record<string, string> = {};
    if (el.status !== undefined) attributes['status'] = String(el.status);
    if (el.kinds !== undefined) attributes['kinds'] = JSON.stringify(el.kinds);
    if (el.method !== undefined) attributes['method'] = String(el.method);
    if (el.attributes) {
      for (const [k, v] of Object.entries(el.attributes)) {
        attributes[k] = String(v);
      }
    }
    return {
      uid: el.id,
      type: el.type,
      name: el.name,
      description: el.description,
      attributes,
      ...(el.created_at !== undefined ? { createdAt: el.created_at } : {}),
    };
  });

  const edges: GraphEdge[] = raw.traces.map((tr) => {
    const attributes: Record<string, string> = {};
    if (tr.weight !== undefined) attributes['weight'] = String(tr.weight);
    if (tr.created_at !== undefined) attributes['created_at'] = String(tr.created_at);
    return {
      sourceId: tr.source,
      targetId: tr.target,
      edgeType: tr.type,
      attributes,
    };
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Normalize helper for deep-equal comparison
// ---------------------------------------------------------------------------

/**
 * Normalize a Graph for structural comparison:
 *   - Sort nodes by uid
 *   - Sort edges by [sourceId, targetId, edgeType]
 *   - Sort attribute keys within each node/edge
 *   - Collapse undefined/empty description to undefined
 */
function normalize(g: Graph): Graph {
  const nodes = [...g.nodes]
    .sort((a, b) => a.uid.localeCompare(b.uid))
    .map((n) => ({
      uid: n.uid,
      type: n.type,
      name: n.name,
      ...(n.description !== undefined && n.description !== '' ? { description: n.description } : {}),
      attributes: Object.fromEntries(
        Object.entries(n.attributes)
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
      ...(n.createdAt !== undefined ? { createdAt: n.createdAt } : {}),
      ...(n.updatedAt !== undefined ? { updatedAt: n.updatedAt } : {}),
    }));

  const edges = [...g.edges]
    .sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) ||
        a.targetId.localeCompare(b.targetId) ||
        a.edgeType.localeCompare(b.edgeType),
    )
    .map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      edgeType: e.edgeType,
      attributes: Object.fromEntries(
        Object.entries(e.attributes).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }));

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TEST-roundtrip: GraphCodeCodec (SSOT fixture)', () => {
  let codec: GraphCodeCodec;
  let fixture: Graph;
  let encoded1: string;
  let encoded2: string;

  beforeAll(() => {
    codec = new GraphCodeCodec();

    const raw: OntologyJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'docs', 'graph', 'graphcode.graph.json'), 'utf8'),
    );
    fixture = ontologyJsonToGraph(raw);

    encoded1 = codec.encode(fixture);
    encoded2 = codec.encode(fixture);
  });

  it('(a) encode is deterministic: two calls are byte-identical', () => {
    expect(encoded1).toBe(encoded2);
  });

  it('(b) encode produces non-empty Format-E text', () => {
    expect(encoded1.length).toBeGreaterThan(0);
    expect(encoded1).toContain('## Nodes');
    expect(encoded1).toContain('## Edges');
  });

  it('(c) decode(encode(g)) deep-equals g (round-trip L3)', () => {
    const decoded = codec.decode(encoded1);
    expect(normalize(decoded)).toEqual(normalize(fixture));
  });

  it('(d) encode(decode(encode(g))) === encode(g) (idempotent)', () => {
    const decoded = codec.decode(encoded1);
    const reEncoded = codec.encode(decoded);
    expect(reEncoded).toBe(encoded1);
  });

  it('(e) node count preserved', () => {
    const decoded = codec.decode(encoded1);
    expect(decoded.nodes.length).toBe(fixture.nodes.length);
  });

  it('(f) edge count preserved', () => {
    const decoded = codec.decode(encoded1);
    expect(decoded.edges.length).toBe(fixture.edges.length);
  });

  // CR-GC-244 — object-valued attributes (realRef/testRef) must stay legible in
  // Format-E slices. The old String(v) collapsed them to "[object Object]",
  // silently dropping the binding an agent needs to read out of a graph_context /
  // graph_impact slice.
  it('(g) object attributes encode as legible JSON, never "[object Object]"', () => {
    const g: Graph = {
      nodes: [
        {
          uid: 'FUNC-x',
          type: 'FUNC',
          name: 'x()',
          description: 'demo',
          attributes: {
            status: 'done',
            realRef: { file: 'src/x.ts', symbol: 'x', lang: 'ts' },
          },
        },
      ],
      edges: [],
    };
    const enc = codec.encode(g);
    expect(enc).not.toContain('[object Object]');
    expect(enc).toContain('"file":"src/x.ts"');
    // idempotent after a Format-E round-trip (string-typed, no re-parse)
    expect(codec.encode(codec.decode(enc))).toBe(enc);
  });
});
