/**
 * TEST-agent-agnostic (CR-GC-124) — the headless MCP-stdio surface is identical
 * no matter which agent connects. Claude Code is just ONE client; OpenCode (or
 * any MCP host) gets the SAME tool set and the SAME gate semantics.
 *
 * Realizes:
 *   - FUNC-serve-stdio       : the served surface is the bound registry, full stop.
 *   - REQ-agent-agnostic     : no client-specific branching — two independent
 *     clients see identical tools and get identical gate behavior.
 *   - TEST-agent-agnostic    : this file (the PROOF).
 *
 * Construction (real protocol, real disk store, no mocks of our code):
 *   - ONE GraphCodeHarness on a real DISK Kuzu store in a fresh temp dir (the
 *     single Kuzu owner — REQ-single-kuzu-owner / REQ-disk-persistence). NEVER
 *     :memory:, NEVER the repo's .graphcode dir.
 *   - TWO McpServer instances bound to that ONE harness (`buildMcpServer` twice)
 *     — every write from either still goes through the SAME harness.mutate() gate
 *     over the SAME store. In production these are two `graphcode mcp` processes;
 *     here both share the one owner so the gate is provably the same gate.
 *   - TWO Client instances ("agent-claude-code" / "agent-opencode"), each on its
 *     own linked in-memory transport pair. Only the wire is in-process.
 *
 * The client name (= the agent) is supplied at the initialize handshake and to
 * graph_mutate as consumerId — i.e. the author. We assert it changes NOTHING:
 * identical tools, identical success/tier, identical R-01 BLOCK under delta-
 * semantics. Author is logged, never used to branch (L1).
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
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'agent', preCommitTimeout: 5000 };
}

function makeHarness(tmp: string): GraphCodeHarness {
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  return new GraphCodeHarness(makeConfig(tmp), storage);
}

/** Connect one fresh MCP Client (an "agent") to a fresh server bound to `harness`. */
async function connectAgent(agentName: string, harness: GraphCodeHarness): Promise<Client> {
  const server = buildMcpServer(harness);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: agentName, version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Parse the JSON payload an MCP tool returned as its single text content block. */
function payload<T = unknown>(result: unknown): T {
  const content = (result as { content?: Array<{ type: string; text: string }> }).content;
  expect(content?.[0]?.type).toBe('text');
  return JSON.parse(content![0].text) as T;
}

// A self-traced REQ (REQ <-verify- TEST): valid, lands through the gate.
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-aa-${suffix}`, type: 'REQ', name: 'Agnostic req', description: 'agent-agnostic test', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-aa-${suffix}`, type: 'TEST', name: 'Agnostic test', description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-aa-${suffix}`, targetId: `REQ-aa-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

// A lone REQ with no verify trace → introduces R-01 (error) → blocked under delta-semantics.
function orphanReq(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-aa-orphan-${suffix}`, type: 'REQ', name: 'Orphan', description: 'no verify', attributes: {} } },
  ];
}

type GateResult = { success: boolean; tier: string; mutations: number; violations: { ruleId: string }[] };

describe('TEST-agent-agnostic: identical surface + gate for any MCP client (CR-GC-124)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let claudeCode: Client; // simulates the Claude Code agent
  let openCode: Client; // simulates the OpenCode agent

  beforeEach(async () => {
    // ONE real disk Kuzu store in a fresh temp dir — the single owner both agents share.
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-agnostic-'));
    harness = makeHarness(tmp);
    await harness.initialize();

    // TWO independent clients (two different agents) over the SAME harness/store.
    claudeCode = await connectAgent('agent-claude-code', harness);
    openCode = await connectAgent('agent-opencode', harness);
  });

  afterEach(async () => {
    await claudeCode.close();
    await openCode.close();
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) both agents see the IDENTICAL tool set — same names + count (FUNC-serve-stdio)', async () => {
    const claudeTools = (await claudeCode.listTools()).tools.map((t) => t.name).sort();
    const openCodeTools = (await openCode.listTools()).tools.map((t) => t.name).sort();

    // Identical, regardless of which agent asks.
    expect(openCodeTools).toEqual(claudeTools);
    expect(openCodeTools.length).toBe(claudeTools.length);

    // And it is the full bound registry (anchors the surface, not just "two equal empties").
    expect(claudeTools).toEqual([
      'audit_stats',
      'audit_trail',
      'graph_authoring_guide',
      'graph_context',
      'graph_elements',
      'graph_expand',
      'graph_export',
      'graph_get_edges',
      'graph_get_node',
      'graph_help',
      'graph_impact',
      'graph_merge',
      'graph_mutate',
      'graph_next_step',
      'graph_readiness',
      'graph_realize',
      'graph_reseed',
      'graph_tests',
      'rules_evaluate',
      'rules_get_violations',
    ]);
  });

  it('(b1) a valid mutation passes the gate identically for either agent (REQ-agent-agnostic)', async () => {
    const viaClaude = payload<GateResult>(
      await claudeCode.callTool({ name: 'graph_mutate', arguments: { commands: validSet('cc'), consumerId: 'agent-claude-code' } }),
    );
    const viaOpenCode = payload<GateResult>(
      await openCode.callTool({ name: 'graph_mutate', arguments: { commands: validSet('oc'), consumerId: 'agent-opencode' } }),
    );

    // Same success + same tier — author-independent.
    expect(viaClaude.success).toBe(true);
    expect(viaOpenCode.success).toBe(viaClaude.success);
    expect(viaOpenCode.tier).toBe(viaClaude.tier);
    expect(viaOpenCode.violations.map((v) => v.ruleId).sort()).toEqual(viaClaude.violations.map((v) => v.ruleId).sort());

    // Both writes persisted in the ONE shared store (the gate is the same gate).
    const ccNode = payload<{ node: { uid: string } | null }>(
      await openCode.callTool({ name: 'graph_get_node', arguments: { uid: 'REQ-aa-cc' } }),
    );
    const ocNode = payload<{ node: { uid: string } | null }>(
      await claudeCode.callTool({ name: 'graph_get_node', arguments: { uid: 'REQ-aa-oc' } }),
    );
    // Claude's write is visible to OpenCode and vice-versa — one store, one gate.
    expect(ccNode.node?.uid).toBe('REQ-aa-cc');
    expect(ocNode.node?.uid).toBe('REQ-aa-oc');
  });

  it('(b2) an R-01-introducing mutation is BLOCKED identically for either agent (REQ-agent-agnostic)', async () => {
    const viaClaude = payload<GateResult>(
      await claudeCode.callTool({ name: 'graph_mutate', arguments: { commands: orphanReq('cc'), consumerId: 'agent-claude-code' } }),
    );
    const viaOpenCode = payload<GateResult>(
      await openCode.callTool({ name: 'graph_mutate', arguments: { commands: orphanReq('oc'), consumerId: 'agent-opencode' } }),
    );

    // Identical BLOCK: same success(false), same tier(block), same 0 mutations, same R-01.
    expect(viaClaude.success).toBe(false);
    expect(viaOpenCode.success).toBe(viaClaude.success);
    expect(viaClaude.tier).toBe('block');
    expect(viaOpenCode.tier).toBe(viaClaude.tier);
    expect(viaClaude.mutations).toBe(0);
    expect(viaOpenCode.mutations).toBe(viaClaude.mutations);
    expect(viaClaude.violations.some((v) => v.ruleId === 'R-01')).toBe(true);
    expect(viaOpenCode.violations.some((v) => v.ruleId === 'R-01')).toBe(true);

    // Nothing persisted for either agent — neither orphan exists in the shared store.
    const ccBlocked = payload<{ node: { uid: string } | null }>(
      await claudeCode.callTool({ name: 'graph_get_node', arguments: { uid: 'REQ-aa-orphan-cc' } }),
    );
    const ocBlocked = payload<{ node: { uid: string } | null }>(
      await openCode.callTool({ name: 'graph_get_node', arguments: { uid: 'REQ-aa-orphan-oc' } }),
    );
    expect(ccBlocked.node).toBeNull();
    expect(ocBlocked.node).toBeNull();
  });
});
