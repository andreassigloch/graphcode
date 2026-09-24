/**
 * TEST-codec-validation — validate() and implicit-add rejection (CR-GC-103).
 *
 * Assertions:
 *   (a) validate() returns valid:false with errors for an unknown node type.
 *   (b) validate() returns valid:false with errors for an invalid edge pair.
 *   (c) validate() returns valid:true for a well-formed graph.
 *   (d) serialize() throws on a graph with an invalid node type.
 *   (e) das Lesen wirft auf Format-E-Text mit einer Kante auf einen nicht deklarierten Knoten
 *       (implicit-add must fail loudly, not silently add).
 *   (f) das Lesen wirft, wenn der Parser Fehler meldet.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import type { Graph } from '@sigloch/graph-api-core';
import { SE_FORMAT_E_CODEC } from '@sigloch/graph-api-core';
import { knotenAus } from './helpers/format-e.js';


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
    const result = SE_FORMAT_E_CODEC.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('FOO');
  });

  it('(b) pattern-illegal edge pair → valid:true, encode does not throw (CR-GC-531: legality is R-18 only)', () => {
    // REQ -compose-> SYS matches no TRACE_PATTERN. Judging that is R-18's job (gate + seed use the
    // same contracts routine); the codec only serializes what the store holds.
    const g: Graph = {
      nodes: [validReqNode, validSysNode],
      edges: [
        {
          sourceId: 'REQ-001',
          targetId: 'SYS-test',
          edgeType: 'compose',
          attributes: {},
        },
      ],
    };
    const result = SE_FORMAT_E_CODEC.validate(g);
    expect(result).toEqual({ valid: true, errors: [] });
    expect(SE_FORMAT_E_CODEC.serialize(g, { roundTrip: true })).toContain('REQ-001 -compose-> SYS-test');
  });

  it('(c) valid graph → valid:true, no errors', () => {
    const result = SE_FORMAT_E_CODEC.validate(validGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('(c2) duplicate node uid → valid:false (CR-GC-200 — the nodeTypeMap silently dedupes)', () => {
    const g: Graph = {
      nodes: [validReqNode, { ...validReqNode, name: 'Collision REQ' }], // two nodes share REQ-001
      edges: [],
    };
    const result = SE_FORMAT_E_CODEC.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate node uid') && e.includes('REQ-001'))).toBe(true);
  });
});

describe('TEST-codec-validation: serialize() rejects invalid graphs', () => {
  it('(d) serialize() throws on unknown node type', () => {
    const g: Graph = {
      nodes: [{ uid: 'BOGUS-node', type: 'BOGUS', name: 'Bogus', attributes: {} }],
      edges: [],
    };
    expect(() => SE_FORMAT_E_CODEC.serialize(g, { roundTrip: true })).toThrow(/validation failed/);
    expect(() => SE_FORMAT_E_CODEC.serialize(g, { roundTrip: true })).toThrow(/BOGUS/);
  });

  // CR-GC-536 / ITEM-2026-183 — der Phantom-Knoten, diesmal an DIESER Oberfläche.
  // Die Härtung sitzt seit CR-SM-332 im einen Codec; dieser Fall belegt, dass die
  // Delegation sie hierher durchreicht und graphcode nicht weiter still kaputten
  // Text erzeugt. Vor CR-GC-536 schrieb der eigene encode den Umbruch roh hinaus.
  it('(d2) serialize() wirft bei einer Beschreibung mit Zeilenumbruch — kein Phantom-Knoten mehr', () => {
    const g: Graph = {
      nodes: [{ uid: 'SYS-multi', type: 'SYS', name: 'Multi', description: 'erste Zeile\nzweite Zeile', attributes: {} }],
      edges: [],
    };
    expect(() => SE_FORMAT_E_CODEC.serialize(g, { roundTrip: true })).toThrow(/Zeilenumbruch/);
    expect(() => SE_FORMAT_E_CODEC.serialize(g, { roundTrip: true })).toThrow(/SYS-multi/);
  });
});

describe('TEST-codec-validation: das Lesen weist implicit-add ab', () => {
  it('(e) das Lesen wirft, wenn eine Kante einen nicht deklarierten Knoten nennt (implicit-add)', () => {
    // Format-E text with an edge referencing a target node NOT listed in ## Nodes.
    // Since Format-E v2 (CR-GC-269) the guard fires one layer earlier: an
    // undeclared node has no `### <TYPE>` section, so the parser cannot type the
    // endpoint and rejects the edge. Same guarantee — an implicit add never
    // silently becomes a node — the message just names the cause more precisely.
    const text = `## Nodes
### CR
+ CR-GC-103|Codec CR [__name:Codec CR]

## Edges
+ CR-GC-103 -relation-> MOD-missing`;

    expect(() => knotenAus(text)).toThrow(/Cannot resolve type of target "MOD-missing"/);
    expect(() => knotenAus(text)).toThrow(/MOD-missing/);
  });

  // CR-GC-536 / ITEM-2026-183 — die Leseseite desselben Defekts: die übergelaufene
  // Zeile wurde bis CR-SM-332 als EIGENER Knoten gedeutet (uid = der Resttext, Typ =
  // die offene `### <TYPE>`-Sektion), und das inline-Attribut haftete am Phantom statt
  // am gemeinten Knoten. Jetzt ist es ein Fehler, und das Lesen wirft ihn weiter.
  it('(e2) das Lesen wirft bei einer übergelaufenen Zeile statt einen zweiten Knoten zu bauen', () => {
    const text = `## Nodes
### SYS
+ SYS-x|erste Zeile
zweite Zeile die ueberlaeuft [__name:X]`;

    expect(() => knotenAus(text)).toThrow(/without an operator prefix/);
    expect(() => knotenAus(text)).toThrow(/zweite Zeile die ueberlaeuft/);
  });

  it('(f) das Lesen wirft, wenn FormatECodec.parse() Fehler meldet', () => {
    // Gibberish that produces parse errors
    const text = `## Nodes
+ UnknownType-node.XXXXX|bad type`;

    expect(() => knotenAus(text)).toThrow();
  });
});
