/**
 * Bootstrap import — REQ-graph-is-ssot / REQ-import-se-ontology.
 *
 * Loads the materialized OntologyGraph (docs/graph/graphcode.graph.json) into a
 * disk Kuzu store and asserts the full element/trace set round-trips. Proves the
 * DB can be the runtime SSOT.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO_ROOT = join(__dirname, '..');
const GRAPH_JSON = join(REPO_ROOT, 'docs/graph/graphcode.graph.json');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('bootstrap import of the materialized graph', () => {
  let tmp: string;
  let kuzuPath: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-import-'));
    kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    // repoRoot points at the real repo so seedFromJson finds docs/graph/*;
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('loads the full SSOT graph into disk Kuzu and round-trips', async () => {
    const json = JSON.parse(readFileSync(GRAPH_JSON, 'utf8')) as { elements: unknown[]; traces: unknown[] };
    const expectedNodes = json.elements.length;
    const expectedEdges = json.traces.length;
    // Counts derived from the SSOT file — robust to graph growth, no magic numbers.
    expect(expectedNodes).toBeGreaterThan(0);

    const counts = await harness.seedFromJson();
    expect(counts.nodes).toBe(expectedNodes);
    expect(counts.edges).toBe(expectedEdges);

    // Round-trip: reload from a fresh handle on the same disk store.
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(REPO_ROOT), storage2, undefined, { lockDir: tmp });
    await harness2.initialize();
    const g = harness2.getGraph();
    expect(g.nodes.length).toBe(expectedNodes);
    expect(g.nodes.find((n) => n.uid === 'SYS-graphcode')).toBeDefined();
    harness = harness2;
  });
});
