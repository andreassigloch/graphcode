/**
 * TEST-mcp-export (CR-GC-127) — graph_export closes the agent loop over MCP.
 *
 * The re-export sync path (CR-GC-113) was only reachable as a library function /
 * a separate process that reloads from lossy Kuzu. graph_export binds it to the
 * LIVE harness (full-fidelity in-memory graph) so an agent finishes its session
 * (spec → impact → implement → EXPORT) entirely over the MCP surface.
 *
 * Real disk Kuzu on a temp repo, no mocks: spec a small graph through the gate,
 * then graph_export and assert the canonical JSON + Markdown views land on disk
 * under the repo root, the JSON round-trips, and views carry the GENERATED header.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  // Kuzu needs the .graphcode parent to exist (createHarness mkdirs it; direct construction doesn't).
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

// A gate-valid member spec: REQ + verifying TEST (R-01) + satisfying MOD (RD-01) + SYS compose (R-17).
const SPEC: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo member', attributes: {} } },
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset capability', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-reset', type: 'TEST', name: 'Reset test', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'MOD-reset', type: 'MOD', name: 'Reset handler', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'SYS-auth', targetId: 'REQ-reset', edgeType: 'compose', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-reset', targetId: 'REQ-reset', edgeType: 'verify', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'MOD-reset', targetId: 'REQ-reset', edgeType: 'satisfy', attributes: {} } },
];

describe('TEST-mcp-export: graph_export writes commit-able docs from the live graph', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-export-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('exports canonical JSON + Markdown views under the repo root, round-trip clean', async () => {
    const tools = bindToolsToHarness(harness);
    const applied = await harness.mutate(SPEC);
    expect(applied.success).toBe(true);

    const res = await tools.graph_export.handler({});

    // JSON written under docs/graph/<systemId>.graph.json
    expect(res.graphJson.path).toBe(join('docs', 'graph', 'auth-service.graph.json'));
    expect(res.graphJson.nodes).toBe(4);
    expect(res.graphJson.edges).toBe(3);
    const jsonAbs = join(repoRoot, res.graphJson.path);
    expect(existsSync(jsonAbs)).toBe(true);

    // Re-parse: the spec'd nodes are present and the file is the canonical shape.
    const parsed = JSON.parse(readFileSync(jsonAbs, 'utf8')) as {
      elements: Array<{ id: string; type: string }>;
      traces: Array<{ source: string; target: string; type: string }>;
    };
    expect(parsed.elements.map((e) => e.id).sort()).toEqual(['MOD-reset', 'REQ-reset', 'SYS-auth', 'TEST-reset']);
    expect(parsed.traces.some((t) => t.source === 'TEST-reset' && t.target === 'REQ-reset' && t.type === 'verify')).toBe(true);

    // Default = ALL views (CR-GC-220: 16), each written with a GENERATED header.
    // The four foundation views are still present (no parallel path — they were extended).
    const written = res.views.map((v) => v.view);
    for (const v of ['architecture', 'cr-list', 'references', 'spec']) expect(written).toContain(v);
    expect(written).toContain('srs'); // a new deterministic SE-artifact view
    expect(written.length).toBe(16);
    for (const v of res.views) {
      const md = readFileSync(join(repoRoot, v.path), 'utf8');
      expect(md).toContain('GENERATED');
      expect(v.bytes).toBeGreaterThan(0);
    }
  });

  it('respects a custom name + view subset', async () => {
    const tools = bindToolsToHarness(harness);
    await harness.mutate(SPEC);
    const res = await tools.graph_export.handler({ name: 'member', views: ['spec'] });
    expect(res.graphJson.path).toBe(join('docs', 'graph', 'member.graph.json'));
    expect(res.views).toHaveLength(1);
    expect(res.views[0].view).toBe('spec');
    expect(existsSync(join(repoRoot, 'docs', 'views', 'spec.md'))).toBe(true);
  });
});
