/**
 * TEST-export-graph-guard (CR-GC-313) — the canonicity guard behind
 * `scripts/export-graph.mjs`.
 *
 * The guard had no test. That is why CR-GC-300 could break it without anything going
 * red: adding a `graphVersion` trailer at write time made the byte comparison fail on
 * every snapshot written since, so the script aborted with a message that reads like a
 * corrupt SSOT — on a perfectly healthy one. It was still the path every GENERATED
 * view header points at.
 *
 * The interesting assertion is NOT that a stamped snapshot passes. It is that the
 * guard was made stamp-blind WITHOUT being weakened: a real hand-edit — a changed
 * description, a reordered element, an added field — must still be refused. A guard
 * "repaired" by softening is worse than a broken one, because it stays green.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCanonicalSnapshot, exportGraphJson, elementToNode } from '../src/exporter.js';
import type { Graph } from '@sigloch/graph-api-core';

/** elements/traces → Graph via the SHARED import mapping — same as the script. */
function toGraph(ontology: {
  elements?: Array<Record<string, unknown>>;
  traces?: Array<Record<string, unknown>>;
}): Graph {
  const nodes = (ontology.elements ?? []).map((e) => elementToNode(e as never));
  const edges = (ontology.traces ?? []).map((t) => {
    const { source, target, type, ...rest } = t as Record<string, unknown>;
    return {
      sourceId: source as string,
      targetId: target as string,
      edgeType: type as string,
      attributes: rest,
    };
  });
  return { nodes, edges };
}

/** A minimal but canonical snapshot: exactly what exportGraphJson would emit. */
function canonical(): { raw: string; graph: Graph } {
  const graph = toGraph({
    elements: [
      { id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' },
      { id: 'REQ-a', type: 'REQ', name: 'a', description: 'Das System muss a tun.' },
    ],
    traces: [{ source: 'SYS-x', target: 'REQ-a', type: 'compose' }],
  });
  return { raw: exportGraphJson(graph), graph };
}

/** What graph_export actually writes: the canonical bytes plus the version trailer. */
function stamped(raw: string, version: number): string {
  return JSON.stringify({ ...JSON.parse(raw), graphVersion: version }, null, 2) + '\n';
}

describe('TEST-export-graph-guard: canonicity is checked stamp-blind (CR-GC-313)', () => {
  it('accepts an unstamped canonical snapshot', () => {
    const { raw, graph } = canonical();
    expect(isCanonicalSnapshot(raw, graph)).toBe(true);
  });

  it('accepts the same snapshot carrying a graphVersion stamp', () => {
    // The regression CR-GC-300 introduced: this returned false for every snapshot
    // written through graph_export, and the script aborted on all of them.
    const { raw, graph } = canonical();
    expect(isCanonicalSnapshot(stamped(raw, 42), graph)).toBe(true);
  });

  it('accepts any stamp value — the number is metadata, not model', () => {
    const { raw, graph } = canonical();
    for (const v of [0, 1, 999999]) {
      expect(isCanonicalSnapshot(stamped(raw, v), graph)).toBe(true);
    }
  });

  // -- the point of this file: the guard must still bite ---------------------

  it('REFUSES a hand-edited description', () => {
    const { raw, graph } = canonical();
    const edited = JSON.parse(raw) as { elements: Array<{ description: string }> };
    edited.elements[1].description = 'Von Hand geaendert.';
    expect(isCanonicalSnapshot(JSON.stringify(edited, null, 2) + '\n', graph)).toBe(false);
  });

  it('REFUSES reordered elements', () => {
    const { raw, graph } = canonical();
    const edited = JSON.parse(raw) as { elements: unknown[] };
    edited.elements.reverse();
    expect(isCanonicalSnapshot(JSON.stringify(edited, null, 2) + '\n', graph)).toBe(false);
  });

  it('REFUSES a stray added field', () => {
    const { raw, graph } = canonical();
    const edited = JSON.parse(raw) as { elements: Array<Record<string, unknown>> };
    edited.elements[0].notiz = 'nicht kanonisch';
    expect(isCanonicalSnapshot(JSON.stringify(edited, null, 2) + '\n', graph)).toBe(false);
  });

  it('REFUSES a dropped trace, stamp or no stamp', () => {
    const { raw, graph } = canonical();
    const edited = JSON.parse(raw) as { traces: unknown[] };
    edited.traces = [];
    const bare = JSON.stringify(edited, null, 2) + '\n';
    expect(isCanonicalSnapshot(bare, graph)).toBe(false);
    expect(isCanonicalSnapshot(stamped(bare, 7), graph)).toBe(false);
  });

  it('REFUSES unparseable JSON rather than throwing', () => {
    const { graph } = canonical();
    expect(isCanonicalSnapshot('{ kein JSON', graph)).toBe(false);
  });

  it('passes on THIS repo’s committed SSOT — the script is usable again', () => {
    // The end-to-end claim of the CR: `node scripts/export-graph.mjs` runs here.
    const path = join(process.cwd(), 'docs/graph/graphcode.graph.json');
    const raw = readFileSync(path, 'utf8');
    expect(isCanonicalSnapshot(raw, toGraph(JSON.parse(raw)))).toBe(true);
  });
});
