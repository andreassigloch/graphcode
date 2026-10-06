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
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { alsFormatE, kantenAus, knotenAus } from './helpers/format-e.js';

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
    expect(knotenAus(fe.formatE).map((n) => n.uid)).toContain('REQ-reset');
  });

  it('graph_get_edges: default = JSON; format:formatE = parseable Format-E (edges + endpoint nodes)', async () => {
    const tools = bindToolsToHarness(harness);

    const json = (await tools.graph_get_edges.handler({})) as { edges: Array<{ edgeType: string }>; total: number };
    expect(Array.isArray(json.edges)).toBe(true);
    expect(json.edges.length).toBeGreaterThan(0);

    const fe = (await tools.graph_get_edges.handler({ format: 'formatE' })) as { formatE: string; total: number };
    expect(typeof fe.formatE).toBe('string');
    // Endpoint nodes are included → no dangling reference → the codec re-imports it cleanly.
    expect(kantenAus(fe.formatE).length).toBeGreaterThan(0);
    expect(fe.formatE).toContain('REQ-reset');
  });
});

/**
 * CR-GC-748 — eine Analyse hat kein „veraltet" mehr.
 *
 * Bis hierher (CR-GC-363) trug der Format-E-Kopf von graph_context und graph_impact eine
 * `// !! STALE-ANALYSIS`-Zeile, sobald ein AF-Stamp hinter dem Live-graphVersion lag. Die Rechnung
 * dahinter (`computeAnalysisCurrency`, graphcode-client) ist mit CR-SM-395 entfallen: ein Stempel
 * sagt „durchgeführt", nicht „aktuell". graphcode baut sie nicht nach — das Leseergebnis hängt
 * nicht mehr am Abstand zwischen Stempel und Graph-Stand.
 */
describe('CR-GC-748: kein Aktualitäts-Banner im Read-Ergebnis (graph_context + graph_impact)', () => {
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

  it('ein Stempel hinter dem Graph-Stand ändert das Leseergebnis nicht', async () => {
    const tools = bindToolsToHarness(harness);
    // Tool-Layer-Write: zählt den graphVersion-Zähler auf 1 — der Stamp (v1) liegt am Stand.
    const seeded = (await tools.graph_mutate.handler({ formatE: alsFormatE(STAMPED_SPEC, harness)})) as { success: boolean };
    expect(seeded.success).toBe(true);

    const vorherCtx = (await tools.graph_context.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    const vorherImp = (await tools.graph_impact.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    expect(vorherCtx.formatE.startsWith('## Nodes')).toBe(true);
    expect(vorherImp.formatE.startsWith('## Nodes')).toBe(true);

    // Zweiter Tool-Write (liegt in KEINER der beiden Scheiben): graphVersion 2 > Stamp v1.
    const bump = (await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'add-node', node: { uid: 'MOD-unrelated', type: 'MOD', name: 'Anderswo', description: 'unbeteiligt', attributes: {} } }], harness),
    })) as { success: boolean; graphVersion?: number };
    expect(bump.success).toBe(true);

    const nachherCtx = (await tools.graph_context.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    const nachherImp = (await tools.graph_impact.handler({ id: 'REQ-reset', depth: 1 })) as { formatE: string };
    expect(nachherCtx.formatE).toBe(vorherCtx.formatE);
    expect(nachherImp.formatE).toBe(vorherImp.formatE);
    expect(nachherCtx.formatE).not.toContain('STALE-ANALYSIS');
  });
});
