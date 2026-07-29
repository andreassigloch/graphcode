/**
 * CR-GC-273 — graph_suggest: dünnes MCP-Binding auf @sigloch/se-optimizer.
 *
 * Fund-Ebene (Violation + Richtung + Δm) für jede feuernde Operator-Regel;
 * ein konkreter Edit NUR aus rule-spezifischen Fix-Templates, jeder mit
 * dryRun-3-Tier-Verdict durchs echte Gate. Read-only: der Graph ist nach dem
 * Aufruf byte-identisch. Real disk Kuzu (temp dir), no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { GraphSuggestResult } from '../src/tools/suggest.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

// CR-1 nennt FUNC-parse im Text → CR-R01-Template kann den Edit herleiten.
// REQ-uncovered ohne TEST → R-01 feuert OHNE Template (Fund-only).
const FIXTURE = {
  elements: [
    { id: 'CR-1', type: 'CR', name: 'parser fix', description: 'betrifft FUNC-parse und nichts sonst' },
    { id: 'FUNC-parse', type: 'FUNC', name: 'parse', description: 'parses input' },
    { id: 'FUNC-other', type: 'FUNC', name: 'other', description: 'unrelated' },
    { id: 'REQ-uncovered', type: 'REQ', name: 'Uncovered requirement', description: 'needs a verifying test' },
  ],
  traces: [] as Array<{ source: string; target: string; type: string }>,
};

describe('graph_suggest (CR-GC-273): Fund + Richtung + Δm, Template-Edit mit dryRun-Verdict', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-suggest-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('liefert Fund-Ebene für feuernde Operator-Regeln, score-absteigend', async () => {
    const res = (await tools.graph_suggest.handler({ target: { coherence: 1 } })) as GraphSuggestResult;
    expect(res.target.length).toBe(6);
    expect(res.suggestions.length).toBeGreaterThan(0);
    for (let i = 1; i < res.suggestions.length; i++) {
      expect(res.suggestions[i - 1].score).toBeGreaterThanOrEqual(res.suggestions[i].score);
    }
    for (const s of res.suggestions) {
      expect(s.elementId.length).toBeGreaterThan(0);
      expect(s.message.length).toBeGreaterThan(0);
      expect(s.delta.length).toBe(6);
    }
  });

  it('CR-R01-Template-Edit kommt mit dryRun-Gate-Verdict; Fund-only ohne verdict', async () => {
    const res = (await tools.graph_suggest.handler({ target: { coherence: 1 }, k: 20, layer: 'all' })) as GraphSuggestResult;

    const crSuggestion = res.suggestions.find((s) => s.ruleId === 'CR-R01');
    expect(crSuggestion?.edit).toMatchObject({ source: 'CR-1', target: 'FUNC-parse', type: 'relation' });
    expect(crSuggestion?.verdict).toBeDefined();
    expect(['auto-apply', 'suggest', 'block']).toContain(crSuggestion!.verdict!.tier);
    expect(crSuggestion!.verdict!.success).toBe(true);

    const r01 = res.suggestions.find((s) => s.ruleId === 'R-01');
    expect(r01).toBeDefined();
    expect(r01!.edit).toBeUndefined();
    expect(r01!.verdict).toBeUndefined();
  });

  it('ist read-only: Graph nach dem Aufruf unverändert (dryRun restauriert)', async () => {
    const before = harness.getGraph();
    const edgesBefore = before.edges.length;
    await tools.graph_suggest.handler({ target: { scalability: 1 }, k: 20 });
    const after = harness.getGraph();
    expect(after.edges.length).toBe(edgesBefore);
    expect(after.nodes.length).toBe(before.nodes.length);
  });

  it('ist deterministisch', async () => {
    const a = await tools.graph_suggest.handler({ target: { viability: 1 } });
    const b = await tools.graph_suggest.handler({ target: { viability: 1 } });
    expect(a).toEqual(b);
  });
});
