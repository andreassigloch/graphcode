/**
 * TEST-live-event-contract (CR-GC-109) — the LiveUpdateEvent SSE contract lives
 * in @sigloch/contracts/harness, and the graphcode harness emits exactly that
 * shape. Proves REQ-live-event-in-contracts: dashboard/host-bridge can import
 * the SAME Zod schema the harness produces (no fork, analog D1).
 *
 * Two parts: (1) the published schema accepts valid events and rejects malformed
 * ones; (2) a REAL mutation through the harness emits an event that round-trips
 * through LiveUpdateEventSchema — so the emitter and the contract cannot drift.
 *
 * Real disk Kuzu (temp dir, never :memory:). No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { LiveUpdateEventSchema } from '@sigloch/contracts/harness';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/harness.js';
import { registerEmitters, type LiveUpdateEvent } from '../src/emit.js';

describe('TEST-live-event-contract: LiveUpdateEvent schema is the single SSE contract', () => {
  describe('the published schema validates the contract', () => {
    it('accepts a well-formed invalidate event', () => {
      const ev = { type: 'invalidate', domains: ['graph', 'readiness'], ts: new Date().toISOString() };
      const parsed = LiveUpdateEventSchema.parse(ev);
      expect(parsed).toEqual(ev);
    });

    it('rejects an unknown domain', () => {
      const bad = { type: 'invalidate', domains: ['graph', 'bogus'], ts: new Date().toISOString() };
      expect(LiveUpdateEventSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects a wrong event type literal', () => {
      const bad = { type: 'changed', domains: ['graph'], ts: new Date().toISOString() };
      expect(LiveUpdateEventSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects a missing timestamp', () => {
      const bad = { type: 'invalidate', domains: ['graph'] };
      expect(LiveUpdateEventSchema.safeParse(bad).success).toBe(false);
    });
  });

  describe('the harness emits exactly the published contract', () => {
    let tmp: string;
    let harness: GraphCodeHarness;

    function makeConfig(repoRoot: string): HarnessConfig {
      return {
        repoRoot,
        scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
        consumerType: 'system',
        preCommitTimeout: 5000,
      };
    }

    beforeEach(async () => {
      tmp = mkdtempSync(join(tmpdir(), 'graphcode-live-event-contract-'));
      const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
      harness = new GraphCodeHarness(makeConfig(tmp), storage);
      await harness.initialize();
    });

    afterEach(async () => {
      await harness.close();
      rmSync(tmp, { recursive: true, force: true });
    });

    it('a real mutation emits an event that round-trips through LiveUpdateEventSchema', async () => {
      const captured: LiveUpdateEvent[] = [];
      registerEmitters(harness.getHooks(), {
        onEvent: (e) => captured.push(e),
      });

      // A valid mutation (REQ + verifying TEST satisfies R-01).
      const commands: MutateCommand[] = [
        { op: 'add-node', node: { uid: 'REQ-lec-01', type: 'REQ', name: 'Live event contract req', description: '', attributes: {} } },
        { op: 'add-node', node: { uid: 'TEST-lec-01', type: 'TEST', name: 'Live event contract test', description: '', attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'TEST-lec-01', targetId: 'REQ-lec-01', edgeType: 'verify', attributes: {} } },
      ];
      const res = await harness.mutate(commands);
      expect(res.success).toBe(true);

      expect(captured).toHaveLength(1);
      // The emitted event must validate against the PUBLISHED schema, byte-for-byte.
      const parsed = LiveUpdateEventSchema.parse(captured[0]);
      expect(parsed).toEqual(captured[0]);
      expect(parsed.type).toBe('invalidate');
      expect(parsed.domains).toContain('graph');
      expect(parsed.domains).toContain('readiness');
    });
  });
});
