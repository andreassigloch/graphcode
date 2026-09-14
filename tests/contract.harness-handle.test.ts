/**
 * TEST-harness-handle-contract (CR-GC-523, ITEM-2026-064) — SCHEMA-harness-handle.
 *
 * Der Harness-Griff ist die EINE Uebergabe aus `createHarness` an sechs Konsumenten
 * (bindToolsToHarness, createToolContext, serveStdio, executeRun, executeRewind,
 * executeImportCode). Ein Objekt mit Verhalten: der Vertrag prueft die oeffentliche
 * Oberflaeche (jedes Mitglied eine Funktion) und die Datenanteile dahinter
 * (Repo-Wurzel, Store-Verzeichnis, Scope, Fokus-Schwelle) — nicht die privaten Felder
 * der Klasse. Ein Griff mit MEHR Mitgliedern bleibt ein Griff (Liskov); ein Griff mit
 * einem fehlenden oder falsch typisierten Mitglied ist keiner, und die Abweisung
 * nennt das Mitglied als Pfad.
 *
 * Akzeptanz an der ECHTEN Klasse (disk-Kuzu, nie :memory:), Abweisung an Kopien
 * derselben Oberflaeche — die Fixture ist der Griff, nicht ein nachgebautes Objekt.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { HarnessHandle, HARNESS_HANDLE_MEMBERS } from '../src/kernel/harness-handle-contract.js';

/** Alle Mitglieder des Vertrags, an die echte Instanz gebunden — die Oberflaeche als Objekt. */
function surfaceOf(harness: GraphCodeHarness): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of HARNESS_HANDLE_MEMBERS) {
    const member = (harness as unknown as Record<string, unknown>)[key];
    out[key] = typeof member === 'function' ? (member as (...a: unknown[]) => unknown).bind(harness) : member;
  }
  return out;
}

function pathsOf(input: unknown): string[] {
  const r = HarnessHandle.safeParse(input);
  expect(r.success).toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

describe('TEST-harness-handle-contract: SCHEMA-harness-handle ist ein Zod-Vertrag', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-harness-handle-contract-'));
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

  it('akzeptiert die echte Klasse und reicht DIESELBE Instanz weiter (kein Kopie-Objekt)', () => {
    const parsed = HarnessHandle.parse(harness);
    expect(parsed).toBe(harness);
    expect(parsed.getRepoRoot()).toBe(tmp);
  });

  it('akzeptiert die reine Oberflaeche — jedes Mitglied des Vertrags ist im Griff vorhanden', () => {
    const r = HarnessHandle.safeParse(surfaceOf(harness));
    expect(r.success, JSON.stringify(r.success ? [] : r.error.issues)).toBe(true);
  });

  it('ein zusaetzliches Mitglied ist KEINE Abweichung — ein erweiterter Griff bleibt ein Griff', () => {
    expect(HarnessHandle.safeParse({ ...surfaceOf(harness), extraVerb: () => 1 }).success).toBe(true);
  });

  it('weist ein fehlendes Mitglied ab und nennt es als Pfad', () => {
    for (const key of ['getGraph', 'mutate', 'getRepoRoot', 'close']) {
      const { [key]: _dropped, ...without } = surfaceOf(harness);
      expect(pathsOf(without)).toEqual([key]);
    }
  });

  it('weist ein falsch typisiertes Mitglied ab und nennt es als Pfad', () => {
    expect(pathsOf({ ...surfaceOf(harness), mutate: 'nicht aufrufbar' })).toEqual(['mutate']);
    expect(pathsOf({ ...surfaceOf(harness), getGraph: null })).toEqual(['getGraph']);
  });

  it('prueft die Datenanteile hinter den Zugriffen: leere Repo-Wurzel, leerer Store, kaputter Scope', () => {
    expect(pathsOf({ ...surfaceOf(harness), getRepoRoot: () => '' })).toEqual(['getRepoRoot']);
    expect(pathsOf({ ...surfaceOf(harness), getStoreDir: () => 42 })).toEqual(['getStoreDir']);
    expect(pathsOf({ ...surfaceOf(harness), getScope: () => ({ workspaceId: 'x' }) })).toEqual(['getScope.systemId']);
    expect(pathsOf({ ...surfaceOf(harness), getFocusThreshold: () => 'hoch' })).toEqual(['getFocusThreshold']);
  });

  it('weist Nicht-Objekte ab', () => {
    expect(HarnessHandle.safeParse(null).success).toBe(false);
    expect(HarnessHandle.safeParse('harness').success).toBe(false);
    expect(HarnessHandle.safeParse(undefined).success).toBe(false);
  });
});
