/**
 * TEST-read-format-param (CR-GC-210) — the read-tool output-format contract.
 *
 * graph_elements / graph_get_edges return JSON by default (agent logic) and a
 * round-trip-stable Format-E slice on format:'formatE' — the same uid.TYPE dialect
 * the slice-tools (graph_impact/graph_expand) always emit. Real disk Kuzu, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { GraphCodeCodec } from '../src/codec.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'fmt-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A gate-valid slice: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose (R-17).
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

describe('TEST-read-format-param (CR-GC-210): JSON default, Format-E opt-in', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-fmt-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.mutate(SPEC);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_elements: default = JSON; format:formatE = parseable, round-trip-stable Format-E', async () => {
    const tools = bindToolsToHarness(harness);

    // Default (no format) → JSON, unchanged contract (no breaking change for existing skills).
    const json = (await tools.graph_elements.handler({ limit: 100 })) as { nodes: Array<{ uid: string }>; total: number };
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(json.nodes.map((n) => n.uid)).toContain('REQ-reset');

    // format:'formatE' → a Format-E string that the SAME codec re-imports with no errors.
    const fe = (await tools.graph_elements.handler({ limit: 100, format: 'formatE' })) as { formatE: string; total: number };
    expect(typeof fe.formatE).toBe('string');
    expect(fe.formatE).toContain('REQ-reset');
    // Round-trip: the same codec re-imports the slice; the seeded uids come back.
    const decoded = new GraphCodeCodec().decode(fe.formatE);
    expect(decoded.nodes.map((n) => n.uid)).toContain('REQ-reset');
  });

  it('graph_get_edges: default = JSON; format:formatE = parseable Format-E (edges + endpoint nodes)', async () => {
    const tools = bindToolsToHarness(harness);

    const json = (await tools.graph_get_edges.handler({})) as { edges: Array<{ edgeType: string }>; total: number };
    expect(Array.isArray(json.edges)).toBe(true);
    expect(json.edges.length).toBeGreaterThan(0);

    const fe = (await tools.graph_get_edges.handler({ format: 'formatE' })) as { formatE: string; total: number };
    expect(typeof fe.formatE).toBe('string');
    // Endpoint nodes are included → no dangling reference → the codec re-imports it cleanly.
    const decoded = new GraphCodeCodec().decode(fe.formatE);
    expect(decoded.edges.length).toBeGreaterThan(0);
    expect(fe.formatE).toContain('REQ-reset');
  });
});
