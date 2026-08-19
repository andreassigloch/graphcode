/**
 * TEST-import-invariant (CR-GC-203 item 6) — the REQ-with-test invariant holds on
 * the bulk-import write path, not only the interactive gate. importGraph SURFACES
 * every REQ that lacks a verify-traced TEST (the bypass is never silent — that is
 * how the historical unverified REQs entered), and refuses the import outright
 * when `rejectUnverifiedReqs` is set. The trusted self-seed flags rather than
 * refuses so bootstrap can never deadlock on accrued debt.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

// REQ-good is verify-traced by TEST-good; REQ-bad has no verifying TEST.
// Both fixtures carry their own SYS (CR-GC-302) — the importer would otherwise
// supply the anchor and the exact node counts below would drift by one, which
// would be an off-by-one about the anchor rather than about the REQ-with-test
// invariant these tests exist for.
const DIRTY = {
  elements: [
    { id: 'SYS-inv', type: 'SYS', name: 'inv', description: 'Invarianten-Fixture.' },
    { id: 'REQ-good', type: 'REQ', name: 'Good req', description: '' },
    { id: 'TEST-good', type: 'TEST', name: 'Good test', description: '' },
    { id: 'REQ-bad', type: 'REQ', name: 'Bad req', description: 'no verifying TEST' },
  ],
  traces: [{ source: 'TEST-good', target: 'REQ-good', type: 'verify' }],
};

const CLEAN = {
  elements: [
    { id: 'SYS-inv', type: 'SYS', name: 'inv', description: 'Invarianten-Fixture.' },
    { id: 'REQ-good', type: 'REQ', name: 'Good req', description: '' },
    { id: 'TEST-good', type: 'TEST', name: 'Good test', description: '' },
  ],
  traces: [{ source: 'TEST-good', target: 'REQ-good', type: 'verify' }],
};

describe('TEST-import-invariant: importGraph enforces REQ-with-test on the bulk-import path (CR-GC-203 item 6)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-import-invariant-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('flags an unverified REQ by default (surfaced, not silent) and still imports', async () => {
    const res = await harness.importGraph(DIRTY);
    expect(res.unverifiedReqs).toContain('REQ-bad');
    expect(res.unverifiedReqs).not.toContain('REQ-good');
    // Default is flag, not refuse — the data still imports so existing flows are unbroken.
    expect(harness.getGraph().nodes.length).toBe(DIRTY.elements.length);
  });

  it('refuses the import (throws, store untouched) when rejectUnverifiedReqs is set', async () => {
    await expect(harness.importGraph(DIRTY, { rejectUnverifiedReqs: true })).rejects.toThrow(
      /without a verify-traced TEST/,
    );
    // The refusal happens BEFORE any write — the store stays empty.
    expect(harness.getGraph().nodes.length).toBe(0);
  });

  it('a clean graph (every REQ verify-traced) flags nothing and passes strict mode', async () => {
    const res = await harness.importGraph(CLEAN, { rejectUnverifiedReqs: true });
    expect(res.unverifiedReqs).toEqual([]);
    expect(harness.getGraph().nodes.length).toBe(CLEAN.elements.length);
  });
});
