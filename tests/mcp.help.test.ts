/**
 * TEST-help-tool (CR-GC-229) — graph_help reaches the help data layer over MCP.
 *
 * Real disk Kuzu on a temp repo, no mocks: seed a graph that fires a warning
 * (a lone SYS → R-17), bind the MCP tools, and prove graph_help with no arg
 * returns contextual measures, with a token returns the HelpEntry, and on an
 * unknown token fails cleanly (no crash).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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
    scope: { workspaceId: 'demo-ws', systemId: 'help-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

// A lone SYS with no compose fires R-17 (warning) — gate-accepted (delta blocks only errors),
// so the live graph carries a violation for contextualHelp to rank.
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

  it('no argument → contextual, ranked measures from live readiness + violations', async () => {
    const tools = bindToolsToHarness(harness);
    const out = (await tools.graph_help.handler({})) as { measures: Array<{ blockerKind: string; entry: { plain: string; se: string } }> };
    expect(Array.isArray(out.measures)).toBe(true);
    // The seeded R-17 warning surfaces as a rule measure carrying the help layers.
    const r17 = out.measures.find((m) => m.blockerKind === 'rule' && (m as { entry: { id?: string } }).entry.id === 'R-17');
    expect(r17, 'R-17 measure present').toBeDefined();
    expect(r17!.entry.plain.length).toBeGreaterThan(0);
    expect(r17!.entry.se.length).toBeGreaterThan(0);
  });

  it('with a token → the HelpEntry, all three layers', async () => {
    const tools = bindToolsToHarness(harness);
    const entry = (await tools.graph_help.handler({ token: 'CDR' })) as { kind: string; title: string; plain: string; se: string; prompt?: string };
    expect(entry.kind).toBe('gate');
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
