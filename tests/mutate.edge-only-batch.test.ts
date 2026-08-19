/**
 * TEST-edge-only-batch (CR-GC-310) — a Format-E batch that only adds edges between
 * nodes the store already holds needs no `### <TYPE>` sections.
 *
 * Before this CR such a batch died in the codec with
 *
 *   Cannot resolve type of source "…" — not declared under a "### <TYPE>" section
 *   and no resolveType provided
 *
 * `FormatECodec.parse` has taken a `resolveType` option all along; `graph_mutate`
 * never passed one, so the author had to re-declare nodes the store already knew.
 * That cost a whole run in the Graphview field test.
 *
 * The point of this file is the BOUNDARY, not the happy path: resolving what exists
 * must not become inventing what doesn't. Three ways that could go wrong, all
 * asserted below — an unknown uid must stay an error (a typo must never turn into a
 * new node), a declared type contradicting the store must be an error (not a silent
 * retype), and pair-legality must still be checked against the resolved types
 * (relaxed INPUT, unchanged VERDICT).
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { GraphCodeCodec } from '../src/codec.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** A REQ awaiting its verify edge, and the TEST that will carry it. */
const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' },
    {
      id: 'REQ-recall',
      type: 'REQ',
      name: 'Frueheren Stand reproduzieren',
      description: 'Das System muss einen frueheren Graph-Stand aus dem committeten Snapshot herstellen.',
    },
    {
      id: 'TEST-recall',
      type: 'TEST',
      name: 'Recall-Test',
      description: 'Reseed eines aelteren Snapshots stellt exakt jenen Stand wieder her.',
    },
  ],
  traces: [],
};

/** No `## Nodes` block at all — this is the shape the field test could not send. */
const EDGE_ONLY = '## Edges\n+ TEST-recall -verify-> REQ-recall\n';

type Violation = { ruleId: string; severity: string; message: string };

describe('TEST-edge-only-batch: edges between existing nodes need no type sections (CR-GC-310)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-edge-only-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(SEED);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('applies an edge-only formatE batch and persists the trace', async () => {
    const res = await tools.graph_mutate.handler({ formatE: EDGE_ONLY, consumerId: 't' });

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.mutations).toBe(1);

    const edges = harness.getGraph().edges.filter((e) => e.edgeType === 'verify');
    expect(edges).toContainEqual(
      expect.objectContaining({ sourceId: 'TEST-recall', targetId: 'REQ-recall', edgeType: 'verify' }),
    );
  });

  it('rejects an unknown uid instead of inventing a node — as a block verdict, not a throw', async () => {
    // The boundary. `TEST-recal` is one character short: a typo, not a new node.
    const res = await tools.graph_mutate.handler({
      formatE: '## Edges\n+ TEST-recal -verify-> REQ-recall\n',
      consumerId: 't',
    });

    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(res.mutations).toBe(0);
    // CR-GC-286: a decode failure is an audited rejection, not a transport crash.
    expect((res.violations as Violation[]).map((v) => v.ruleId)).toContain('STRUCT');
    expect(harness.getGraph().nodes.map((n) => n.uid)).not.toContain('TEST-recal');
  });

  it('refuses a declared type that contradicts the store — no silent retype', async () => {
    // `REQ-recall` exists as a REQ. Declaring it a MOD must not update it, and must
    // not be quietly ignored either.
    const res = await tools.graph_mutate.handler({
      formatE: '## Nodes\n### MOD\n+ REQ-recall|Umdeklariert.\n',
      consumerId: 't',
    });

    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-recall')?.type).toBe('REQ');
  });

  it('still checks pair-legality against the resolved types', async () => {
    // TEST -allocate-> REQ is not a legal pair. Resolving the endpoints must feed the
    // validator, not bypass it: relaxed input, unchanged verdict.
    const res = await tools.graph_mutate.handler({
      formatE: '## Edges\n+ TEST-recall -allocate-> REQ-recall\n',
      consumerId: 't',
    });

    expect(res.success).toBe(false);
    expect(harness.getGraph().edges.some((e) => e.edgeType === 'allocate')).toBe(false);
  });
});

describe('GraphCodeCodec.decode: resolveType is opt-in (CR-GC-310)', () => {
  const codec = new GraphCodeCodec();

  it('without a resolver an edge-only block stays an error', async () => {
    // The default is unchanged — callers that hold no store keep the strict behaviour.
    expect(() => codec.decode(EDGE_ONLY)).toThrow();
  });

  it('with a resolver the same block decodes to the edge alone', async () => {
    const types = new Map([
      ['TEST-recall', 'TEST'],
      ['REQ-recall', 'REQ'],
    ]);
    const graph = codec.decode(EDGE_ONLY, { resolveType: (uid) => types.get(uid) });

    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toEqual([
      expect.objectContaining({ sourceId: 'TEST-recall', targetId: 'REQ-recall', edgeType: 'verify' }),
    ]);
  });
});
