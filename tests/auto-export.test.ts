/**
 * TEST-auto-export (CR-GC-323) — der Export folgt der Mutation.
 *
 * Der interessante Teil sind NICHT die geschriebenen Dateien (das kann graph_export
 * schon), sondern die drei Eigenschaften, ohne die ein Auto-Export schadet:
 *   - er läuft überhaupt, ohne dass jemand graph_export ruft (der Befund, der den CR
 *     ausgelöst hat: GVE lauscht auf docs/graph/*.graph.json und sah nach einer
 *     Agent-Mutation nie eine Änderung),
 *   - er COALESCED: N Mutationen in Folge = EIN Export, nicht N,
 *   - er kippt keine erfolgreiche Mutation, wenn er selbst scheitert.
 * Dazu der atomare Write: ein paralleler Leser darf nie eine halbe Datei sehen.
 *
 * Echtes Disk-Kuzu im tmp-Verzeichnis (nie :memory:), echte Schreibvorgänge, echte
 * Timer (Debounce klein gesetzt). Der Export-Zähler ist ein durchreichender Wrapper um
 * das ECHTE graph_export — gezählt wird, was wirklich exportiert hat.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import { registerAutoExport } from '../src/auto-export.js';
import { writeFileAtomic } from '../src/tools/export.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import type { MCPTool } from '../src/mcp-tools.js';

const DEBOUNCE = 30;
const SYSTEM_ID = 'autoexp';
const GRAPH_JSON = join('docs', 'graph', `${SYSTEM_ID}.graph.json`);

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: SYSTEM_ID },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const fixture = {
  elements: [
    { id: 'SYS-autoexp', type: 'SYS', name: 'Auto Export', description: 'Ein System.' },
    { id: 'REQ-seed', type: 'REQ', name: 'Seed Req', description: 'Das System muss exportieren.' },
    { id: 'TEST-seed', type: 'TEST', name: 'Seed Test', description: 'concept', concept: true },
  ],
  traces: [
    { source: 'SYS-autoexp', target: 'REQ-seed', type: 'compose' },
    { source: 'TEST-seed', target: 'REQ-seed', type: 'verify' },
  ],
};

/** Ein Knoten-Batch, der durchs Gate geht (REQ braucht einen verify-Trace, R-01). */
function addReq(n: number) {
  return {
    commands: [
      { op: 'add-node', node: { uid: `REQ-${n}`, type: 'REQ', name: `Req ${n}`, description: `Das System muss ${n} tun.`, attributes: {} } },
      { op: 'add-node', node: { uid: `TEST-${n}`, type: 'TEST', name: `Test ${n}`, description: 'concept', attributes: { concept: true } } },
      { op: 'add-edge', edge: { sourceId: `TEST-${n}`, targetId: `REQ-${n}`, edgeType: 'verify', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'SYS-autoexp', targetId: `REQ-${n}`, edgeType: 'compose', attributes: {} } },
    ],
    consumerId: 'auto-export-test',
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TEST-auto-export: der Export folgt der Mutation (CR-GC-323)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;
  let exports: number;
  let counted: MCPTool<unknown, unknown>;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-autoexport-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
    registry = bindToolsToHarness(harness);
    exports = 0;
    const real = registry['graph_export'];
    counted = {
      ...real,
      handler: async (input: unknown) => {
        exports += 1;
        return real.handler(input);
      },
    } as MCPTool<unknown, unknown>;
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('exportiert nach einer Mutation, ohne dass jemand graph_export ruft', async () => {
    registerAutoExport(harness, counted, { debounceMs: DEBOUNCE });
    expect(existsSync(join(tmp, GRAPH_JSON))).toBe(false);

    const res = await registry['graph_mutate'].handler(addReq(1));
    expect(res.success).toBe(true);

    await sleep(DEBOUNCE * 4);
    expect(exports).toBe(1);
    const written = JSON.parse(readFileSync(join(tmp, GRAPH_JSON), 'utf8')) as { elements: Array<{ id: string }> };
    expect(written.elements.map((e) => e.id)).toContain('REQ-1');
    // Alle Views mit, nicht nur die JSON.
    expect(existsSync(join(tmp, 'docs', 'views', 'srs.md'))).toBe(true);
  });

  it('coalesced: drei Mutationen in Folge schreiben EINEN Export', async () => {
    registerAutoExport(harness, counted, { debounceMs: DEBOUNCE });

    await registry['graph_mutate'].handler(addReq(1));
    await registry['graph_mutate'].handler(addReq(2));
    await registry['graph_mutate'].handler(addReq(3));

    await sleep(DEBOUNCE * 4);
    expect(exports).toBe(1);
    // …und der eine Export trägt den LETZTEN Stand, nicht den ersten.
    const written = JSON.parse(readFileSync(join(tmp, GRAPH_JSON), 'utf8')) as { elements: Array<{ id: string }> };
    const ids = written.elements.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['REQ-1', 'REQ-2', 'REQ-3']));
  });

  it('single-flight: eine Mutation WÄHREND eines laufenden Exports zieht genau einen Nachlauf', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => { release = r; });
    let started = 0;
    const slow: MCPTool<unknown, unknown> = {
      ...registry['graph_export'],
      handler: async (input: unknown) => {
        started += 1;
        if (started === 1) await gate; // der erste Export hängt, bis wir loslassen
        exports += 1;
        return registry['graph_export'].handler(input);
      },
    } as MCPTool<unknown, unknown>;
    registerAutoExport(harness, slow, { debounceMs: DEBOUNCE });

    await registry['graph_mutate'].handler(addReq(1));
    await sleep(DEBOUNCE * 2); // Export #1 läuft und hängt
    expect(started).toBe(1);
    expect(exports).toBe(0);

    await registry['graph_mutate'].handler(addReq(2));
    await registry['graph_mutate'].handler(addReq(3));
    await sleep(DEBOUNCE * 2);
    expect(started).toBe(1); // kein zweiter Export parallel zum laufenden

    release!();
    await sleep(DEBOUNCE * 4);
    expect(started).toBe(2); // genau EIN Nachlauf für beide Mutationen
    expect(exports).toBe(2);
  });

  it('kein Export ohne echte Änderung: no-op-Batch und geblockter Batch lösen nichts aus', async () => {
    registerAutoExport(harness, counted, { debounceMs: DEBOUNCE });

    // no-op: update-edge auf eine Kante, die es nicht gibt → applied, aber mutations === 0
    // (delete-edge ist idempotent-by-delta und zählt als Mutation, harness.ts:654)
    const noop = await registry['graph_mutate'].handler({
      commands: [{ op: 'update-edge', edge: { sourceId: 'SYS-autoexp', targetId: 'REQ-seed', edgeType: 'refine' }, set: { edgeType: 'compose' } }],
      consumerId: 'auto-export-test',
    });
    expect(noop.mutations).toBe(0);

    // geblockt: ein REQ ohne verify-Trace (R-01)
    const blocked = await registry['graph_mutate'].handler({
      commands: [{ op: 'add-node', node: { uid: 'REQ-lonely', type: 'REQ', name: 'Lonely', description: 'Das System muss allein sein.', attributes: {} } }],
      consumerId: 'auto-export-test',
    });
    expect(blocked.success).toBe(false);

    await sleep(DEBOUNCE * 4);
    expect(exports).toBe(0);
    expect(existsSync(join(tmp, GRAPH_JSON))).toBe(false);
  });

  it('ein fehlgeschlagener Export kippt die erfolgreiche Mutation nicht', async () => {
    const errors: unknown[] = [];
    const failing: MCPTool<unknown, unknown> = {
      ...registry['graph_export'],
      handler: async () => { throw new Error('boom'); },
    } as MCPTool<unknown, unknown>;
    registerAutoExport(harness, failing, { debounceMs: DEBOUNCE, onError: (e) => errors.push(e) });

    const res = await registry['graph_mutate'].handler(addReq(1));
    expect(res.success).toBe(true);

    await sleep(DEBOUNCE * 4);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('boom');
    // Die Mutation liegt trotzdem im Store — der Export ist Projektion, nicht Wahrheit.
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-1')).toBe(true);
  });

  it('writeFileAtomic ersetzt die Datei per rename (nie in-place truncate) und lässt keine Temp-Datei zurück', () => {
    const dir = join(tmp, 'atomic');
    mkdirSync(dir, { recursive: true });
    const target = join(dir, 'x.json');
    writeFileSync(target, 'alt');
    const before = statSync(target).ino;

    writeFileAtomic(target, 'neu');

    expect(readFileSync(target, 'utf8')).toBe('neu');
    // Anderer Inode = die Datei wurde ERSETZT, nicht an Ort und Stelle abgeschnitten:
    // genau das schließt das Fenster, in dem ein Leser eine halbe Datei sieht.
    expect(statSync(target).ino).not.toBe(before);
    expect(readdirSync(dir)).toEqual(['x.json']);
  });
});
