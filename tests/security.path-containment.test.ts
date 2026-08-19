/**
 * TEST-path-containment (CR-GC-255) — the two reproduced escapes from the 2026-07-26
 * audit, pinned. Real disk Kuzu on a temp repo, real writes, no mocks.
 *
 * Both sinks joined a graph-/agent-supplied path onto repoRoot with no containment
 * check, so a file landed anywhere the process user can write:
 *   1. testRef.file from the graph  → stub materialization (`join(repoRoot, stub.file)`)
 *   2. the tool's `name` input      → docs/graph/<name>.graph.json
 * The governance consequence is the sharper one: a JSON outside docs/graph/ escapes
 * BOTH the deny-graph-write hook glob AND the pre-commit freshness guard, while
 * clearExportPending() still fires — drift marker gone, real SSOT silently stale.
 *
 * Plus the third finding: the read-only bridge bound `::` (all interfaces) while its
 * log claimed 127.0.0.1.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { HostBridge } from '../src/viewer/host.js';
import { isExportPending, setExportPending } from '../src/export-marker.js';
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

/** Gate-valid minimal spec: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose (R-17). */
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

describe('TEST-path-containment: no graph-driven write escapes repoRoot (CR-GC-255)', () => {
  // The temp repo lives two levels deep, so a `../../` escape has somewhere to land
  // that we can assert on (that is exactly how the audit reproduced it).
  let outer: string;
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    outer = mkdtempSync(join(tmpdir(), 'graphcode-containment-'));
    repoRoot = join(outer, 'nested', 'repo');
    mkdirSync(repoRoot, { recursive: true });
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(outer, { recursive: true, force: true });
  });

  it('sink 1: a traversing testRef never materializes a stub outside repoRoot', async () => {
    // The gate accepts the attribute (testRef presence is R-19 warning-level, not a
    // block) — containment must therefore hold at the WRITE, not at the write's input.
    await harness.mutate([
      {
        op: 'update-node',
        node: {
          uid: 'TEST-reset',
          type: 'TEST',
          attributes: { testRef: { file: '../../ESCAPED-BY-EXPORT.test.ts', tool: 'vitest' } },
        },
      },
    ]);

    const result = await tools.graph_export.handler({ name: 'auth-service', views: undefined, force: false });

    // TestRefSchema no longer parses a `..` path (contracts CR-GC-255), so
    // renderTestStubs skips it: no stub, and nothing written above repoRoot.
    expect(result.stubs).toEqual([]);
    expect(existsSync(join(outer, 'ESCAPED-BY-EXPORT.test.ts'))).toBe(false);
    expect(existsSync(join(outer, 'nested', 'ESCAPED-BY-EXPORT.test.ts'))).toBe(false);

    // R-19 reports the invalid binding — the gap is surfaced, not swallowed.
    const violations = harness.evaluateRules();
    expect(violations.some((v) => v.ruleId === 'R-19' && v.elementId === 'TEST-reset')).toBe(true);
  });

  it('sink 2: a traversing `name` is rejected and leaves the drift marker set', async () => {
    // The marker is what the pre-commit freshness guard reads. A refused export must
    // NOT clear it — otherwise the commit passes with a stale committed SSOT.
    setExportPending(repoRoot);

    const parsed = tools.graph_export.inputSchema.safeParse({ name: '../../../ESCAPED-NAME' });
    expect(parsed.success).toBe(false); // schema explains it early to the agent

    // …and the assertion is the actual lock, independent of the schema (a future
    // third sink hits it too): call the handler with the unvalidated input.
    await expect(
      tools.graph_export.handler({ name: '../../../ESCAPED-NAME', views: undefined, force: false }),
    ).rejects.toThrow(/path containment/i);

    expect(existsSync(join(outer, 'ESCAPED-NAME.graph.json'))).toBe(false);
    expect(existsSync(join(outer, 'nested', 'ESCAPED-NAME.graph.json'))).toBe(false);
    expect(isExportPending(repoRoot)).toBe(true);
  });

  it('a plain export still writes inside repoRoot and clears the marker', async () => {
    setExportPending(repoRoot);
    const result = await tools.graph_export.handler({ name: 'auth-service', views: undefined, force: false });
    expect(result.graphJson.path).toBe(join('docs', 'graph', 'auth-service.graph.json'));
    expect(existsSync(join(repoRoot, result.graphJson.path))).toBe(true);
    expect(isExportPending(repoRoot)).toBe(false);
  });
});

describe('TEST-bridge-loopback: the read-only bridge binds 127.0.0.1, not :: (CR-GC-255)', () => {
  let tmp: string;
  let bridge: HostBridge;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-loopback-'));
    bridge = new HostBridge({ repoRoot: tmp, port: 0 });
    await bridge.start();
  });

  afterEach(async () => {
    await bridge.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('the bound address is loopback — the log line and reality now agree', () => {
    // Read the live bound address off the server the bridge owns. `::` here would
    // mean /elements, /subgraph and /health are LAN-readable without auth.
    const server = (bridge as unknown as { server: Server }).server;
    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe('string');
    expect((address as { address: string }).address).toBe('127.0.0.1');
  });
});
