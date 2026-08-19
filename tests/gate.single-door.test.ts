/**
 * T-A1 (CR-GC-341) — "the one door". Claim a) in a single readable proof.
 *
 * Claim a) says the rules make the graph correct. Today that is spread over
 * `harness.gate.test.ts`, `mcp.mutate-violations.test.ts` and
 * `export-graph-guard.test.ts` — each true, none of them the one thing you hand a
 * sceptic. This is that one thing, three assertions in order:
 *
 *   1. a legal mutation LANDS — it survives a reload, attributes intact;
 *   2. the same mutation minus its mandatory edge is BLOCKED — and the store on
 *      disk is byte-identical afterwards, compared over the full deterministic
 *      export rather than a spot check;
 *   3. the WAY AROUND is shut — a direct write to the SSOT is refused by the
 *      PreToolUse hook, exit code and message checked.
 *
 * Point 3 is the actual proof. "Rules make it correct" only holds if there is no
 * second way in; 1 and 2 alone show that ONE door is guarded, which is a weaker
 * claim than the one the articles make.
 *
 * Real disk Kuzu (temp dir), no mocks, no `:memory:`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { exportGraphJson } from '../src/exporter.js';
import { ARCH_FIXTURE, makeSteeringConfig } from './fixtures/steering-graphs.js';

const HOOK = join(__dirname, '..', '.claude', 'hooks', 'deny-graph-write.sh');

describe('T-A1 (CR-GC-341): every write goes through one door, and there is no second one', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-single-door-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(ARCH_FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('1 — a legal mutation lands and survives a reload, attributes intact', async () => {
    const res = await harness.mutate([
      {
        op: 'add-node',
        node: {
          uid: 'REQ-audit-retention',
          type: 'REQ',
          name: 'Audit retention',
          description: 'Every applied batch stays readable in the audit trail for 90 days.',
          attributes: {},
        },
      },
      {
        op: 'add-node',
        node: {
          uid: 'TEST-audit-retention',
          type: 'TEST',
          name: 'Audit retention test',
          description: 'Writes a batch, advances the clock, asserts the entry is still readable.',
          attributes: { testRefs: [{ file: 'tests/gate.single-door.test.ts', case: 'retention', tool: 'vitest', level: 'unit' }] },
        },
      },
      { op: 'add-edge', edge: { sourceId: 'TEST-audit-retention', targetId: 'REQ-audit-retention', edgeType: 'verify', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'UC-review', targetId: 'REQ-audit-retention', edgeType: 'compose', attributes: {} } },
    ]);

    expect(res.success).toBe(true);
    expect(res.tier).not.toBe('block');

    // Persisted, not merely in memory: drop the working copy and read the store.
    await harness.loadGraph();
    const reloaded = harness.getGraph();
    const req = reloaded.nodes.find((n) => n.uid === 'REQ-audit-retention');
    const test = reloaded.nodes.find((n) => n.uid === 'TEST-audit-retention');
    expect(req).toBeDefined();
    // The attribute-borne binding survived the round trip — a store that dropped
    // `attributes` would still pass a node-count check.
    expect(test?.attributes?.testRefs).toEqual([
      { file: 'tests/gate.single-door.test.ts', case: 'retention', tool: 'vitest', level: 'unit' },
    ]);
    expect(
      reloaded.edges.some((e) => e.sourceId === 'TEST-audit-retention' && e.targetId === 'REQ-audit-retention' && e.edgeType === 'verify'),
    ).toBe(true);
  });

  it('2 — the same mutation without its mandatory verify edge is blocked, and the store is unchanged', async () => {
    const before = exportGraphJson(harness.getGraph());

    const res = await harness.mutate([
      {
        op: 'add-node',
        node: {
          uid: 'REQ-unverified',
          type: 'REQ',
          name: 'Unverified requirement',
          description: 'A requirement nobody committed to verify.',
          attributes: {},
        },
      },
      { op: 'add-edge', edge: { sourceId: 'UC-review', targetId: 'REQ-unverified', edgeType: 'compose', attributes: {} } },
    ]);

    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(res.violations.some((v) => v.ruleId === 'R-01')).toBe(true);

    // Nothing landed — compared over the FULL deterministic export, not a spot check.
    await harness.loadGraph();
    expect(exportGraphJson(harness.getGraph())).toBe(before);
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-unverified')).toBe(false);
  });

  it('3 — the way around is shut: a direct write to the SSOT is refused by the hook', () => {
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'docs/graph/graphcode.graph.json', content: '{"elements":[],"traces":[]}' },
    });

    let status = 0;
    let stderr = '';
    try {
      execFileSync('bash', [HOOK], { input: payload, encoding: 'utf8' });
    } catch (err) {
      const e = err as { status: number; stderr: string };
      status = e.status;
      stderr = e.stderr;
    }

    // exit 2 is the PreToolUse "BLOCK" protocol — any other code lets the write through.
    expect(status).toBe(2);
    expect(stderr).toMatch(/BLOCKED \(CR-GC-201\)/);
    expect(stderr).toMatch(/graph_mutate/);
  });

  it('3b — the hook does not block ordinary source files (a guard that blocks everything guards nothing)', () => {
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'src/harness.ts', content: '// ordinary edit' },
    });
    const out = execFileSync('bash', [HOOK], { input: payload, encoding: 'utf8' });
    expect(out).toBe('');
  });
});
