/**
 * TEST-harness-handle (CR-GC-991) — Verhalten der Zugriffe des Harness-Griffs.
 *
 * Der Vertrag SCHEMA-harness-handle prueft nur die Form (jedes Mitglied eine Funktion); den
 * erzeugten Test dazu liefert `graphcode vertragstest`. Was die Zugriffe zurueckgeben, prueft
 * dieser Test an der ECHTEN Klasse (disk-Kuzu, nie :memory:): Repo-Wurzel, Store-Verzeichnis,
 * Scope, Fokus-Schwelle. Zusaetzlich: `createHarness` gibt das Original zurueck, nicht die Kopie
 * von `parse`, und ein halb gebauter Griff wird an der Grenze abgewiesen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { HarnessConfigSchema, type HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { HarnessHandle } from '../src/kernel/harness-handle-contract.js';
import { createHarness } from '../src/surface/create-harness.js';

describe('TEST-harness-handle: Zugriffe des Griffs und Uebergabe des Originals', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-harness-handle-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'hh-ws', systemId: 'hh-sys' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('die echte Klasse erfuellt den Vertrag; ihre Methoden liegen am Prototyp', () => {
    expect(HarnessHandle.safeParse(harness).success).toBe(true);
    expect(Object.keys(harness)).not.toContain('getGraph');
    expect(typeof harness.getGraph).toBe('function');
  });

  it('Repo-Wurzel und Store-Verzeichnis sind nicht leer', () => {
    expect(harness.getRepoRoot()).toBe(tmp);
    expect(harness.getStoreDir().length).toBeGreaterThan(0);
  });

  it('der Scope erfuellt den Scope des Harness-Vertrags', () => {
    expect(HarnessConfigSchema.shape.scope.parse(harness.getScope())).toEqual({ workspaceId: 'hh-ws', systemId: 'hh-sys' });
  });

  it('die Fokus-Schwelle liegt in [0, 1]', () => {
    const t = harness.getFocusThreshold();
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('createHarness liefert eine Instanz der Klasse mit Prototyp, nicht die Kopie von parse', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'graphcode-create-harness-'));
    try {
      const h = await createHarness({ repoRoot: repo, scope: { workspaceId: 'ch-ws', systemId: 'ch-sys' }, consumerType: 'system' } as HarnessConfig);
      try {
        expect(h).toBeInstanceOf(GraphCodeHarness);
      } finally {
        await h.close();
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('ein halb gebauter Griff wird abgewiesen und nennt das fehlende Mitglied als Pfad', () => {
    const { mutate: _weg, ...rest } = Object.fromEntries(Object.getOwnPropertyNames(GraphCodeHarness.prototype).map((k) => [k, () => 1]));
    const r = HarnessHandle.safeParse(rest);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toContain('mutate');
  });
});
