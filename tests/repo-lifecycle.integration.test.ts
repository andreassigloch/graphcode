/**
 * TEST-repo-lifecycle (CR-GC-415) — der Integrationstest der Wirkkette
 * `FCHAIN-repo-lifecycle`: Einrichten, Sitzung führen, Sitzung beenden.
 *
 * Warum es diesen Test gibt: `FCHAIN-repo-lifecycle` war die einzige Kette des
 * Selbstmodells ohne satisfy-REQ und damit ohne Integrationstest. Genau an dieser
 * Kette hängen aber die teuersten realen Fehler des Projekts — elf Zombie-Hosts mit
 * gehaltenem Store-Lock (CR-GC-370) und ein Viewer, der mit dem ersten Fenster
 * verschwand (CR-GC-404). Beide Male war die einzelne Ressource getestet und ihr
 * ZUSAMMENSPIEL nicht.
 *
 * Geprüft wird deshalb die Reihenfolge, nicht die Einzelteile:
 *   (a) Aufbau: Lock genommen, Sitzung eingetragen — ein zweiter Owner scheitert laut.
 *   (b) Abbau über den EINEN Pfad (`SessionLifecycle.shutdown`), rückwärts, Lock zuletzt.
 *   (c) Danach bleibt nichts zurück: kein Sitzungseintrag, kein gehaltener Lock.
 *
 * Echter Disk-Kuzu im Temp-Verzeichnis (nie `:memory:`), echte Dateien, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/harness.js';
import { StoreOwnershipError } from '../src/store-lock.js';
import { SessionLifecycle } from '../src/session-lifecycle.js';
import { registerSession, unregisterSession, liveSessions } from '../src/gve-sessions.js';

const config = (repoRoot: string): HarnessConfig => ({
  repoRoot,
  scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
  consumerType: 'system',
  preCommitTimeout: 5000,
});

describe('TEST-repo-lifecycle: eine beendete Sitzung hinterlässt nichts', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-repo-lifecycle-'));
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const openHarness = (): GraphCodeHarness =>
    new GraphCodeHarness(
      config(repo),
      new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repo, '.graphcode', 'kuzu') }),
    );

  it('(a) der Aufbau nimmt den Lock und trägt die Sitzung ein — ein zweiter Owner scheitert laut', async () => {
    const harness = openHarness();
    await harness.initialize();
    registerSession(repo, process.pid);

    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(true);
    expect(liveSessions(repo)).toContain(process.pid);

    // Genau ein Schreiber pro Store (REQ-single-kuzu-owner): der zweite wird laut
    // abgewiesen, nicht still danebengesetzt.
    await expect(openHarness().initialize()).rejects.toBeInstanceOf(StoreOwnershipError);

    await harness.close();
    unregisterSession(repo, process.pid);
  });

  it('(b) der Abbau läuft rückwärts über EINEN Pfad — der Store-Lock zuletzt', async () => {
    const harness = openHarness();
    await harness.initialize();
    registerSession(repo, process.pid);

    const order: string[] = [];
    const lifecycle = new SessionLifecycle();
    // Registrierung in AUFBAU-Reihenfolge, wie in `runMcpServer`.
    lifecycle.add({
      name: 'store lock',
      close: async () => {
        order.push('store lock');
        await harness.close();
      },
    });
    lifecycle.add({
      name: 'session entry',
      close: () => {
        order.push('session entry');
        unregisterSession(repo, process.pid);
      },
    });

    await lifecycle.shutdown('test');
    // Genau einmal: SIGTERM nach stdin-EOF ist der reale Doppelauslöser — ein zweiter
    // Durchlauf würde `harness.close()` auf einem geschlossenen Store fahren.
    await lifecycle.shutdown('test again');

    expect(order).toEqual(['session entry', 'store lock']);
  });

  it('(c) nach dem Sitzungsende ist der Lock frei und kein Sitzungseintrag übrig', async () => {
    const first = openHarness();
    await first.initialize();
    registerSession(repo, process.pid);

    const lifecycle = new SessionLifecycle();
    lifecycle.add({ name: 'store lock', close: () => first.close() });
    lifecycle.add({ name: 'session entry', close: () => unregisterSession(repo, process.pid) });
    await lifecycle.shutdown('test');

    expect(liveSessions(repo)).toEqual([]);
    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(false);

    // Der Beweis, dass wirklich nichts zurückblieb: die nächste Sitzung kommt hoch.
    const second = openHarness();
    await expect(second.initialize()).resolves.toBeUndefined();
    await second.close();
  });
});
