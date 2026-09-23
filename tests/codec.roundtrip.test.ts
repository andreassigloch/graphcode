/**
 * TEST-roundtrip — acceptance test fuer den Format-E-Rundlauf (CR-GC-103, CR-GC-631).
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
import { FORMAT_E_CODEC } from '../src/surface/format-e-commands.js';
import { knotenAus, kantenAus } from './helpers/format-e.js';
import { elementToNode } from '../src/kernel/element-node.js';

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
 * Graph shape used by the codec.
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
 * CR-GC-334: die Attributwerte werden NICHT mehr vorab stringifiziert. Vorher baute dieser
 * File seine Erwartung mit `String(v)` bzw. `JSON.stringify(kinds)` — damit war der
 * Round-Trip **per Konstruktion** string-stabil und konnte den einen Defekt, für den er da
 * ist, nicht sehen: `realRef` wurde zu `"[object Object]"`, und beide Seiten waren sich
 * einig. Die Fixture kommt jetzt aus `elementToNode` (src/exporter.ts) — derselben
 * Abbildung, die `harness.importGraph` benutzt, also kein Test-eigener Parallelpfad.
 */
function ontologyJsonToGraph(raw: OntologyJson): Graph {
  const nodes: GraphNode[] = raw.elements.map((el) => elementToNode(el as Record<string, unknown>));

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
 *   - Scalars as strings (CR-GC-334, s.u.)
 */
/**
 * CR-GC-334: der Inline-Block `[k:v]` ist untypisierter Text — `maxFiles:4` und
 * `concept:true` kommen als `"4"`/`"true"` zurück. Das ist eine bekannte Grenze des
 * Formats, KEIN Bindungsverlust: Zahlen und Booleans bleiben lesbar und bedeutungsgleich.
 * Deshalb werden Skalare beidseitig auf String normalisiert — **Objekte und Arrays nicht**,
 * die müssen exakt gleich zurückkommen (genau das war der Defekt).
 */
function scalarsAsStrings(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs)
      // Der Serializer schreibt null/'' nicht (`serializeAttrs`), also darf die Erwartung
      // sie auch nicht enthalten — sonst prüft der Test eine Zusage, die das Format nie gibt.
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => [k, typeof v === 'object' ? v : String(v)]),
  );
}

function normalize(g: Graph): Graph {
  const nodes = [...g.nodes]
    .sort((a, b) => a.uid.localeCompare(b.uid))
    .map((n) => ({
      uid: n.uid,
      type: n.type,
      name: n.name,
      ...(n.description !== undefined && n.description !== '' ? { description: n.description } : {}),
      attributes: Object.fromEntries(
        Object.entries(scalarsAsStrings(n.attributes))
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

describe('TEST-roundtrip: Format-E (SSOT fixture)', () => {
  let fixture: Graph;
  let encoded1: string;
  let encoded2: string;

  beforeAll(() => {
    const raw: OntologyJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'docs', 'graph', 'graphcode.graph.json'), 'utf8'),
    );
    fixture = ontologyJsonToGraph(raw);

    encoded1 = FORMAT_E_CODEC.serialize(fixture, { roundTrip: true });
    encoded2 = FORMAT_E_CODEC.serialize(fixture, { roundTrip: true });
  });

  it('(a) encode is deterministic: two calls are byte-identical', () => {
    expect(encoded1).toBe(encoded2);
  });

  it('(b) encode produces non-empty Format-E text', () => {
    expect(encoded1.length).toBeGreaterThan(0);
    expect(encoded1).toContain('## Nodes');
    expect(encoded1).toContain('## Edges');
  });

  /**
   * CR-GC-631 — der Rundlauf wird ueber die PARSER-OPERATIONEN geprueft, nicht ueber einen
   * zweiten Graphen. Bis hierher lautete die Zusicherung `decode(encode(g)) deep-equals g`;
   * sie brauchte eine Graph-Rekonstruktion, die nur diese Tests je gerufen haben. Die Aussage
   * bleibt dieselbe: was `serialize` schreibt, nennt der Parser vollstaendig zurueck.
   *
   * Der frueher separate Fall `encode(decode(encode(g))) === encode(g)` ist damit entfallen —
   * er sagte nichts, was (a) Determinismus und (c) Vollstaendigkeit nicht zusammen sagen.
   */
  it('(c) parse(serialize(g)) nennt dieselben Knoten wie g (Rundlauf L3)', () => {
    const gelesen = knotenAus(encoded1)
      .map((n) => ({
        uid: n.uid,
        type: n.type,
        name: n.name,
        ...(n.description !== undefined && n.description !== '' ? { description: n.description } : {}),
        attributes: Object.fromEntries(
          Object.entries(scalarsAsStrings(n.attributes)).sort(([a], [b]) => a.localeCompare(b)),
        ),
        ...(n.roh['__createdAt'] !== undefined ? { createdAt: n.roh['__createdAt'] } : {}),
        ...(n.roh['__updatedAt'] !== undefined ? { updatedAt: n.roh['__updatedAt'] } : {}),
      }))
      .sort((a, b) => a.uid.localeCompare(b.uid));

    expect(gelesen).toEqual(normalize(fixture).nodes);
  });

  it('(c2) parse(serialize(g)) nennt dieselben Kanten wie g', () => {
    const gelesen = kantenAus(encoded1)
      .map((e) => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        edgeType: e.edgeType,
        attributes: Object.fromEntries(Object.entries(e.attributes).sort(([a], [b]) => a.localeCompare(b))),
      }))
      .sort(
        (a, b) =>
          a.sourceId.localeCompare(b.sourceId) ||
          a.targetId.localeCompare(b.targetId) ||
          a.edgeType.localeCompare(b.edgeType),
      );

    expect(gelesen).toEqual(normalize(fixture).edges);
  });

  it('(e) node count preserved', () => {
    expect(knotenAus(encoded1).length).toBe(fixture.nodes.length);
  });

  it('(f) edge count preserved', () => {
    expect(kantenAus(encoded1).length).toBe(fixture.edges.length);
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
    const enc = FORMAT_E_CODEC.serialize(g, { roundTrip: true });
    expect(enc).not.toContain('[object Object]');
    expect(enc).toContain('"file":"src/x.ts"');
    // Und die Bindung kommt als OBJEKT zurueck, nicht als Text — genau der Defekt von CR-GC-244.
    expect(knotenAus(enc)[0].attributes.realRef).toEqual({ file: 'src/x.ts', symbol: 'x', lang: 'ts' });
  });
});
