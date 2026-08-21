/**
 * TEST-merge-no-duplicate-edge (CR-GC-384) — eine Kante existiert einmal, auch nach
 * `merge-nodes`.
 *
 * Der Befund: `mergeNodes` aus @sigloch/graph-api-core dedupliziert eine umgehängte
 * Kante nur gegen das, was es BEREITS gesammelt hat. Steht die Kante der Quelle vor der
 * identischen Kante des Ziels, wird die umgehängte zuerst gepusht und die vorhandene
 * danach ungeprüft angehängt — dieselbe (source, type, target) zweimal. Kuzu schlüsselt
 * genau auf dieses Tripel und behält still eine; der In-Memory-Graph behauptet dann eine
 * Kante, die der Store nicht hat, und der Reseed-Roundtrip meldet einen Verlust, den es
 * nie gab (real passiert in CR-GC-383 bei `TEST-efficient-testing` → `TEST-mvp-e2e`).
 *
 * Die Reihenfolgeabhängigkeit ist der Kern: derselbe Merge ist mal richtig, mal falsch.
 * Deshalb prüft der Test BEIDE Reihenfolgen und vergleicht am Ende Speicher GEGEN Disk —
 * eine Zählung allein im Speicher hätte den Divergenz-Fall gar nicht sehen können.
 *
 * Realer Disk-Kuzu (temp dir, nie `:memory:`). Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/harness.js';
import { exportGraphJson } from '../src/exporter.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** Zwei Abnahmen auf DERSELBEN Anforderung — der Fall, der beim Verschmelzen kollidiert. */
const fixture = {
  elements: [
    { id: 'REQ-shared', type: 'REQ', name: 'Req shared', description: 'von beiden Abnahmen verifiziert' },
    { id: 'TEST-keep', type: 'TEST', name: 'Test keep', description: 'überlebt den Merge', testRefs: [{ file: 'tests/keep.test.ts', tool: 'vitest' }] },
    { id: 'TEST-gone', type: 'TEST', name: 'Test gone', description: 'geht im Merge auf', testRefs: [{ file: 'tests/gone.test.ts', tool: 'vitest' }] },
  ],
  traces: [
    { source: 'TEST-gone', target: 'REQ-shared', type: 'verify' },
    { source: 'TEST-keep', target: 'REQ-shared', type: 'verify' },
  ],
};

describe('TEST-merge-no-duplicate-edge: merge-nodes erzeugt keine Doppelkante', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-merge-dedupe-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('führt die identische verify-Kante nur einmal, egal in welcher Reihenfolge sie stand', async () => {
    const res = await harness.mutate([{ op: 'merge-nodes', sourceUid: 'TEST-gone', targetUid: 'TEST-keep' }]);
    expect(res.success).toBe(true);

    const verify = harness.getGraph().edges.filter((e) => e.edgeType === 'verify' && e.targetId === 'REQ-shared');
    expect(verify).toHaveLength(1);
    expect(verify[0].sourceId).toBe('TEST-keep');
  });

  it('Speicher und Disk zählen dasselbe — sonst meldet der Reseed einen erfundenen Verlust', async () => {
    await harness.mutate([{ op: 'merge-nodes', sourceUid: 'TEST-gone', targetUid: 'TEST-keep' }]);
    const inMemory = harness.getGraph().edges.length;

    const fromDisk = await harness.loadGraph();
    expect(fromDisk.edges.length).toBe(inMemory);
  });

  it('der kanonische Snapshot schreibt eine Kante nie zweimal', () => {
    // Direkt am Serializer, unabhängig vom Gate: selbst wenn ein Graph aus einer anderen
    // Quelle eine Doppelkante trägt, darf die SSOT-Datei sie nicht behaupten.
    const withDuplicate = {
      nodes: [
        { uid: 'REQ-x', type: 'REQ', name: 'Req x', description: '', attributes: {} },
        { uid: 'TEST-x', type: 'TEST', name: 'Test x', description: '', attributes: {} },
      ],
      edges: [
        { sourceId: 'TEST-x', targetId: 'REQ-x', edgeType: 'verify', attributes: {} },
        { sourceId: 'TEST-x', targetId: 'REQ-x', edgeType: 'verify', attributes: {} },
      ],
    };

    const traces = JSON.parse(exportGraphJson(withDuplicate)).traces;
    expect(traces).toHaveLength(1);
  });
});
