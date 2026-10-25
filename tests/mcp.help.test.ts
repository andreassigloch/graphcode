/**
 * TEST-help-tool (CR-GC-229) — graph_help reaches the help data layer over MCP.
 *
 * Real disk Kuzu on a temp repo, no mocks: seed a graph that fires a warning
 * (a lone SYS → R-17), bind the MCP tools, and prove graph_help with a token
 * returns the HelpEntry, on an unknown token fails cleanly (no crash), and
 * without a token is rejected with the pointer to rules_get_violations (CR-GC-847).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { strengesSchema } from '../src/kernel/tool-contract.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'help-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A lone SYS with no compose fires R-17 (warning) — gate-accepted (delta blocks only errors),
// so the live graph carries a violation: graph_help without a token must still not evaluate it.
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-x', type: 'SYS', name: 'Lonely system', description: 'no compose yet', attributes: {} } },
];

describe('TEST-help-tool (CR-GC-229): graph_help over MCP', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-help-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.mutate(SPEC);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('is registered in the MCP tool registry', () => {
    const tools = bindToolsToHarness(harness);
    expect(tools.graph_help).toBeDefined();
    expect(tools.graph_help.name).toBe('graph_help');
  });

  // CR-GC-847: die Betriebsart ohne token doppelte rules_get_violations und widersprach ihm.
  it('no argument → rejected, pointing at rules_get_violations (CR-GC-847)', async () => {
    const tools = bindToolsToHarness(harness);
    // Das strenge Schema ist genau das, was die MCP-Grenze vor dem Handler parst (tool-contract.ts).
    const ohne = strengesSchema(tools.graph_help).safeParse({});
    expect(ohne.success, 'token ist Pflicht im Eingabeschema').toBe(false);
    expect(JSON.stringify(ohne.error!.issues)).toContain('rules_get_violations');
    expect(tools.graph_help.description).toContain('rules_get_violations');
  });

  it('with a token → the HelpEntry, all three layers', async () => {
    const tools = bindToolsToHarness(harness);
    const entry = (await tools.graph_help.handler({ token: 'CDR' })) as { kind: string; title: string; plain: string; se: string; prompt?: string };
    expect(entry.kind).toBe('mark'); // CR-GC-748: Marke statt Gate
    expect(entry.title).toMatch(/Critical Design Review/);
    expect(entry.plain.length).toBeGreaterThan(0);
    expect(entry.se.length).toBeGreaterThan(0);
    expect((entry.prompt ?? '').length).toBeGreaterThan(0);
  });

  it('unknown token → a clean error, not a crash', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_help.handler({ token: 'NOPE-999' })).rejects.toThrow(/unknown token/i);
  });
});
