/**
 * TEST-steering-snapshot (CR-GC-303, absorbiert CR-GC-299).
 *
 * Der Steering-/Generate-Pfad baute seinen OntologyGraph über den Umweg
 * `JSON.parse(exportGraphJson(graph))`. `exportGraphJson` flacht `node.attributes`
 * per SSOT-Konvention (CR-216/228) auf Top-Level ab — Contracts-Regeln lesen aber
 * `element.attributes?.x` (rules.ts). Folge: R-19 (testRef), R-20 (realRef/codeRef),
 * VR-01 (testResult) und AF-01..05 (SYS.analysisFreshness) feuerten in diesem Pfad
 * UNBEDINGT, egal was im Graphen stand — `graph_generate` konnte PDR/CDR/TRR nie
 * regel-vollständig erreichen.
 *
 * Diese Tests sind die Reproduktion: sie waren gegen den Export-Roundtrip rot
 * (alle 8 Regeln feuerten auf einem vollständig gebundenen Graphen) und sind grün,
 * seit `takeSteeringSnapshot` denselben Mapper wie der Harness-Pfad benutzt
 * (`toOntologyGraph` aus conformance.ts). Der Export-Encoding selbst bleibt
 * unangetastet — das prüft der Byte-Identitäts-Test unten.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import type { Graph, GraphNode, GraphEdge } from '@sigloch/graph-api-core';
import { takeSteeringSnapshot } from '../src/steering-snapshot.js';
import { exportGraphJson } from '../src/exporter.js';

function node(
  uid: string,
  type: string,
  name: string,
  description = '',
  attributes: Record<string, unknown> = {},
): GraphNode {
  return { uid, type, name, description, attributes };
}
function edge(sourceId: string, edgeType: string, targetId: string): GraphEdge {
  return { sourceId, targetId, edgeType, attributes: {} };
}

/**
 * A graph whose bindings are ALL present: testRef (R-19), realRef+codeRef (R-20),
 * testResult (VR-01), FLOW→SCHEMA (SC-04) and the five analysisFreshness stamps
 * (AF-01..05). Every one of those rules must stay SILENT — each fired unconditionally
 * before the fix, because the flattened export hid the very attributes they read.
 */
function fullyBoundGraph(): Graph {
  return {
    nodes: [
      node('SYS-shop', 'SYS', 'Shop', 'Ein Shop, der Ersatzteile verkauft.', {
        analysisFreshness: {
          conops: { graphVersion: 1 },
          trade: { graphVersion: 1 },
          'assumption-review': { graphVersion: 1 },
          fmea: { graphVersion: 1 },
          implplan: { graphVersion: 1 },
        },
      }),
      node('REQ-bestellung', 'REQ', 'Bestellung persistieren', 'Das System soll die Bestellung speichern.', {
        kinds: ['functional'],
      }),
      node('TEST-bestellung', 'TEST', 'Bestell-Test', 'Prüft die Persistenz.', {
        testRef: { file: 'tests/bestellung.test.ts', case: 'persistiert', tool: 'vitest', level: 'unit' },
        testResult: 'passed',
      }),
      node('FUNC-persist', 'FUNC', 'persist()', 'Schreibt die Bestellung.', {
        realRef: { file: 'src/bestellung.ts', symbol: 'persist' },
        codeRef: { file: 'src/bestellung.ts', symbol: 'persist' },
      }),
      node('FLOW-bestellung', 'FLOW', 'Bestelldaten', 'Die Bestellnutzlast.'),
      node('SCHEMA-bestellung', 'SCHEMA', 'BestellungSchema', 'Zod-Vertrag der Bestellung.', {
        zodDefinition: 'z.object({ id: z.string() })',
      }),
    ],
    edges: [
      edge('SYS-shop', 'compose', 'REQ-bestellung'),
      edge('TEST-bestellung', 'verify', 'REQ-bestellung'),
      edge('FUNC-persist', 'satisfy', 'REQ-bestellung'),
      edge('FUNC-persist', 'io', 'FLOW-bestellung'),
      edge('FLOW-bestellung', 'relation', 'SCHEMA-bestellung'),
    ],
  };
}

