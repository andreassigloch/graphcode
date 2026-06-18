/**
 * TEST-mcp-export-guard — graph_export refuses to clobber the committed SSOT.
 *
 * A long-running MCP server (or a parallel ist-vs-soll sync) can hold a graph
 * that is BEHIND the committed docs/graph/<name>.graph.json. The original
 * graph_export blindly writeFileSync'd over it, silently DROPPING committed
 * elements/traces (observed in the wild: a stale export deleted CR-GC-133).
 *
 * This locks the two guards (mirroring scripts/export-graph.mjs): refuse on an
 * empty live graph, and refuse if the write would delete anything the committed
 * file still has — unless force:true marks the deletion intentional.
 *
 * Real disk Kuzu on a temp repo, no mocks. The "newer committed SSOT" is
 * simulated by injecting an extra element into the on-disk file (test setup),
 * NOT by hand-editing any real project graph.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'auth-service' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// Gate-valid member spec: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose.
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

const JSON_REL = join('docs', 'graph', 'auth-service.graph.json');

describe('TEST-mcp-export-guard: graph_export refuses to clobber the committed SSOT', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-export-guard-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('refuses to overwrite a populated SSOT with an empty live graph', async () => {
    const tools = bindToolsToHarness(harness);
    // Seed a committed file via a first valid export, then point an empty graph at it.
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });
    // New empty harness on the SAME repo (fresh Kuzu wiped → 0 nodes).
    await harness.close();
    rmSync(join(repoRoot, '.graphcode'), { recursive: true, force: true });
    harness = makeHarness(repoRoot);
    await harness.initialize();
    const emptyTools = bindToolsToHarness(harness);
    await expect(emptyTools.graph_export.handler({ force: false })).rejects.toThrow(/0 elements/);
  });

  it('refuses when the write would drop an element present in the committed file', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });

    // Simulate a NEWER committed SSOT (parallel writer added one element + trace).
    const jsonAbs = join(repoRoot, JSON_REL);
    const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
      elements: Array<Record<string, unknown>>;
      traces: Array<Record<string, unknown>>;
    };
    committed.elements.push({ id: 'TEST-parallel', type: 'TEST', name: 'Parallel', description: '' });
    committed.traces.push({ source: 'TEST-parallel', target: 'REQ-reset', type: 'verify', weight: 1 });
    writeFileSync(jsonAbs, JSON.stringify(committed, null, 2));

    // The live graph still has 4 nodes → export would delete TEST-parallel → refuse.
    await expect(tools.graph_export.handler({ force: false })).rejects.toThrow(/would delete .*TEST-parallel/s);

    // The committed file is untouched by the refused write.
    const after = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<{ id: string }> };
    expect(after.elements.map((e) => e.id)).toContain('TEST-parallel');
  });

  it('force:true overrides the guard for an intentional deletion', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
    await tools.graph_export.handler({ force: false });

    const jsonAbs = join(repoRoot, JSON_REL);
    const committed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<Record<string, unknown>> };
    committed.elements.push({ id: 'TEST-parallel', type: 'TEST', name: 'Parallel', description: '' });
    writeFileSync(jsonAbs, JSON.stringify(committed, null, 2));

    const res = await tools.graph_export.handler({ force: true });
    expect(res.graphJson.nodes).toBe(4);
    const after = JSON.parse(readFileSync(jsonAbs, 'utf8')) as { elements: Array<{ id: string }> };
    expect(after.elements.map((e) => e.id)).not.toContain('TEST-parallel');
  });
});
