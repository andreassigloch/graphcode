/**
 * TEST-mcp-stdio-server (CR-GC-111) — the registry, served over the real MCP
 * protocol, end-to-end.
 *
 * Boots `buildMcpServer(harness)` and an MCP `Client` over a linked in-memory
 * transport pair (the SDK's canonical protocol harness). The HARNESS is real:
 * disk Kuzu on a temp dir, no mocks of our code — only the wire is in-process.
 *
 * Proves:
 *   - REQ-mcp-tool-registry : every bound tool is enumerable via `listTools`.
 *   - REQ-mcp-gate-symmetry : `graph_mutate` over the protocol == harness.mutate()
 *     on a twin store — identical success/tier (L2 end-to-end), incl. the R-01 BLOCK.
 *   - REQ-single-transport  : the server speaks MCP only; query-precision tools
 *     (graph_impact) return a bounded slice, never the full graph.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { buildMcpServer } from '../src/mcp-server.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'agent', preCommitTimeout: 5000 };
}

function makeHarness(tmp: string): GraphCodeHarness {
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  return new GraphCodeHarness(makeConfig(tmp), storage);
}

/** Parse the JSON payload an MCP tool returned as its single text content block. */
function payload<T = unknown>(result: unknown): T {
  const content = (result as { content?: Array<{ type: string; text: string }> }).content;
  expect(content?.[0]?.type).toBe('text');
  return JSON.parse(content![0].text) as T;
}

const VALID_SET: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-srv-001', type: 'REQ', name: 'Server req', description: 'protocol test', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-srv-001', type: 'TEST', name: 'Server test', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-srv-001', targetId: 'REQ-srv-001', edgeType: 'verify', attributes: {} } },
];

describe('TEST-mcp-stdio-server: registry served over the MCP protocol', () => {
  let tmpSrv: string;
  let tmpTwin: string;
  let srvHarness: GraphCodeHarness;
  let twinHarness: GraphCodeHarness;
  let client: Client;

  beforeEach(async () => {
    tmpSrv = mkdtempSync(join(tmpdir(), 'graphcode-srv-'));
    tmpTwin = mkdtempSync(join(tmpdir(), 'graphcode-twin-'));
    srvHarness = makeHarness(tmpSrv);
    twinHarness = makeHarness(tmpTwin);
    await srvHarness.initialize();
    await twinHarness.initialize();

    const server = buildMcpServer(srvHarness);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await srvHarness.close();
    await twinHarness.close();
    rmSync(tmpSrv, { recursive: true, force: true });
    rmSync(tmpTwin, { recursive: true, force: true });
  });

  it('enumerates the full bound registry over listTools (REQ-mcp-tool-registry)', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    // Derived from the live in-process registry, NOT a hardcoded list — the MCP
    // surface must equal bindToolsToHarness() exactly (REQ-mcp-tool-registry). A new
    // tool extends both sides; no magic count to bump (CR-GC-205 Item 2).
    const registryNames = Object.keys(bindToolsToHarness(twinHarness)).sort();
    expect(names).toEqual(registryNames);
    expect(names.length).toBeGreaterThan(0);
    // Schemas are advertised, not empty — the agent KNOWS the inputs.
    const mutate = tools.find((t) => t.name === 'graph_mutate');
    expect(mutate?.inputSchema?.properties).toHaveProperty('commands');
  });

  it('graph_mutate over the protocol == harness.mutate() on a twin (REQ-mcp-gate-symmetry, L2)', async () => {
    const viaMcp = payload<{ success: boolean; tier: string; violations: { ruleId: string }[] }>(
      await client.callTool({ name: 'graph_mutate', arguments: { commands: VALID_SET, consumerId: 'mcp-it' } }),
    );
    const direct = await twinHarness.mutate(VALID_SET);

    expect(viaMcp.success).toBe(true);
    expect(viaMcp.success).toBe(direct.success);
    expect(viaMcp.tier).toBe(direct.tier);
    expect(viaMcp.violations.map((v) => v.ruleId).sort()).toEqual(direct.violations.map((v) => v.ruleId).sort());

    // The write actually persisted in the server's store.
    const got = payload<{ node: { uid: string } | null }>(
      await client.callTool({ name: 'graph_get_node', arguments: { uid: 'REQ-srv-001' } }),
    );
    expect(got.node?.uid).toBe('REQ-srv-001');
  });

  it('blocks an orphan REQ identically over the protocol (R-01 BLOCK)', async () => {
    const orphan: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-srv-orphan', type: 'REQ', name: 'Orphan', description: 'no test', attributes: {} } },
    ];
    const viaMcp = payload<{ success: boolean; tier: string; mutations: number; violations: { ruleId: string }[] }>(
      await client.callTool({ name: 'graph_mutate', arguments: { commands: orphan, consumerId: 'mcp-it' } }),
    );
    const direct = await twinHarness.mutate(orphan);

    expect(viaMcp.success).toBe(false);
    expect(direct.success).toBe(false);
    expect(viaMcp.tier).toBe('block');
    expect(viaMcp.mutations).toBe(0);
    expect(viaMcp.violations.some((v) => v.ruleId === 'R-01')).toBe(true);
  });

  it('graph_impact returns a bounded slice, not the full graph (REQ-single-transport / query-precision)', async () => {
    await client.callTool({ name: 'graph_mutate', arguments: { commands: VALID_SET, consumerId: 'mcp-it' } });
    const impact = payload<{ nodeCount: number; rootId: string; formatE: string }>(
      await client.callTool({ name: 'graph_impact', arguments: { id: 'REQ-srv-001', depth: 1 } }),
    );
    expect(impact.rootId).toBe('REQ-srv-001');
    expect(impact.nodeCount).toBeGreaterThan(0);
    // Bounded: the root + its direct verify-neighbor, not an unbounded dump.
    expect(impact.nodeCount).toBeLessThanOrEqual(VALID_SET.length);
  });
});