/** Rule IDs that read `element.attributes?.x` and were blind under the export roundtrip. */
const ATTRIBUTE_READING_RULES = ['R-19', 'R-20', 'VR-01', 'SC-04', 'AF-01', 'AF-02', 'AF-03', 'AF-04', 'AF-05'];

describe('takeSteeringSnapshot — attributes reach the rules (CR-GC-303)', () => {
  it('exposes attributes NESTED, not flattened onto the element', () => {
    const snap = takeSteeringSnapshot(fullyBoundGraph(), DEFAULT_METRIC_POLICY);
    const test = snap.og.elements.find((e) => e.id === 'TEST-bestellung');
    // The exact shape the contracts rules read. Before the fix this was `undefined`
    // and `testRef` sat on the element itself.
    expect(test?.attributes).toBeDefined();
    expect((test?.attributes as Record<string, unknown>)?.['testRef']).toEqual({
      file: 'tests/bestellung.test.ts',
      case: 'persistiert',
      tool: 'vitest',
      level: 'unit',
    });
    expect((test as unknown as Record<string, unknown>)['testRef']).toBeUndefined();
  });

  it('R-19 (testRef) stays silent on a bound TEST', () => {
    const snap = takeSteeringSnapshot(fullyBoundGraph(), DEFAULT_METRIC_POLICY);
    expect(snap.violations.filter((v) => v.rule_id === 'R-19')).toEqual([]);
  });

  it('R-20 (realRef/codeRef) stays silent on a bound FUNC — the second binding rule, from CR-GC-299', () => {
    const snap = takeSteeringSnapshot(fullyBoundGraph(), DEFAULT_METRIC_POLICY);
    expect(snap.violations.filter((v) => v.rule_id === 'R-20')).toEqual([]);
  });

  it('AF-01..05 stay silent when SYS carries all five freshness stamps', () => {
    const snap = takeSteeringSnapshot(fullyBoundGraph(), DEFAULT_METRIC_POLICY);
    const af = snap.violations.filter((v) => v.rule_id.startsWith('AF-')).map((v) => v.rule_id);
    expect(af).toEqual([]);
  });

  it('none of the attribute-reading rules fires on a fully bound graph', () => {
    const snap = takeSteeringSnapshot(fullyBoundGraph(), DEFAULT_METRIC_POLICY);
    const fired = [...new Set(snap.violations.map((v) => v.rule_id))]
      .filter((r) => ATTRIBUTE_READING_RULES.includes(r))
      .sort();
    expect(fired).toEqual([]);
  });

  it('still REPORTS a genuinely missing binding — the fix must not blind the rules the other way', () => {
    const graph = fullyBoundGraph();
    // Strip the binding: now R-19 SHOULD fire. A snapshot that reports nothing here
    // would be the mirror-image bug (silent instead of screaming).
    graph.nodes.find((n) => n.uid === 'TEST-bestellung')!.attributes = { testResult: 'passed' };
    const snap = takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY);
    expect(snap.violations.filter((v) => v.rule_id === 'R-19').length).toBeGreaterThan(0);
  });

  it('leaves the export encoding byte-identical — the SSOT convention is untouched', () => {
    const graph = fullyBoundGraph();
    const before = exportGraphJson(graph);
    takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY);
    expect(exportGraphJson(graph)).toBe(before);
    // The flattening itself is still the committed convention, not collateral damage.
    const parsed = JSON.parse(before) as { elements: Record<string, unknown>[] };
    const test = parsed.elements.find((e) => e['id'] === 'TEST-bestellung')!;
    expect(test['testRef']).toBeDefined();
    expect(test['attributes']).toBeUndefined();
  });

  it('does not mutate the source graph (the mapper shares attribute references)', () => {
    const graph = fullyBoundGraph();
    const snapshotBefore = JSON.stringify(graph);
    takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY);
    expect(JSON.stringify(graph)).toBe(snapshotBefore);
  });
});
