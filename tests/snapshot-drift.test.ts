/**
 * TEST-snapshot-drift (CR-GC-931) — der Host meldet beim Start, wenn der committete Snapshot
 * seit dem letzten Export oder Reseed ein anderer ist als der, aus dem der Store stammt.
 *
 * Verglichen wird ein Fingerabdruck der Datei (SHA-256 des Inhalts) mit dem Stempel, den Export
 * und Reseed unter `.graphcode/snapshot.sha256` ablegen. Kein zweiter Handle, kein Vergleich
 * Knoten fuer Knoten (CR-GC-392). Der Start baut nichts neu auf: `graph_reseed` ist Sache des Nutzers.
 *
 * Echte Dateien, echter Kuzu-Store im Temp-Verzeichnis je Test, nie das .graphcode des Repos.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { setExportPending } from '../src/kernel/export-marker.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const SSOT = join(__dirname, '..', 'docs', 'graph', 'graphcode.graph.json');
const STAMP_REL = '.graphcode/snapshot.sha256';
const NOTICE = 'snapshot is newer than the store';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

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

describe('TEST-snapshot-drift: Start meldet einen neueren Snapshot (CR-GC-931)', () => {
  let tmp: string;
  let kuzuPath: string;
  let snapshot: string;
  let nodes: number;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'gc-drift-'));
    kuzuPath = join(tmp, '.graphcode', 'kuzu');
    snapshot = join(tmp, 'docs', 'graph', 'graphcode.graph.json');
    mkdirSync(dirname(kuzuPath), { recursive: true });
    mkdirSync(dirname(snapshot), { recursive: true });
    copyFileSync(SSOT, snapshot);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function newHarness(): GraphCodeHarness {
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    return new GraphCodeHarness(makeConfig(tmp), storage, undefined, {
      lockDir: dirname(kuzuPath),
      storePath: kuzuPath,
    });
  }

  /** Store aus dem Snapshot gebaut (Reseed stempelt), ordentlich geschlossen. */
  async function seededStore(): Promise<void> {
    const h = newHarness();
    await h.initialize();
    try {
      await h.seedFromJson();
      nodes = h.getGraph().nodes.length;
    } finally {
      await h.close();
    }
    expect(nodes).toBeGreaterThan(0);
  }

  /** Ein Pull, der den Snapshot aendert. */
  function changeSnapshot(): void {
    const j = JSON.parse(readFileSync(snapshot, 'utf8')) as { graphVersion?: number };
    j.graphVersion = (j.graphVersion ?? 0) + 1000;
    writeFileSync(snapshot, JSON.stringify(j, null, 2) + '\n');
  }

  /** Oeffnet den Host-Start, gibt stderr und die Knotenzahl des Stores zurueck. */
  async function start(): Promise<{ err: string; count: number }> {
    const h = newHarness();
    let count = -1;
    const err = await stderrOf(async () => {
      await h.initialize();
      count = h.getGraph().nodes.length;
    });
    await h.close();
    return { err, count };
  }

  it('(a) Snapshot nach dem Export geaendert: Start meldet es, nennt graph_reseed, Store bleibt', async () => {
    await seededStore();
    changeSnapshot();
    const { err, count } = await start();
    expect(err).toContain(NOTICE);
    expect(err).toContain('graph_reseed');
    expect(err).not.toContain('store rebuilt');
    expect(count).toBe(nodes);
    // Die Meldung wiederholt sich, solange der Snapshot abweicht, und aendert nichts.
    const again = await start();
    expect(again.err).toContain(NOTICE);
    expect(again.count).toBe(nodes);
  });

  it('(b) Export steht aus: Start meldet den Konflikt und aendert nichts', async () => {
    await seededStore();
    changeSnapshot();
    setExportPending(tmp);
    const before = readFileSync(snapshot, 'utf8');
    const { err, count } = await start();
    expect(err).toContain('EXPORT_PENDING');
    expect(err).toContain('conflict');
    expect(err).not.toContain(NOTICE);
    expect(count).toBe(nodes);
    expect(readFileSync(snapshot, 'utf8')).toBe(before);
    expect(existsSync(join(tmp, '.graphcode', 'EXPORT_PENDING'))).toBe(true);
  });

  it('(c) Snapshot unveraendert seit dem letzten Export: keine Meldung', async () => {
    await seededStore();
    expect(readFileSync(join(tmp, STAMP_REL), 'utf8').trim()).toMatch(/^[0-9a-f]{64}$/);
    expect((await start()).err).not.toContain('snapshot');
    // Auch mit stehender Marke, solange der Snapshot der gestempelte ist.
    setExportPending(tmp);
    expect((await start()).err).not.toContain('snapshot');
  });

  it('(d) erster Start ohne gespeicherten Fingerabdruck: keine Falschmeldung', async () => {
    await seededStore();
    rmSync(join(tmp, STAMP_REL));
    changeSnapshot();
    const { err, count } = await start();
    expect(err).not.toContain('snapshot');
    expect(err).not.toContain('EXPORT_PENDING');
    expect(count).toBe(nodes);
  });

  it('(e) graph_export stempelt den Snapshot, den es schreibt', async () => {
    await seededStore();
    const h = newHarness();
    await h.initialize();
    try {
      await bindToolsToHarness(h).graph_export.handler({});
    } finally {
      await h.close();
    }
    expect((await start()).err).not.toContain('snapshot');
    changeSnapshot();
    expect((await start()).err).toContain(NOTICE);
  });
});
