/**
 * Graph integrity — the parallel-work safety net (SSOT, read-only).
 *
 * Delegates to the CANONICAL validator (GraphCodeCodec.validate, CR-GC-103) —
 * which already covers node types, edge types, valid pairs, AND referential
 * integrity ("Edge references unknown source/target node" = the clobber guard).
 * NO validation logic is re-implemented here.
 *
 * Gap: validate() does not yet flag duplicate UIDs (the collision guard, e.g.
 * two chats both pick CR-GC-119). That check belongs IN the validator — see
 * CR-GC-200 — not duplicated in this test. Once added there, this test gains it
 * for free.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GraphCodeCodec } from '../src/codec.js';
import type { Graph } from '@sigloch/graph-api-core';

const GRAPH = join(__dirname, '..', 'docs/graph/graphcode.graph.json');

describe('graph integrity (SSOT safety net)', () => {
  const raw = readFileSync(GRAPH, 'utf8');
  const json = JSON.parse(raw) as {
    elements: Array<{ id: string; type: string; name: string; description?: string }>;
    traces: Array<{ source: string; target: string; type: string }>;
  };
  // Project the materialized OntologyGraph (elements/traces) to the graph-api-core
  // Graph (nodes/edges) the validator consumes. (Mirrors the harness import; a
  // shared json↔Graph projection helper is CR-GC-200 scope.)
  const graph: Graph = {
    nodes: json.elements.map((e) => ({ uid: e.id, type: e.type, name: e.name, description: e.description ?? '', attributes: {} })),
    edges: json.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: {} })),
  };

  it('passes the canonical validator (types, edge pairs, referential integrity)', () => {
    const { errors } = new GraphCodeCodec().validate(graph);
    if (errors.length) console.error('graph validation errors:\n  - ' + errors.join('\n  - '));
    expect(errors).toEqual([]);
  });

  it('is canonically serialized (deterministic writer, not a raw hand-edit)', () => {
    expect(JSON.stringify(json, null, 2) + '\n').toBe(raw);
  });

  it('no element carries a nested `attributes` key (CR-GC-219 flatten, no re-nesting)', () => {
    const nested = json.elements.filter(
      (e) => typeof (e as Record<string, unknown>).attributes === 'object' && (e as Record<string, unknown>).attributes !== null,
    );
    expect(nested.map((e) => e.id)).toEqual([]);
  });
});
