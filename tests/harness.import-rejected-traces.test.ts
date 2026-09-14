/**
 * TEST-import-rejected-traces (CR-GC-530) — der Seed prüft jede Kante mit derselben Routine wie
 * R-18 (contracts `traceRejection`). Eine Kante, deren Muster ein Grammatikwechsel entfernt hat
 * (CR-SM-266 D1: ACTOR -io-> UC), sprengt den Boot nicht, landet nicht im Store, wird benannt —
 * und die Reparatur ist ein gewöhnliches delete-edge durchs Gate.
 *
 * Real disk Kuzu on a temp repo, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SYSTEM_ID = 'legacy';
const JSON_REL = join('docs', 'graph', `${SYSTEM_ID}.graph.json`);

// Altbestand: eine legale compose-Kante und eine seit CR-SM-266 D1 entfallene ACTOR -io-> UC.
const LEGACY = {
  elements: [
    { id: 'SYS-legacy', type: 'SYS', name: 'Legacy', description: 'Altbestand-Fixture.' },
    { id: 'UC-use', type: 'UC', name: 'Use', description: '' },
    { id: 'ACTOR-op', type: 'ACTOR', name: 'Operator', description: '' },
  ],
  traces: [
    { source: 'SYS-legacy', target: 'UC-use', type: 'compose' },
    { source: 'ACTOR-op', target: 'UC-use', type: 'io' },
  ],
};
const LEGACY_EDGE = { sourceId: 'ACTOR-op', targetId: 'UC-use', edgeType: 'io' };

type Trace = { source: string; target: string; type: string };

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: SYSTEM_ID },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

describe('TEST-import-rejected-traces: Seed mit musterfremder Kante (CR-GC-530)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-rejected-traces-'));
    mkdirSync(join(repoRoot, 'docs', 'graph'), { recursive: true });
    writeFileSync(join(repoRoot, JSON_REL), JSON.stringify(LEGACY, null, 2));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('lädt den Graphen, hält die musterfremde Kante aus dem Store und nennt sie mit Grund', async () => {
    const res = await harness.seedFromJson();

    expect(res.rejectedTraces).toEqual([{ source: 'ACTOR-op', target: 'UC-use', type: 'io', reason: 'no-pattern' }]);
    expect(res.edges).toBe(1);
    const edges = harness.getGraph().edges;
    expect(edges.some((e) => e.sourceId === 'SYS-legacy' && e.edgeType === 'compose')).toBe(true);
    expect(edges.some((e) => e.sourceId === 'ACTOR-op')).toBe(false);
  });

  it('graph_export verweigert, bis delete-edge durchs Gate die Reparatur annimmt', async () => {
    await harness.seedFromJson();
    const tools = bindToolsToHarness(harness);

    await expect(tools.graph_export.handler({ force: false })).rejects.toThrow(/refused/);

    // Durch das Werkzeug, nicht harness.mutate(): nur graph_mutate schreibt das Audit, aus dem die
    // Export-Sperre die eigene Löschung erkennt (wie in mcp.export-guard.test.ts, CR-GC-296).
    const repair = await tools.graph_mutate.handler({ commands: [{ op: 'delete-edge', edge: LEGACY_EDGE }] });
    expect(repair.success).toBe(true);

    await tools.graph_export.handler({ force: false });
    const written = JSON.parse(readFileSync(join(repoRoot, JSON_REL), 'utf8')) as { traces: Trace[] };
    expect(written.traces.some((t) => t.source === 'ACTOR-op')).toBe(false);
    expect(written.traces.some((t) => t.source === 'SYS-legacy' && t.type === 'compose')).toBe(true);
  });

  it('das Gate blockt dieselbe Kante als neue Kante weiterhin (R-18)', async () => {
    await harness.seedFromJson();

    const add = await harness.mutate([{ op: 'add-edge', edge: { ...LEGACY_EDGE, attributes: {} } }]);

    expect(add.success).toBe(false);
    expect(add.violations.some((v) => v.ruleId === 'R-18')).toBe(true);
  });
});
