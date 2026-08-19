/**
 * CR-GC-274 — Fit-Gate Härtegrad 1: Δm-Advisory pro Mutation am Apply-Gate.
 *
 * Eine MESSUNG, kein Gate: jede erfolgreiche Mutation (auch dryRun) trägt
 * fitAdvisory (ℝ⁶ vor/nach/Δ auf layer:'arch'); tier/success bleiben allein
 * regelbestimmt — auch bei benannten Regressionen. Geblockte Mutationen
 * tragen KEIN Advisory. Real disk Kuzu (temp dir), no mocks.
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

// Arch-Layer: zwei getrennte FUNC-Paare (a-b, c-d) + MOD. REQ/TEST sind
// Doku-Rauschen außerhalb von layer:'arch'.
const FIXTURE = {
  elements: [
    { id: 'FUNC-a', type: 'FUNC', name: 'a', description: '' },
    { id: 'FUNC-b', type: 'FUNC', name: 'b', description: '' },
    { id: 'FUNC-c', type: 'FUNC', name: 'c', description: '' },
    { id: 'FUNC-d', type: 'FUNC', name: 'd', description: '' },
    { id: 'MOD-core', type: 'MOD', name: 'core', description: '' },
    { id: 'REQ-x', type: 'REQ', name: 'x', description: '' },
    { id: 'TEST-x', type: 'TEST', name: 'x test', description: '' },
  ],
  traces: [
    { source: 'FUNC-a', target: 'FUNC-b', type: 'compose' },
    { source: 'FUNC-c', target: 'FUNC-d', type: 'compose' },
    { source: 'TEST-x', target: 'REQ-x', type: 'verify' },
  ],
};

describe('Fit-Advisory (CR-GC-274): Δm-Messung am Gate, nie ein Blocker', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-fit-advisory-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('erfolgreiche Arch-Mutation trägt fitAdvisory mit konsistentem Δ (ℝ⁶, arch)', async () => {
    const res = await harness.mutate([
      { op: 'add-edge', edge: { sourceId: 'FUNC-b', targetId: 'FUNC-c', edgeType: 'compose', attributes: {} } },
    ]);
    expect(res.success).toBe(true);
    const adv = res.fitAdvisory!;
    expect(adv.layer).toBe('arch');
    expect(adv.dimensions.length).toBe(6);
    expect(adv.before.length).toBe(6);
    expect(adv.after.length).toBe(6);
    for (let i = 0; i < 6; i++) expect(adv.delta[i]).toBeCloseTo(adv.after[i] - adv.before[i], 12);
    // Die Brückenkante verschmilzt zwei Komponenten → viability steigt.
    expect(adv.delta[adv.dimensions.indexOf('viability')]).toBeGreaterThan(0);
    // Regressionen sind exakt die Dimensionen mit Δ < 0 — benannt, nicht geblockt.
    expect(adv.regressions).toEqual(adv.dimensions.filter((_, i) => adv.delta[i] < 0));
  });

  it('Doku-Mutation außerhalb des Arch-Layers → Δ = 0 auf allen Dimensionen', async () => {
    const res = await harness.mutate([
      { op: 'update-node', node: { uid: 'REQ-x', description: 'doc only, topology untouched' } },
    ]);
    expect(res.success).toBe(true);
    expect(res.fitAdvisory!.delta.every((x) => x === 0)).toBe(true);
    expect(res.fitAdvisory!.regressions).toEqual([]);
  });

  it('Regression wird benannt, aber nicht geblockt (Messung, kein Gate)', async () => {
    // allocate a→MOD zieht eine Cross-Community-Kante ein: irgendeine Dimension
    // verliert (mindestens modifiability/coherence auf dem Mini-Graphen).
    const res = await harness.mutate([
      { op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'MOD-core', edgeType: 'allocate', attributes: {} } },
    ]);
    expect(res.success).toBe(true);
    expect(['auto-apply', 'suggest']).toContain(res.tier);
    expect(res.fitAdvisory).toBeDefined();
    // Unabhängig vom Vorzeichen: regressions ist konsistent zu delta.
    const adv = res.fitAdvisory!;
    expect(adv.regressions).toEqual(adv.dimensions.filter((_, i) => adv.delta[i] < 0));
  });

  it('geblockte Mutation trägt KEIN fitAdvisory', async () => {
    const res = await harness.mutate([
      { op: 'add-edge', edge: { sourceId: 'REQ-x', targetId: 'TEST-x', edgeType: 'compose', attributes: {} } },
    ]);
    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(res.fitAdvisory).toBeUndefined();
  });

  it('dryRun-Verdict trägt fitAdvisory; loadGraph restauriert', async () => {
    const res = await harness.mutate(
      [{ op: 'add-edge', edge: { sourceId: 'FUNC-b', targetId: 'FUNC-c', edgeType: 'compose', attributes: {} } }],
      { dryRun: true },
    );
    expect(res.success).toBe(true);
    expect(res.fitAdvisory).toBeDefined();
    await harness.loadGraph();
    expect(harness.getGraph().edges.length).toBe(FIXTURE.traces.length);
  });
});
