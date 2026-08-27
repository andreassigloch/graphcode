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
import { GraphCodeHarness } from '../src/harness/harness.js';
import { GraphCodeCodec } from '../src/codec/codec.js';
import { bindToolsToHarness } from '../src/tools/mcp-tools.js';
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
  { op: 'add-node', node: { uid: 'REQ-reset', type: 'REQ', name: 'Password reset', description: 'reset', attributes: { kinds: ['non-functional'] } } },
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

/**
 * CR-GC-363 — Freshness-Banner inline im Read-Ergebnis.
 *
 * Der vorhandene AF-Stamp (SYS.attributes.analysisFreshness.<id>.graphVersion,
 * contracts AF-01..05) wird im Format-E-Kopf von graph_context UND graph_impact
 * sichtbar, sobald er hinter dem Live-graphVersion liegt. Frischer (oder gar
 * kein) Stamp → Ergebnis byte-unverändert. Das Banner ist eine `//`-Zeile und
 * damit Format-E-parsebar (parse überspringt Kommentare — Round-Trip bleibt).
 */
describe('CR-GC-363: Freshness-Banner inline (graph_context + graph_impact)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  const STAMPED_SPEC: MutateCommand[] = [
    { op: 'add-node', node: { uid: 'SYS-auth', type: 'SYS', name: 'Auth service', description: 'demo', attributes: { analysisFreshness: { conops: { graphVersion: 1 } } } } },
    ...SPEC.slice(1),
  ];

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-fresh-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('frischer Stamp: byte-unverändert; veralteter Stamp: genau eine parsebare Kopfzeile', async () => {
    const tools = bindToolsToHarness(harness);
    // Tool-Layer-Write: zählt den graphVersion-Zähler auf 1 — der Stamp (v1) ist damit CURRENT.
    const seeded = (await tools.graph_mutate.handler({ commands: STAMPED_SPEC })) as { success: boolean };
    expect(seeded.success).toBe(true);

    const freshCtx = (await tools.graph_context.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    const freshImp = (await tools.graph_impact.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    // Kein Rauschen im Normalfall: keine Banner-Zeile, Ergebnis beginnt mit dem Slice selbst.
    expect(freshCtx.formatE.startsWith('## Nodes')).toBe(true);
    expect(freshImp.formatE.startsWith('## Nodes')).toBe(true);
    expect(freshCtx.formatE).not.toContain('STALE-ANALYSIS');

    // Zweiter Tool-Write (liegt in KEINER der beiden Scheiben): graphVersion 2 > Stamp v1 → stale.
    const bump = (await tools.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'MOD-unrelated', type: 'MOD', name: 'Anderswo', description: 'unbeteiligt', attributes: {} } }],
    })) as { success: boolean };
    expect(bump.success).toBe(true);

    const staleCtx = (await tools.graph_context.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    const staleImp = (await tools.graph_impact.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };

    // Genau EINE Kopfzeile, darunter byte-identisch das frische Ergebnis (kein zweiter Umbau).
    const [ctxHead, ...ctxRest] = staleCtx.formatE.split('\n');
    expect(ctxHead).toContain('STALE-ANALYSIS');
    expect(ctxHead).toContain('conops');
    expect(ctxHead.startsWith('//')).toBe(true);
    expect(ctxRest.join('\n')).toBe(freshCtx.formatE);

    const [impHead, ...impRest] = staleImp.formatE.split('\n');
    expect(impHead).toContain('STALE-ANALYSIS');
    expect(impHead.startsWith('//')).toBe(true);
    expect(impRest.join('\n')).toBe(freshImp.formatE);

    // Format-E-parsebar trotz Banner: derselbe Codec liest die Scheibe fehlerfrei zurück.
    const decoded = new GraphCodeCodec().decode(staleCtx.formatE);
    expect(decoded.nodes.map((n) => n.uid)).toContain('REQ-reset');
  });

  it('ohne jeden Stamp: kein Banner (absent ist nicht "hinter dem Repo-State")', async () => {
    const tools = bindToolsToHarness(harness);
    const seeded = (await tools.graph_mutate.handler({ commands: SPEC })) as { success: boolean };
    expect(seeded.success).toBe(true);
    const ctx = (await tools.graph_context.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    expect(ctx.formatE.startsWith('## Nodes')).toBe(true);
    expect(ctx.formatE).not.toContain('STALE-ANALYSIS');
  });
});
