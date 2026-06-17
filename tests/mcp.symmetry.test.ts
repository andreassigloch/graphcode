/**
 * TEST-mcp-symmetry — MCP graph_mutate handler == harness.mutate() (L2 / REQ-mcp-gate-symmetry).
 *
 * Seeds two independent harnesses on separate temp disk paths.
 * Runs the SAME command set:
 *   (a) through  bindToolsToHarness(harness).graph_mutate.handler(...)
 *   (b) through  harness2.mutate(...)
 * Asserts identical success, tier, and violation ruleIds — proving the MCP handler
 * is a thin delegate with no extra logic.
 *
 * Also verifies the BLOCK path: an error-severity rule (R-01: REQ without verify)
 * must block identically through both paths.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

function makeHarness(tmp: string): GraphCodeHarness {
  const kuzuPath = join(tmp, 'kuzu');
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
  return new GraphCodeHarness(makeConfig(tmp), storage);
}

describe('TEST-mcp-symmetry: MCP graph_mutate == harness.mutate()', () => {
  let tmpA: string;
  let tmpB: string;
  let harnessA: GraphCodeHarness;
  let harnessB: GraphCodeHarness;

  beforeEach(async () => {
    tmpA = mkdtempSync(join(tmpdir(), 'graphcode-sym-a-'));
    tmpB = mkdtempSync(join(tmpdir(), 'graphcode-sym-b-'));
    harnessA = makeHarness(tmpA);
    harnessB = makeHarness(tmpB);
    await harnessA.initialize();
    await harnessB.initialize();
  });

  afterEach(async () => {
    await harnessA.close();
    await harnessB.close();
    rmSync(tmpA, { recursive: true, force: true });
    rmSync(tmpB, { recursive: true, force: true });
  });

  it('valid command set: MCP handler and direct mutate produce identical success/tier/violations', async () => {
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-sym-001', type: 'REQ', name: 'Sym req', description: 'symmetry test', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-sym-001', type: 'TEST', name: 'Sym test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-sym-001', targetId: 'REQ-sym-001', edgeType: 'verify', attributes: {} } },
    ];

    // Path (a): MCP handler
    const registry = bindToolsToHarness(harnessA);
    const mcpResult = await registry['graph_mutate'].handler({ commands, consumerId: 'test' });

    // Path (b): direct harness call
    const directResult = await harnessB.mutate(commands);

    expect(mcpResult.success).toBe(directResult.success);
    expect(mcpResult.tier).toBe(directResult.tier);
    expect(mcpResult.success).toBe(true);

    // Violation ruleIds must match (order-independent)
    const mcpRuleIds = mcpResult.violations.map((v: { ruleId: string }) => v.ruleId).sort();
    const directRuleIds = directResult.violations.map((v) => v.ruleId).sort();
    expect(mcpRuleIds).toEqual(directRuleIds);
  });

  it('blocked command set (R-01): MCP handler and direct mutate both block identically', async () => {
    const commands: MutateCommand[] = [
      // A REQ without a verify-edge triggers R-01 (error severity) → block
      { op: 'add-node', node: { uid: 'REQ-orphan', type: 'REQ', name: 'Orphan req', description: 'no test', attributes: {} } },
    ];

    const registry = bindToolsToHarness(harnessA);
    const mcpResult = await registry['graph_mutate'].handler({ commands, consumerId: 'test' });
    const directResult = await harnessB.mutate(commands);

    expect(mcpResult.success).toBe(false);
    expect(directResult.success).toBe(false);
    expect(mcpResult.tier).toBe('block');
    expect(directResult.tier).toBe('block');
    expect(mcpResult.mutations).toBe(0);
    expect(directResult.mutations).toBe(0);

    const mcpR01 = mcpResult.violations.find((v: { ruleId: string }) => v.ruleId === 'R-01');
    const directR01 = directResult.violations.find((v) => v.ruleId === 'R-01');
    expect(mcpR01).toBeDefined();
    expect(directR01).toBeDefined();
    expect(mcpR01.severity).toBe(directR01?.severity);
    expect(mcpR01.elementId).toBe(directR01?.elementId);
  });

  it('audit_trail records MCP mutations', async () => {
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-audit', type: 'REQ', name: 'Audit req', description: 'audit test', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-audit', type: 'TEST', name: 'Audit test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-audit', targetId: 'REQ-audit', edgeType: 'verify', attributes: {} } },
    ];

    const registry = bindToolsToHarness(harnessA);
    await registry['graph_mutate'].handler({ commands, consumerId: 'ci-bot' });

    const { entries } = await registry['audit_trail'].handler({ limit: 10 });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].consumerId).toBe('ci-bot');
    expect(entries[0].operation).toBe('mutate');
  });
});
