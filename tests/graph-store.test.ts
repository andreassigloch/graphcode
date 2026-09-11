/**
 * TEST-graph-store (CR-GC-503): der Graph-Zustand hat EINEN Besitzer.
 *
 * Drei Zusagen, die ersten beiden an einem echten Kuzu-Store auf Platte:
 *  1. Ein vom Gate geblockter Batch veraendert weder Arbeitskopie noch Store — es gibt
 *     nichts zurueckzurollen, weil der Kandidat nie uebernommen wurde.
 *  2. Ein Probelauf (dryRun) haelt den Kandidaten nur im Speicher; der Store bleibt beim
 *     gespeicherten Stand, bis loadGraph() die Arbeitskopie zuruecksetzt.
 *  3. Geschrieben wird der Store nur in src/kernel/graph-store.ts — geprueft am Quelltext,
 *     damit ein zweiter Schreiber nicht still zurueckkehrt. Vor CR-GC-503 schrieben
 *     harness.ts und harness-import.ts.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const FIXTURE = {
  elements: [
    { id: 'FUNC-a', type: 'FUNC', name: 'a', description: '' },
    { id: 'FUNC-b', type: 'FUNC', name: 'b', description: '' },
  ],
  traces: [{ source: 'FUNC-a', target: 'FUNC-b', type: 'compose' }],
};

const nodeIds = (g: Graph): string[] => g.nodes.map((n) => n.uid).sort();
const edgeKeys = (g: Graph): string[] => g.edges.map((e) => `${e.sourceId}|${e.edgeType}|${e.targetId}`).sort();

describe('CR-GC-503: GraphStore ist der einzige Schreiber des Graph-Zustands', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-graph-store-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ein geblockter Batch laesst Arbeitskopie und Store unberuehrt', async () => {
    const nodesBefore = nodeIds(harness.getGraph());
    const edgesBefore = edgeKeys(harness.getGraph());
    // Ein gueltiger Knoten und eine Kante ins Leere im SELBEN Batch: der Batch blockt,
    // also darf auch der gueltige Knoten nirgends ankommen.
    const result = await harness.mutate([
      { op: 'add-node', node: { uid: 'FUNC-c', type: 'FUNC', name: 'c', description: '' } },
      { op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'FUNC-gibt-es-nicht', edgeType: 'compose' } },
    ]);
    expect(result.success).toBe(false);
    expect(nodeIds(harness.getGraph())).toEqual(nodesBefore);
    expect(edgeKeys(harness.getGraph())).toEqual(edgesBefore);
    const onDisk = await harness.getStore().loadGraph(makeConfig(tmp).scope);
    expect(nodeIds(onDisk)).toEqual(nodesBefore);
    expect(edgeKeys(onDisk)).toEqual(edgesBefore);
  });

  it('ein Probelauf haelt den Kandidaten nur im Speicher, bis loadGraph ihn verwirft', async () => {
    const result = await harness.mutate(
      [
        { op: 'add-node', node: { uid: 'FUNC-c', type: 'FUNC', name: 'c', description: '' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'FUNC-c', edgeType: 'compose' } },
      ],
      { dryRun: true },
    );
    expect(result.success).toBe(true);
    expect(nodeIds(harness.getGraph())).toContain('FUNC-c');
    const onDisk = await harness.getStore().loadGraph(makeConfig(tmp).scope);
    expect(nodeIds(onDisk)).not.toContain('FUNC-c');
    await harness.loadGraph();
    expect(nodeIds(harness.getGraph())).not.toContain('FUNC-c');
  });

  it('nur src/kernel/graph-store.ts schreibt den Store', () => {
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
      });
    const WRITE = /storage\.(saveNodes|saveEdges|deleteNodes|deleteEdges|shutdown)\(|(?<!function )resetKuzuStore\(/;
    const writers = walk(src)
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some((line) => !/^\s*(\*|\/\/)/.test(line) && WRITE.test(line)),
      )
      .map((file) => relative(src, file))
      .sort();
    expect(writers).toEqual(['kernel/graph-store.ts']);
  });
});
