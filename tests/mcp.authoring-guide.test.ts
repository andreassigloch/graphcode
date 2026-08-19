/**
 * TEST-graph-authoring-guide (CR-GC-231) — surface legal incident edges from the
 * imported SE meta-model (TRACE_PATTERNS), never a local fork. The write-side read-twin
 * of graph_context: an agent queries it BEFORE authoring a node. Real disk Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'guide-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

describe('TEST-graph-authoring-guide (CR-GC-231): legal edges from the meta-model', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-guide-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('UC → legal outgoing/incoming edges derived from TRACE_PATTERNS', async () => {
    const tools = bindToolsToHarness(harness);
    const guide = await tools.graph_authoring_guide.handler({ type: 'UC' });

    expect(guide.type).toBe('UC');
    // Outgoing: UC composes REQ and FCHAIN.
    const out = guide.outgoing.map((e) => `${e.edgeType}->${e.targetType}`);
    expect(out).toEqual(expect.arrayContaining(['compose->REQ', 'compose->FCHAIN']));
    // Incoming: SYS compose, FUNC satisfy, ACTOR/FLOW io.
    const inc = guide.incoming.map((e) => `${e.sourceType}-${e.edgeType}`);
    // CR-GC-366: 'FUNC-satisfy' ist hier weg — ein UC wird nicht mehr direkt von einer FUNC
    // erfuellt, sondern ueber `UC -compose-> FCHAIN -compose-> FUNC` erreicht.
    expect(inc).toEqual(expect.arrayContaining(['SYS-compose', 'ACTOR-io', 'FLOW-io']));
    expect(inc).not.toContain('FUNC-satisfy');
    // requiredAttrs is present (an array, from the node descriptor).
    expect(Array.isArray(guide.requiredAttrs)).toBe(true);
    // Carries the meta-model descriptions/cardinality (not a bare pair list).
    expect(guide.outgoing.some((e) => typeof e.description === 'string' && e.description.length > 0)).toBe(true);
  });

  it('is read-only — the call mutates nothing', async () => {
    const tools = bindToolsToHarness(harness);
    const before = harness.getGraph().nodes.length;
    await tools.graph_authoring_guide.handler({ type: 'REQ' });
    expect(harness.getGraph().nodes.length).toBe(before);
  });

  it('unknown type → a clear error listing the valid types', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_authoring_guide.handler({ type: 'WIDGET' })).rejects.toThrow(/unknown element type/i);
  });
});
