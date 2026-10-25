/**
 * TEST-store-recovery (CR-GC-796) — ein beschaedigter Store wird beim Oeffnen aus dem
 * committeten Snapshot neu aufgebaut (REQ-store-recovery, Gegenmassnahme zu
 * REQ-risk-store-unreadable).
 *
 * Bis CR-GC-796 baute GraphStore.open() nur bei Schema-Versatz neu auf. Eine beschaedigte
 * Datei mit passendem Fingerabdruck liess `initialize()` werfen, und der Host startete nicht.
 *
 * Echte Kuzu-Datei auf Platte (Temp-Verzeichnis je Test, nie :memory:). Der Schaden ist der,
 * den die Probe im CR zeigt: ein ueberschriebener Kopf und eine gekuerzte Datei.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, openSync, writeSync, closeSync, statSync, truncateSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { readStoredFingerprint, schemaFingerprint } from '../src/kernel/schema-guard.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SSOT = join(__dirname, '..', 'docs', 'graph', 'graphcode.graph.json');
const SNAPSHOT_REL = 'docs/graph/graphcode.graph.json';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** Was ein Start auf stderr schreibt — die Ausgabe geht weiter durch, sie wird nur mitgelesen. */
async function stderrOf(run: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    lines.push(String(chunk));
    return (write as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
  try {
    await run();
  } finally {
    process.stderr.write = write;
  }
  return lines.join('');
}

/** Ueberschreibt die ersten 4 KiB der Datei — der Kopf ist danach kein Kuzu-Kopf mehr. */
function overwriteHeader(path: string): void {
  const fd = openSync(path, 'r+');
  try {
    writeSync(fd, Buffer.alloc(4096, 0xff), 0, 4096, 0);
  } finally {
    closeSync(fd);
  }
}

/** Kuerzt die Datei auf die Haelfte — ein Abbruch mitten im Schreiben. */
function truncateToHalf(path: string): void {
  truncateSync(path, Math.floor(statSync(path).size / 2));
}

describe('TEST-store-recovery: beschaedigter Store beim Oeffnen (CR-GC-796)', () => {
  let tmp: string;
  let kuzuPath: string;
  let markerDir: string;
  let snapshotNodes: number;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'gc-recovery-'));
    kuzuPath = join(tmp, '.graphcode', 'kuzu');
    markerDir = dirname(kuzuPath);
    mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
    mkdirSync(markerDir, { recursive: true });
    copyFileSync(SSOT, join(tmp, 'docs', 'graph', 'graphcode.graph.json'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function newHarness(): GraphCodeHarness {
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    return new GraphCodeHarness(makeConfig(tmp), storage, undefined, {
      lockDir: markerDir,
      storePath: kuzuPath,
    });
  }

  /** Ein Store aus dem Snapshot, ordentlich geschlossen, Fingerabdruck gestempelt. */
  async function seededStore(): Promise<void> {
    const h = newHarness();
    await h.initialize();
    try {
      await h.seedFromJson();
      snapshotNodes = h.getGraph().nodes.length;
    } finally {
      await h.close();
    }
    expect(snapshotNodes).toBeGreaterThan(0);
    expect(readStoredFingerprint(markerDir)).toBe(schemaFingerprint(SE_DESCRIPTOR));
  }

  for (const [name, damage] of [
    ['ueberschriebener Kopf', overwriteHeader],
    ['gekuerzte Datei', truncateToHalf],
  ] as const) {
    it(`${name}: open() baut aus dem Snapshot neu auf und meldet es`, async () => {
      await seededStore();
      damage(kuzuPath);

      const h = newHarness();
      const err = await stderrOf(() => h.initialize());
      try {
        expect(err).toContain('[graphcode] store: unreadable (');
        expect(err).toContain(`store rebuilt from ${SNAPSHOT_REL}`);
        expect(h.getGraph().nodes.length).toBe(snapshotNodes);
      } finally {
        await h.close();
      }

      // Der neue Store liegt auf Platte: das naechste Oeffnen baut nicht neu auf.
      const again = newHarness();
      const err2 = await stderrOf(() => again.initialize());
      try {
        expect(err2).not.toContain('store rebuilt');
        expect(again.getGraph().nodes.length).toBe(snapshotNodes);
        expect(readStoredFingerprint(markerDir)).toBe(schemaFingerprint(SE_DESCRIPTOR));
      } finally {
        await again.close();
      }
    });
  }

  it('ohne Snapshot bleibt der Lesefehler ein Fehler, und die Sperre ist frei', async () => {
    await seededStore();
    overwriteHeader(kuzuPath);
    rmSync(join(tmp, 'docs', 'graph', 'graphcode.graph.json'));

    const h = newHarness();
    await expect(h.initialize()).rejects.toThrow(/not a valid Kuzu database file/);
    // Nichts weggeworfen, was nicht wieder aufzubauen ist.
    expect(existsSync(kuzuPath)).toBe(true);
    // Die Sperre ist frei: ein zweiter Start scheitert am Store, nicht am Besitz.
    const h2 = newHarness();
    await expect(h2.initialize()).rejects.toThrow(/not a valid Kuzu database file/);
  });
});
