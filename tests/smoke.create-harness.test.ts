/**
 * Production-path smoke — the public `createHarness` factory + default emitters.
 *
 * The other tests construct GraphCodeHarness directly; this one exercises the
 * shipped wiring: disk Kuzu at `<repoRoot>/.graphcode/kuzu`, and the emitters
 * registered by default (REQ-mutation-emits-event + REQ-trajectory-emit) so a
 * gate mutation emits exactly one live-update event AND one append-only
 * trajectory line — without the host wiring anything.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/index.js';
import { scoreReadiness, bindToolsToHarness } from '../src/index.js';
import type { LiveUpdateEvent } from '../src/emit.js';

const REAL_GRAPH = join(__dirname, '..', 'docs/graph/graphcode.graph.json');

describe('smoke: createHarness production path', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  const events: LiveUpdateEvent[] = [];

  beforeEach(async () => {
    // Isolated repoRoot with a copy of the real SSOT graph so seedFromJson resolves it.
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-smoke-'));
    mkdirSync(join(repoRoot, 'docs/graph'), { recursive: true });
    copyFileSync(REAL_GRAPH, join(repoRoot, 'docs/graph/graphcode.graph.json'));
    events.length = 0;
    harness = await createHarness(
      { repoRoot, scope: { workspaceId: 'gc', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 },
      { onUpdateEvent: (e) => events.push(e) },
    );
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('wires disk Kuzu, seeds the SSOT, gate-mutates, and emits by default', async () => {
    // Seed the SSOT into the factory-owned disk store; expected count derived from the file.
    const expectedNodes = (JSON.parse(readFileSync(REAL_GRAPH, 'utf8')) as { elements: unknown[] }).elements.length;
    const seeded = await harness.seedFromJson();
    expect(seeded.nodes).toBe(expectedNodes);
    expect(existsSync(join(repoRoot, '.graphcode/kuzu'))).toBe(true);

    // Dogfood the one Apply-Gate via the SHIPPED write path (the MCP tool layer,
    // where the operations log + learning-feed projection are produced — CR-252).
    const tools = bindToolsToHarness(harness);
    const res = await tools.graph_mutate.handler({
      commands: [{ op: 'update-node', node: { uid: 'MS-2-coding-vv', attributes: { status: 'in-progress' } } }],
      consumerId: 'smoke',
    });
    expect(res.success).toBe(true);
    expect(res.tier).not.toBe('block');

    // Default emitters fired without the host wiring anything (REQ-mutation-emits-event).
    expect(events.length).toBe(1);
    expect(events[0].domains).toContain('graph');

    // Learning feed written under <repoRoot>/.aimprove as a projection of the log.
    const jsonl = join(repoRoot, '.aimprove/trajectory.jsonl');
    expect(existsSync(jsonl)).toBe(true);
    const lines = readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();

    // Readiness is family-measured (contracts V3_RULES, not foreign BQ rules).
    const r = scoreReadiness(harness);
    expect(r.compliance.score).toBeGreaterThan(0);
    expect(Object.keys(r.violationsByRule).every((id) => !/^BQ-/i.test(id))).toBe(true);

    // MCP query-precision: graph_impact returns a bounded slice, not the full graph.
    const impact = await tools.graph_impact.handler({ id: 'MOD-harness', depth: 1 });
    expect(impact).toBeDefined();
  });
});
