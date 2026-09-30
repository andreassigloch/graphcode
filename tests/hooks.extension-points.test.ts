/**
 * TEST-hooks (CR-GC-102, gebunden in CR-GC-719) — die Hook-Erweiterungspunkte des Apply-Gates.
 *
 * Zusagen aus REQ-hook-extension-points / REQ-precommit-timeout / REQ-hook-order-deterministic:
 *   1. registerHook + runPreCommitHooks / runPostApplyHooks / scheduleNightlyBatch sind aufrufbar
 *      und rufen genau die registrierten Handler.
 *   2. Ein pre-commit-Hook blockt eine Mutation — am ECHTEN Gate, der Store bleibt unverändert.
 *   3. preCommitTimeout greift (Default 5000 ms aus dem HarnessConfig-Vertrag); ein hängender Hook
 *      zählt als Block, ein werfender ebenso (fail-closed).
 *   4. Die Ausführungsreihenfolge ist die Registrierungsreihenfolge — bei jedem Lauf dieselbe.
 *
 * Keine Mocks: Kuzu auf Platte in mkdtemp.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { HarnessConfigSchema, type MutateCommand } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { HookSystem } from '../src/kernel/hooks.js';

const validSet: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-h', type: 'REQ', name: 'h', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-h', type: 'TEST', name: 'h', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-h', targetId: 'REQ-h', edgeType: 'verify', attributes: {} } },
];

describe('TEST-hooks: HookSystem als Erweiterungspunkt', () => {
  it('registerHook liefert stabile ids; alle drei Phasen rufen genau ihre Handler', async () => {
    const hooks = new HookSystem({ preCommitTimeout: 1000 });
    const seen: string[] = [];
    expect(hooks.registerHook('pre-commit', () => void seen.push('pre'))).toBe('pre-commit-0');
    expect(hooks.registerHook('post-apply', () => void seen.push('post'), { id: 'mein-post' })).toBe('mein-post');
    expect(hooks.registerHook('nightly', () => void seen.push('nacht'))).toBe('nightly-0');

    expect(await hooks.runPreCommitHooks(validSet)).toEqual([{ hookId: 'pre-commit-0' }]);
    expect(await hooks.runPostApplyHooks({ success: true, appliedCommands: 0, mutations: 0, violations: [] })).toEqual([
      { hookId: 'mein-post' },
    ]);
    expect(await hooks.scheduleNightlyBatch()).toEqual([{ hookId: 'nightly-0' }]);
    expect(seen).toEqual(['pre', 'post', 'nacht']);
  });

  it('die Reihenfolge ist die Registrierungsreihenfolge — über wiederholte Läufe stabil', async () => {
    const hooks = new HookSystem({ preCommitTimeout: 1000 });
    const order: string[] = [];
    for (const id of ['c', 'a', 'b']) {
      // Der früheste Hook ist der langsamste: eine parallele Ausführung würde die Reihenfolge kippen.
      const delay = id === 'c' ? 30 : 0;
      hooks.registerHook('pre-commit', async () => {
        await new Promise((r) => setTimeout(r, delay));
        order.push(id);
      }, { id });
    }
    for (let lauf = 0; lauf < 3; lauf++) {
      const ids = (await hooks.runPreCommitHooks(validSet)).map((r) => r.hookId);
      expect(ids).toEqual(['c', 'a', 'b']);
    }
    expect(order).toEqual(['c', 'a', 'b', 'c', 'a', 'b', 'c', 'a', 'b']);
  });

  it('ein hängender pre-commit-Hook wird nach preCommitTimeout als Block gewertet', async () => {
    const hooks = new HookSystem({ preCommitTimeout: 50 });
    hooks.registerHook('pre-commit', () => new Promise<void>(() => { /* hängt */ }), { id: 'haenger' });
    const t0 = Date.now();
    const [r] = await hooks.runPreCommitHooks(validSet);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r).toMatchObject({ hookId: 'haenger', block: true, message: 'hook haenger timed out after 50ms' });
  });

  it('ein werfender pre-commit-Hook blockt (fail-closed), ein werfender post-apply-Hook nicht', async () => {
    const hooks = new HookSystem({ preCommitTimeout: 1000 });
    hooks.registerHook('pre-commit', () => {
      throw new Error('kaputt');
    }, { id: 'werfer' });
    hooks.registerHook('post-apply', () => {
      throw new Error('auch kaputt');
    }, { id: 'nachher' });
    expect(await hooks.runPreCommitHooks(validSet)).toEqual([{ hookId: 'werfer', block: true, message: 'kaputt' }]);
    const post = await hooks.runPostApplyHooks({ success: true, appliedCommands: 0, mutations: 0, violations: [] });
    expect(post).toEqual([{ hookId: 'nachher', message: 'auch kaputt' }]);
  });

  it('der Default von preCommitTimeout ist 5000 ms (HarnessConfig-Vertrag)', () => {
    const cfg = HarnessConfigSchema.parse({
      repoRoot: '/tmp/x',
      scope: { workspaceId: 'w', systemId: 's' },
      consumerType: 'system',
    });
    expect(cfg.preCommitTimeout).toBe(5000);
  });
});

describe('TEST-hooks: am echten Gate', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-hooks-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(
      { repoRoot: tmp, scope: { workspaceId: 'w', systemId: 'hooks' }, consumerType: 'system', preCommitTimeout: 100 },
      storage,
    );
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ein blockender pre-commit-Hook verhindert die Mutation; post-apply sieht das Block-Verdict', async () => {
    const seen: unknown[] = [];
    harness.getHooks().registerHook('pre-commit', () => ({ hookId: 'veto', block: true, message: 'nein' }));
    harness.getHooks().registerHook('post-apply', (d) => void seen.push(d.phase === 'post-apply' ? d.result.tier : null));

    const result = await harness.mutate(validSet);

    expect(result).toMatchObject({ success: false, tier: 'block', mutations: 0 });
    expect(result.violations[0]).toMatchObject({ ruleId: 'pre-commit', message: 'nein' });
    expect(seen).toEqual(['block']);
    await harness.loadGraph();
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-h')).toBe(false);
  });

  it('ein hängender Hook blockt am Gate nach dem konfigurierten Timeout; ohne Hook landet derselbe Batch', async () => {
    const id = harness.getHooks().registerHook('pre-commit', () => new Promise<void>(() => { /* hängt */ }));
    const blocked = await harness.mutate(validSet);
    expect(blocked.success).toBe(false);
    expect(blocked.violations[0]?.message).toBe(`hook ${id} timed out after 100ms`);

    const frisch = new HookSystem({ preCommitTimeout: 100 });
    expect(await frisch.runPreCommitHooks(validSet)).toEqual([]);
    const ok = await new GraphCodeHarness(
      { repoRoot: join(tmp, 'b'), scope: { workspaceId: 'w', systemId: 'hooks-b' }, consumerType: 'system', preCommitTimeout: 100 },
      new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu-b') }),
    );
    await ok.initialize();
    try {
      expect((await ok.mutate(validSet)).success).toBe(true);
    } finally {
      await ok.close();
    }
  });
});
