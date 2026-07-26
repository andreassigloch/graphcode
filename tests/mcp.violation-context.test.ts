/**
 * TEST-violation-context (CR-GC-203 item 1) — rules_get_violations / rules_evaluate
 * surface the contracts fix-context (fixHint + context.candidate_targets +
 * existing_traces) instead of flattening it away. An agent resolving an R-01
 * gets the hint AND the candidate TESTs to link FROM THE PAYLOAD — no extra
 * queries to enumerate TEST/FUNC nodes.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks. The unverified REQ is
 * introduced via importGraph (the gate would block it interactively) so the
 * R-01 surfaces for inspection.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

// An R-01: REQ-uncovered has no verify trace; TEST-alpha/TEST-beta are the candidates to link.
const FIXTURE = {
  elements: [
    { id: 'REQ-uncovered', type: 'REQ', name: 'Uncovered requirement', description: 'needs a verifying test' },
    { id: 'TEST-alpha', type: 'TEST', name: 'Alpha test', description: '' },
    { id: 'TEST-beta', type: 'TEST', name: 'Beta test', description: '' },
  ],
  traces: [] as Array<{ source: string; target: string; type: string }>,
};

type Ctx = { candidate_targets?: Array<{ id: string; type: string; name: string }> };

describe('TEST-violation-context: rules tools surface fix_hint + candidate_targets (CR-GC-203 item 1)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-violation-context-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('rules_get_violations returns an R-01 with a fixHint and the candidate TESTs to link', async () => {
    const tools = bindToolsToHarness(harness);
    const { violations } = await tools.rules_get_violations.handler({ severity: 'error' });

    const r01 = violations.find((v) => v.ruleId === 'R-01' && v.elementId === 'REQ-uncovered');
    expect(r01).toBeDefined();
    expect(r01!.fixHint).toBeTruthy();

    const ctx = r01!.context as Ctx;
    expect(ctx?.candidate_targets).toBeDefined();
    const candidateIds = (ctx.candidate_targets ?? []).map((c) => c.id);
    expect(candidateIds).toContain('TEST-alpha');
    expect(candidateIds).toContain('TEST-beta');
  });

  it('rules_evaluate carries the same fix-context (not just rules_get_violations)', async () => {
    const tools = bindToolsToHarness(harness);
    const { violations } = await tools.rules_evaluate.handler({});
    const r01 = violations.find((v) => v.ruleId === 'R-01' && v.elementId === 'REQ-uncovered');
    expect(r01?.fixHint).toBeTruthy();
    expect((r01?.context as Ctx)?.candidate_targets?.length).toBeGreaterThan(0);
  });

  // CR-GC-203 item 3 — candidates are RANKED by token overlap, top hit usually correct.
  it('ranks the most relevant TEST first (REQ-bootstrap -> TEST-bootstrap)', async () => {
    await harness.importGraph({
      elements: [
        { id: 'REQ-bootstrap', type: 'REQ', name: 'Bootstrap requirement', description: 'bootstrap the store from committed JSON' },
        { id: 'TEST-bootstrap', type: 'TEST', name: 'Bootstrap seed test', description: 'verifies bootstrap seeding' },
        { id: 'TEST-codec', type: 'TEST', name: 'Codec roundtrip', description: 'format-e serialize/parse' },
      ],
      traces: [],
    });
    const tools = bindToolsToHarness(harness);
    const { violations } = await tools.rules_get_violations.handler({ severity: 'error' });
    const r01 = violations.find((v) => v.ruleId === 'R-01' && v.elementId === 'REQ-bootstrap');
    const candidates = (r01!.context as Ctx).candidate_targets ?? [];
    // Highest id/name/description token overlap ('bootstrap') ranks first.
    expect(candidates[0]?.id).toBe('TEST-bootstrap');
  });
});
