/**
 * TEST-readonly-bridge / TEST-host-bridge (CR-GC-114) — the read-only HOST + SSE
 * bridge (MOD-host-bridge). Real disk Kuzu in a temp dir (never :memory:), the
 * host on an ephemeral port, real HTTP + real SSE, real gate mutation. No mocks.
 *
 * Proves:
 *   (a) GET /health → 200 with a REAL payload: store reachable + gate functional
 *       + the SE ontology/rules/meta-model versions (REQ-real-health-check).
 *   (b) A real gate mutation surfaces as EXACTLY ONE `invalidate` SSE frame with
 *       a monotonic id and domains incl. graph + readiness (FUNC-serve-sse /
 *       FUNC-broadcast-diff / REQ-versioned-broadcast / REQ-mutation-emits-event).
 *   (c) NO mutation endpoint is reachable: POST /mutate and POST /batch return
 *       404/405 — the read-only guarantee is structural (REQ-readonly-bridge).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ONTOLOGY_VERSION,
  RULES_VERSION,
  META_MODEL_VERSION,
} from '@sigloch/contracts/se';
import { LiveUpdateEventSchema } from '@sigloch/contracts/harness';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { HostBridge } from '../src/viewer/host.js';

/** One parsed SSE frame: id + event name + JSON-decoded data. */
interface SseFrame {
  id: number | undefined;
  event: string | undefined;
  data: unknown;
}

/** Parse a raw SSE buffer (frames separated by a blank line) into frames. */
function parseSse(buffer: string): SseFrame[] {
  const frames: SseFrame[] = [];
  for (const block of buffer.split('\n\n')) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(':')) continue; // comment/heartbeat
    let id: number | undefined;
    let event: string | undefined;
    let dataRaw: string | undefined;
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('id:')) id = Number(line.slice(3).trim());
      else if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataRaw = line.slice(5).trim();
    }
    frames.push({ id, event, data: dataRaw ? JSON.parse(dataRaw) : undefined });
  }
  return frames;
}

describe('TEST-readonly-bridge: host owns Kuzu and serves a read-only SSE surface', () => {
  let tmp: string;
  let bridge: HostBridge;
  let baseUrl: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-host-bridge-'));
    bridge = new HostBridge({ repoRoot: tmp, port: 0 });
    const port = await bridge.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await bridge.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) GET /health returns 200 with a real payload (store/gate ok + versions)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.status).toBe('ok');
    expect(body.store).toBe('reachable');
    expect(body.gate).toBe('functional');
    expect(typeof body.nodeCount).toBe('number');

    const versions = body.versions as Record<string, unknown>;
    expect(versions.ontology).toBe(ONTOLOGY_VERSION);
    expect(versions.rules).toBe(RULES_VERSION);
    expect(versions.metaModel).toBe(META_MODEL_VERSION);
    expect(typeof versions.ruleCount).toBe('number');
    expect(versions.ruleCount as number).toBeGreaterThan(0);
  });

  it('(b) a real gate mutation emits EXACTLY ONE invalidate SSE frame with a monotonic id', async () => {
    // Open a REAL SSE connection via streaming fetch.
    const controller = new AbortController();
    const sseRes = await fetch(`${baseUrl}/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toContain('text/event-stream');
    expect(sseRes.body).toBeTruthy();

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Read until the initial ": connected" comment so the client is registered
    // BEFORE we mutate (otherwise the broadcast would race the subscription).
    while (!buffer.includes('\n\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain(': connected');

    // Drive a REAL mutation through THIS host's gate — its onUpdateEvent feeds
    // the SSE broadcast. A valid REQ + verifying TEST satisfies R-01.
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-hb-01', type: 'REQ', name: 'Host bridge req', description: '', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-hb-01', type: 'TEST', name: 'Host bridge test', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-hb-01', targetId: 'REQ-hb-01', edgeType: 'verify', attributes: {} } },
    ];
    const result = await bridge.getHarness().mutate(commands);
    expect(result.success).toBe(true);

    // Read until exactly one invalidate frame has arrived.
    let frames = parseSse(buffer).filter((f) => f.event === 'invalidate');
    const deadline = Date.now() + 5000;
    while (frames.length < 1 && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      frames = parseSse(buffer).filter((f) => f.event === 'invalidate');
    }

    // EXACTLY ONE invalidate frame.
    expect(frames).toHaveLength(1);
    const frame = frames[0];

    // Monotonic, versioned id (REQ-versioned-broadcast) — first event ⇒ id 1.
    expect(frame.id).toBe(1);

    // The data is a valid LiveUpdateEvent with graph + readiness domains.
    const event = LiveUpdateEventSchema.parse(frame.data);
    expect(event.type).toBe('invalidate');
    expect(event.domains).toContain('graph');
    expect(event.domains).toContain('readiness');

    controller.abort();
    await reader.cancel().catch(() => { /* stream already closing */ });
  });

  it('(c) NO mutation endpoint is reachable: POST /mutate and POST /batch are 404/405', async () => {
    const mutate = await fetch(`${baseUrl}/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ op: 'add-node', node: { uid: 'REQ-x', type: 'REQ', name: 'x' } }]),
    });
    expect([404, 405]).toContain(mutate.status);

    const batch = await fetch(`${baseUrl}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });
    expect([404, 405]).toContain(batch.status);

    // Also reject mutating verbs on the read routes themselves.
    const postHealth = await fetch(`${baseUrl}/health`, { method: 'POST' });
    expect([404, 405]).toContain(postHealth.status);
    const deleteElements = await fetch(`${baseUrl}/elements`, { method: 'DELETE' });
    expect([404, 405]).toContain(deleteElements.status);

    // The store is unchanged — no mutation slipped through.
    const nodes = await bridge.getHarness().listElements({});
    expect(nodes.find((n) => n.uid === 'REQ-x')).toBeUndefined();
  });
});
