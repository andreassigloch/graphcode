/**
 * TEST-learning-emit — REQ-trajectory-emit acceptance test.
 *
 * Verifies that post-apply appends one TrajectoryEntry JSONL line per mutation,
 * format is stable, and append-only (second run does not truncate).
 *
 * Real disk Kuzu (temp dir per test, never :memory:). No mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { registerEmitters, type TrajectoryEntry } from '../src/emit.js';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

function readJsonlLines(filePath: string): TrajectoryEntry[] {
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrajectoryEntry);
}

describe('TEST-learning-emit: trajectory JSONL append-only, format stable', () => {
  let tmp: string;
  let outDir: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-trajectory-'));
    outDir = join(tmp, 'aimprove');
    const kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('appends exactly 2 lines after 2 mutations, each parses with stable schema fields', async () => {
    registerEmitters(harness.getHooks(), { outDir });

    const trajFile = join(outDir, 'trajectory.jsonl');

    // Mutation 1 — valid REQ + TEST + verify.
    const mut1: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-tr-01', type: 'REQ', name: 'Traj req 1', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-tr-01', type: 'TEST', name: 'Traj test 1', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-tr-01', targetId: 'REQ-tr-01', edgeType: 'verify', attributes: {} } },
    ];
    const r1 = await harness.mutate(mut1);
    expect(r1.success).toBe(true);

    // Mutation 2 — another valid set.
    const mut2: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-tr-02', type: 'REQ', name: 'Traj req 2', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-tr-02', type: 'TEST', name: 'Traj test 2', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-tr-02', targetId: 'REQ-tr-02', edgeType: 'verify', attributes: {} } },
    ];
    const r2 = await harness.mutate(mut2);
    expect(r2.success).toBe(true);

    // File must exist.
    expect(existsSync(trajFile)).toBe(true);

    const lines = readJsonlLines(trajFile);

    // Exactly 2 lines.
    expect(lines).toHaveLength(2);

    // Each line has all stable schema fields.
    for (const entry of lines) {
      expect(typeof entry.ts).toBe('string');
      expect(new Date(entry.ts).getTime()).not.toBeNaN();
      expect(entry.consumerType).toBe('system');
      expect(typeof entry.opCounts).toBe('number');
      expect(typeof entry.applied).toBe('boolean');
      expect(entry.violations).toBeDefined();
      expect(typeof entry.violations.error).toBe('number');
      expect(typeof entry.violations.warning).toBe('number');
      expect(typeof entry.violations.info).toBe('number');
      // tier may be undefined for some results, but the key is present.
      expect('tier' in entry).toBe(true);
    }

    // Both mutations succeeded — applied:true.
    expect(lines[0].applied).toBe(true);
    expect(lines[1].applied).toBe(true);

    // opCounts matches command count.
    expect(lines[0].opCounts).toBe(3);
    expect(lines[1].opCounts).toBe(3);
  });

  it('append-only: a second harness instance appends without truncating', async () => {
    registerEmitters(harness.getHooks(), { outDir });
    const trajFile = join(outDir, 'trajectory.jsonl');

    // First mutation with the current harness.
    await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-ao-01', type: 'REQ', name: 'AO req 1', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-ao-01', type: 'TEST', name: 'AO test 1', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-ao-01', targetId: 'REQ-ao-01', edgeType: 'verify', attributes: {} } },
    ]);

    const linesAfterFirst = readJsonlLines(trajFile);
    expect(linesAfterFirst).toHaveLength(1);

    // Close and open a fresh harness on the same Kuzu store.
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    registerEmitters(harness2.getHooks(), { outDir });

    // Second mutation with the new harness instance.
    await harness2.mutate([
      { op: 'add-node', node: { uid: 'REQ-ao-02', type: 'REQ', name: 'AO req 2', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-ao-02', type: 'TEST', name: 'AO test 2', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-ao-02', targetId: 'REQ-ao-02', edgeType: 'verify', attributes: {} } },
    ]);

    const linesAfterSecond = readJsonlLines(trajFile);
    // Both lines present (append-only, not truncated).
    expect(linesAfterSecond).toHaveLength(2);

    await harness2.close();
    harness = harness2; // afterEach will call close() — harmless on already-closed adapter.
  });

  it('records blocked mutations (applied:false) with correct violation counts', async () => {
    registerEmitters(harness.getHooks(), { outDir });
    const trajFile = join(outDir, 'trajectory.jsonl');

    // An orphan REQ triggers R-01 error → blocked.
    await harness.mutate([
      { op: 'add-node', node: { uid: 'REQ-blocked-traj', type: 'REQ', name: 'Blocked req', description: '', attributes: {} } },
    ]);

    const lines = readJsonlLines(trajFile);
    expect(lines).toHaveLength(1);
    const entry = lines[0];
    expect(entry.applied).toBe(false);
    expect(entry.tier).toBe('block');
    expect(entry.violations.error).toBeGreaterThanOrEqual(1);
  });
});
