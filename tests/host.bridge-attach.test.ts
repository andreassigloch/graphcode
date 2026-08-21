/**
 * TEST-bridge-follows-lock (CR-GC-237) — live viewer and MCP sessions coexist:
 * the elected host serves the read-only HTTP bridge over ITS harness (ATTACH
 * mode) instead of a second process fighting for the store lock.
 *
 * Real disk Kuzu in a temp dir (never :memory:), real HTTP + real SSE, real
 * gate mutation. No mocks.
 *
 * Proves:
 *   (a) OWN mode collides: while a harness holds the store, a second OWN-mode
 *       HostBridge dies with StoreOwnershipError — the pre-237 failure.
 *   (b) ATTACH mode coexists: a bridge over the SAME harness serves /health 200
 *       and one SSE invalidate frame per gate mutation through the MCP host's
 *       onUpdateEvent sink; stop() leaves the harness alive (the elected host
 *       owns its lifecycle).
 *   (c) maybeStartBridge honours GRAPHCODE_HOST_PORT: unset → no bridge
 *       (behavior as before); invalid → no bridge; busy port → warn-and-null,
 *       the gate survives (a bind failure never kills stdio).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MutateCommand, LiveUpdateEvent } from '@sigloch/contracts/harness';
import { createHarness, type GraphCodeHarness } from '../src/index.js';
import { HostBridge } from '../src/viewer/host.js';
import { maybeStartBridge } from '../src/mcp-server.js';
import { StoreOwnershipError } from '../src/store-lock.js';

describe('TEST-bridge-follows-lock: elected host serves the read-only bridge (CR-GC-237)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let bridge: HostBridge | null;
  const savedPort = process.env.GRAPHCODE_HOST_PORT;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-bridge-lock-'));
    // The elected MCP host: harness whose sink feeds the (later-attached)
    // bridge — the exact wiring electAndBoot uses.
    harness = await createHarness(
      { repoRoot: tmp, scope: { workspaceId: 'w', systemId: 's' } },
      { onUpdateEvent: (event: LiveUpdateEvent) => bridge?.broadcast(event) },
    );
    await harness.initialize();
    bridge = null;
  });

  afterEach(async () => {
    if (savedPort === undefined) delete process.env.GRAPHCODE_HOST_PORT;
    else process.env.GRAPHCODE_HOST_PORT = savedPort;
    await bridge?.stop();
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) OWN mode still collides with a live owner — the failure ATTACH fixes', async () => {
    const own = new HostBridge({ repoRoot: tmp, port: 0 });
    await expect(own.start()).rejects.toThrow(StoreOwnershipError);
  });

  it('(b) ATTACH mode: /health + one SSE invalidate per mutation over the SAME harness; stop() keeps the harness alive', async () => {
    bridge = new HostBridge({ repoRoot: tmp, harness, port: 0 });
    const port = await bridge.start();
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const body = (await health.json()) as Record<string, unknown>;
    expect(body.store).toBe('reachable');
    expect(body.gate).toBe('functional');

    // Subscribe BEFORE mutating so the broadcast cannot race the registration.
    const controller = new AbortController();
    const sse = await fetch(`${baseUrl}/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    const reader = sse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!buffer.includes('\n\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain(': connected');

    // A real gate mutation through the ELECTED HOST's harness (not the bridge's
    // own) — its onUpdateEvent sink must surface on THIS bridge's SSE stream.
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-bfl-01', type: 'REQ', name: 'Bridge follows lock', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-bfl-01', type: 'TEST', name: 'Bridge follows lock test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-bfl-01', targetId: 'REQ-bfl-01', edgeType: 'verify', attributes: {} } },
    ];
    const result = await harness.mutate(commands);
    expect(result.success).toBe(true);

    const deadline = Date.now() + 5000;
    while (!buffer.includes('event: invalidate') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain('event: invalidate');
    controller.abort();
    await reader.cancel().catch(() => { /* stream already closing */ });

    // stop() releases ONLY the HTTP surface — the elected host keeps its store.
    await bridge.stop();
    bridge = null;
    const nodes = await harness.listElements({});
    expect(nodes.find((n) => n.uid === 'REQ-bfl-01')).toBeDefined();
  });

  it('(c) maybeStartBridge: unset → null, invalid → null, busy port → warn-and-null (gate survives)', async () => {
    delete process.env.GRAPHCODE_HOST_PORT;
    expect(await maybeStartBridge(tmp, harness)).toBeNull();

    process.env.GRAPHCODE_HOST_PORT = 'not-a-port';
    expect(await maybeStartBridge(tmp, harness)).toBeNull();

    // Occupy a port, then point the env at it: the bridge must yield, not throw.
    bridge = new HostBridge({ repoRoot: tmp, harness, port: 0 });
    const busy = await bridge.start();
    process.env.GRAPHCODE_HOST_PORT = String(busy);
    expect(await maybeStartBridge(tmp, harness)).toBeNull();

    // The happy path on a fresh port — the exact election-time call.
    process.env.GRAPHCODE_HOST_PORT = '0';
    expect(await maybeStartBridge(tmp, harness)).toBeNull(); // 0 is not a real opt-in

    await bridge.stop();
    process.env.GRAPHCODE_HOST_PORT = String(busy); // now free again
    const started = await maybeStartBridge(tmp, harness);
    expect(started).not.toBeNull();
    const health = await fetch(`http://127.0.0.1:${busy}/health`);
    expect(health.status).toBe(200);
    await started!.stop();
    bridge = null;
  });
});
