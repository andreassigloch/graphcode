/**
 * Live-Feed am Host-Socket (CR-GC-809, CR-GC-885): wer abonniert, bekommt den ganzen Stand und danach die
 * Wirkung jedes Batches als Format-E. Eingespielt ergibt sie dasselbe wie der Export danach, auch bei
 * Kaskaden, Merges und auf den Modellen der Familie.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDelta, formatEToDelta, formatEToExportedGraph, fromOntologyGraph, graphToFormatE, toExportedGraph } from '@sigloch/graph-api-core';
import { readHostSnapshot, subscribeHost, type HostSnapshot } from '@sigloch/graphcode-client';
import type { LiveUpdateEvent, MutateCommand } from '@sigloch/contracts/harness';
import { LiveUpdateEventSchema } from '@sigloch/contracts/harness';
import { createHarness } from '../src/surface/create-harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { startHostSocket, type HostSocket } from '../src/surface/host-shim.js';
import { LiveFeed } from '../src/surface/live-feed.js';
import { MAX_DELTA_CHANGES } from '../src/surface/emit.js';
import type { GraphCodeHarness } from '../src/kernel/harness.js';
import { InMemoryAuditLog } from '@sigloch/graph-api-core';
import { alsFormatE } from './helpers/format-e.js';

const paar = (s: string): MutateCommand[] => [
  { op: 'add-node', node: { uid: `REQ-${s}`, type: 'REQ', name: `Anforderung ${s}`, description: `Beschreibung ${s}`, attributes: { kinds: ['functional'] } } },
  { op: 'add-node', node: { uid: `TEST-${s}`, type: 'TEST', name: `Test ${s}`, description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: `TEST-${s}`, targetId: `REQ-${s}`, edgeType: 'verify' } },
] as MutateCommand[];

describe('Live-Feed', () => {
  let dir: string;
  let harness: GraphCodeHarness;
  let socket: HostSocket;
  let socketPath: string;
  let feed: LiveFeed;
  let mutateTool: (commands: MutateCommand[]) => Promise<unknown>;
  const frames: unknown[] = [];
  let sub: { close: () => void };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'live-feed-'));
    frames.length = 0;
    let publish: (e: LiveUpdateEvent) => void = () => {};
    harness = await createHarness({ repoRoot: dir, scope: { workspaceId: 'live', systemId: 'live' } }, { onUpdateEvent: (e) => publish(e) });
    await harness.initialize();
    const registry = bindToolsToHarness(harness, new InMemoryAuditLog());
    feed = new LiveFeed({ graph: () => harness.getGraph(), version: () => harness.getHooks().currentVersion() });
    publish = (e) => feed.publish(e);
    socketPath = join(dir, 'host.sock');
    socket = await startHostSocket(registry, socketPath, feed);
    mutateTool = async (commands) => {
      const r = await registry.graph_mutate.handler({ formatE: alsFormatE(commands, harness.getGraph()), consumerId: 'test' } as never) as { success: boolean; violations: unknown };
      if (!r.success) throw new Error(JSON.stringify(r.violations).slice(0, 400));
      return r;
    };
    await mutateTool(paar('a'));
    sub = subscribeHost(socketPath, (f) => frames.push(f), () => {});
    await expect.poll(() => frames.length).toBe(1);
  });

  afterEach(async () => {
    sub.close();
    await socket.close();
    await harness.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const events = (): LiveUpdateEvent[] => frames.slice(1) as LiveUpdateEvent[];

  it('das Abo beginnt mit dem ganzen Stand, und ein Lesen endet danach', async () => {
    const first = frames[0] as HostSnapshot;
    expect(first.type).toBe('snapshot');
    expect(formatEToExportedGraph(first.formatE)).toEqual(toExportedGraph(harness.getGraph()));
    expect((await readHostSnapshot(socketPath)).version).toBe(first.version);
  });

  it('jeder Batch trägt Version und Wirkung; eingespielt ergibt das den Export danach', async () => {
    let view = formatEToExportedGraph((frames[0] as HostSnapshot).formatE);
    const start = (frames[0] as HostSnapshot).version;
    await mutateTool(paar('c'));
    await mutateTool([{ op: 'update-node', node: { uid: 'REQ-c', name: 'Neu' } } as MutateCommand]);
    // Kaskade: die verify-Kante steht nicht im Batch und geht trotzdem mit.
    await mutateTool([{ op: 'delete-node', uid: 'TEST-c' }, { op: 'delete-node', uid: 'REQ-c' }] as MutateCommand[]);
    await expect.poll(() => events().length).toBe(3);

    expect(events().map((e) => e.version)).toEqual([start + 1, start + 2, start + 3]);
    for (const event of events()) {
      LiveUpdateEventSchema.parse(event);
      view = applyDelta(view, formatEToDelta(event.formatE as string, (uid) => view.elements.find((e) => e.id === uid)?.type as string));
    }
    expect(view).toEqual(toExportedGraph(harness.getGraph()));
    expect(formatEToDelta(events()[2].formatE as string, () => 'REQ').deleteEdges).toHaveLength(1);
  });

  it('merge-nodes: die Wirkung nennt verschobene Kanten und den gelöschten Knoten', async () => {
    let view = formatEToExportedGraph((frames[0] as HostSnapshot).formatE);
    await mutateTool(paar('c'));
    await mutateTool([{ op: 'merge-nodes', sourceUid: 'TEST-c', targetUid: 'TEST-a' } as MutateCommand]);
    await expect.poll(() => events().length).toBe(2);
    for (const event of events()) view = applyDelta(view, formatEToDelta(event.formatE as string, (uid) => view.elements.find((e) => e.id === uid)?.type as string));
    expect(view).toEqual(toExportedGraph(harness.getGraph()));
  });

  it('ein Batch ohne Änderung bewegt die Version nicht und trägt keine Wirkung', async () => {
    const start = (frames[0] as HostSnapshot).version;
    await mutateTool([{ op: 'update-node', node: { uid: 'REQ-a' } } as MutateCommand]);
    await expect.poll(() => events().length).toBe(1);
    expect(events()[0].version).toBe(start);
    expect(events()[0].formatE).toBeUndefined();
  });

  it('über der Grenze kommt die Version ohne Wirkung: der Empfänger liest den ganzen Graphen', async () => {
    const start = (frames[0] as HostSnapshot).version;
    await mutateTool(Array.from({ length: Math.ceil(MAX_DELTA_CHANGES / 3) + 1 }, (_, i) => paar(`n${i}`)).flat());
    await expect.poll(() => events().length).toBe(1);
    expect(events()[0].version).toBe(start + 1);
    expect(events()[0].formatE).toBeUndefined();
  }, 30000);

  it('ein Reseed erzeugt genau ein Event reset', async () => {
    const snapshot = 'snapshot.graph.json';
    writeFileSync(join(dir, snapshot), JSON.stringify(toExportedGraph(harness.getGraph())));
    await harness.reseed(snapshot);
    await expect.poll(() => events().length).toBe(1);
    expect(events()[0].type).toBe('reset');
    expect(LiveUpdateEventSchema.parse(events()[0]).domains).toContain('graph');
  });
});

describe('Rundreise über die Modelle der Familie', () => {
  for (const file of ['docs/graph/graphcode.graph.json', '../graph-view-edit/docs/graph/graph-view-edit.graph.json']) {
    it(`${file}: Format-E verliert nur, was keinen Leser hat`, () => {
      const graph = fromOntologyGraph(JSON.parse(readFileSync(file, 'utf8')));
      const back = formatEToExportedGraph(graphToFormatE(graph));
      const want = toExportedGraph(graph);
      // concept, deferred: wirkungslos, undeklariert (CR-SM-393). weight an Kanten: kommt als Text, kein Leser im Viewer.
      const bewusst = new Set(['concept', 'deferred', '__name', 'weight']);
      const norm = (e: Record<string, unknown>) => Object.fromEntries(Object.entries(e).filter(([k, v]) => v !== null && !bewusst.has(k)));
      expect(back.elements.map(norm)).toEqual(want.elements.map(norm));
      expect(back.traces.map(norm)).toEqual(want.traces.map(norm));
    });
  }
});
