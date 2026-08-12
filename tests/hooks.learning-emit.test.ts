/**
 * TEST-learning-emit — REQ-trajectory-emit, now as a PROJECTION (CR-252).
 *
 * The learning feed `trajectory.jsonl` is no longer an independent per-mutation
 * write: it is materialized in the tool layer as a projection of the ONE operations
 * log (CR-207). This test drives real gated writes through `graph_mutate` on disk
 * Kuzu (never :memory:) and pins:
 *   - one feed line per operations-log entry (projection is 1:1 with the log),
 *   - the projected `Trajectory` schema (imported contract, not a local interface),
 *   - applied vs rejected outcomes carry correct violation counts,
 *   - the feed equals the projection of the durable log across a session restart.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR, AUDIT_FILE } from '@sigloch/graph-api-core';
import { TrajectorySchema, type Trajectory } from '@sigloch/learning-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

function verifiedReq(n: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-${n}`, type: 'REQ', name: `Req ${n}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-${n}`, type: 'TEST', name: `Test ${n}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-${n}`, targetId: `REQ-${n}`, edgeType: 'verify', attributes: {} } },
  ];
}

function readTrajectory(repoRoot: string): Trajectory[] {
  const file = join(repoRoot, '.graphcode', 'trajectory.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    // Parse via the imported contract — proves each line satisfies the schema.
    .map((line) => TrajectorySchema.parse(JSON.parse(line)));
}

describe('TEST-learning-emit: trajectory.jsonl is a projection of the operations log (CR-252)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-trajectory-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('projects exactly one feed line per operations-log entry, schema-valid', async () => {
    const tools = bindToolsToHarness(harness);

    await tools.graph_mutate.handler({ commands: verifiedReq('01'), consumerId: 'agent-a' });
    await tools.graph_mutate.handler({ commands: verifiedReq('02'), consumerId: 'agent-a' });

    const lines = readTrajectory(repoRoot);
    // One durable log entry per gated write → one projected feed line.
    const logLines = readFileSync(join(repoRoot, AUDIT_FILE), 'utf8').trim().split('\n');
    expect(logLines).toHaveLength(2);
    expect(lines).toHaveLength(2);

    for (const entry of lines) {
      expect(new Date(entry.ts).getTime()).not.toBeNaN();
      expect(entry.consumerType).toBe('agent');
      expect(entry.operation).toBe('mutate');
      expect(entry.applied).toBe(true);
      expect(entry.outcome).toBe('applied');
      // Applied ⇒ no error-severity violation (warnings are non-blocking, e.g. R-19/R-20).
      expect(entry.violations.error).toBe(0);
    }
    // opCounts is the command-batch size.
    expect(lines[0].opCounts).toBe(3);
    // graphVersion is monotonic across applied batches.
    expect(lines[1].graphVersion).toBe(lines[0].graphVersion + 1);
  });

  it('records a blocked mutation as rejected with violation counts', async () => {
    const tools = bindToolsToHarness(harness);
    // An orphan REQ triggers R-01 error → blocked/rejected.
    await tools.graph_mutate.handler({
      commands: [{ op: 'add-node', node: { uid: 'REQ-orphan', type: 'REQ', name: 'o', description: '', attributes: {} } }],
      consumerId: 'agent-a',
    });

    const lines = readTrajectory(repoRoot);
    expect(lines).toHaveLength(1);
    expect(lines[0].applied).toBe(false);
    expect(lines[0].outcome).toBe('rejected');
    expect(lines[0].violations.error).toBeGreaterThanOrEqual(1);
  });

  it('feed equals the projection of the durable log across a session restart', async () => {
    const t1 = bindToolsToHarness(harness);
    await t1.graph_mutate.handler({ commands: verifiedReq('ao1'), consumerId: 'session-1' });
    expect(readTrajectory(repoRoot)).toHaveLength(1);
    await harness.close();

    // Fresh session over the same store + durable log: the next write re-projects
    // the FULL log, so both entries surface — nothing is lost by the rewrite.
    const harness2 = makeHarness(repoRoot);
    await harness2.initialize();
    const t2 = bindToolsToHarness(harness2);
    await t2.graph_mutate.handler({ commands: verifiedReq('ao2'), consumerId: 'session-2' });

    const lines = readTrajectory(repoRoot);
    expect(lines).toHaveLength(2);
    const logLines = readFileSync(join(repoRoot, AUDIT_FILE), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(logLines.length);

    await harness2.close();
    harness = harness2; // afterEach close() is harmless on an already-closed adapter.
  });
});
