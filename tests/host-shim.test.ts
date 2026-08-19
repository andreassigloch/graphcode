/**
 * TEST-host-shim (CR-GC-235) — ONE write channel: host-owned store, sessions as
 * clients. The two-process topology tested at the SOCKET level in-process: a real
 * host (harness + registry + Unix socket on a real disk Kuzu store) and a real
 * proxy registry (`buildProxyRegistry` — what the election loser serves on stdio),
 * exchanging real newline-JSON over a real socket. Only the stdio wire is absent.
 *
 * The O2 refusal for DIRECT second harness instances is unchanged and stays
 * covered by tests/store-lock.test.ts — the election lives ABOVE the harness.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { startHostSocket, buildProxyRegistry, HostGoneError, HOST_SOCK_BASENAME, type HostSocket } from '../src/host-shim.js';
import type { HarnessConfig, MutateCommand, MutateResult } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'shim-ws', systemId: 'shim-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-shim-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-shim-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-shim-${suffix}`, targetId: `REQ-shim-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

type WriteResult = MutateResult & { graphVersion: number };

describe('TEST-host-shim (CR-GC-235): host election + thin socket proxy', () => {
  let tmp: string;
  let host: GraphCodeHarness | null;
  let promoted: GraphCodeHarness | null;
  let hostTools: MCPToolRegistry;
  let hostSock: HostSocket | null;
  let socketPath: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'gc-shim-'));
    host = makeHarness(tmp);
    promoted = null;
    await host.initialize(); // the winner of the election
    hostTools = bindToolsToHarness(host);
    socketPath = join(tmp, '.graphcode', HOST_SOCK_BASENAME);
    hostSock = await startHostSocket(hostTools, socketPath);
  });

  afterEach(async () => {
    await hostSock?.close();
    await host?.close();
    await promoted?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('both processes are functional: identical surface; a client write is visible in a host read and vice versa (ONE model)', async () => {
    const proxy = buildProxyRegistry({ socketPath });

    // Same tool surface — names AND count, taken from the same bind (no drift possible).
    expect(Object.keys(proxy).sort()).toEqual(Object.keys(hostTools).sort());

    // Client 2 (proxy) mutates → the write goes through the host's ONE gate…
    const viaProxy = (await proxy.graph_mutate.handler({
      commands: validSet('p'),
      consumerId: 'client-2',
      baseVersion: 0,
    })) as WriteResult;
    expect(viaProxy.success).toBe(true);
    expect(viaProxy.graphVersion).toBe(1);

    // …and is visible in client 1's (the host session's) next read: one model.
    const hostRead = (await hostTools.graph_get_node.handler({ uid: 'REQ-shim-p' })) as {
      node: { uid: string } | null;
      graphVersion: number;
    };
    expect(hostRead.node?.uid).toBe('REQ-shim-p');
    expect(hostRead.graphVersion).toBe(1);

    // Host session writes → the proxy's read sees it (incl. the OCC version).
    await hostTools.graph_mutate.handler({ commands: validSet('h'), consumerId: 'client-1', baseVersion: 1 });
    const proxyRead = (await proxy.graph_get_node.handler({ uid: 'REQ-shim-h' })) as {
      node: { uid: string } | null;
      graphVersion: number;
    };
    expect(proxyRead.node?.uid).toBe('REQ-shim-h');
    expect(proxyRead.graphVersion).toBe(2);
  });

  it('gate semantics over the shim are IDENTICAL to direct (CR-124 symmetry analog)', async () => {
    const proxy = buildProxyRegistry({ socketPath });
    const orphan: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-shim-orphan', type: 'REQ', name: 'o', description: '', attributes: {} } },
    ];

    const direct = (await hostTools.graph_mutate.handler({ commands: orphan, consumerId: 'direct' })) as WriteResult;
    const shimmed = (await proxy.graph_mutate.handler({ commands: orphan, consumerId: 'shimmed' })) as WriteResult;

    // Identical BLOCK: success/tier/rule — and the OCC rejection works over the shim too.
    expect(direct.success).toBe(false);
    expect(shimmed.success).toBe(direct.success);
    expect(shimmed.tier).toBe(direct.tier);
    expect(shimmed.violations.map((v) => v.ruleId).sort()).toEqual(direct.violations.map((v) => v.ruleId).sort());

    await proxy.graph_mutate.handler({ commands: validSet('x'), consumerId: 'shimmed', baseVersion: 0 });
    const stale = (await proxy.graph_mutate.handler({
      commands: validSet('y'),
      consumerId: 'shimmed',
      baseVersion: 0,
    })) as WriteResult & { staleDelta?: { entries: unknown[] } };
    expect(stale.success).toBe(false);
    expect(stale.staleDelta?.entries).toHaveLength(1);

    // A tool ERROR crosses the shim as an error, not a silent null.
    await expect(proxy.graph_realize.handler({ funcUid: 'FN-missing', file: 'x', symbol: 'x' })).rejects.toThrow(
      /unknown funcUid/,
    );
  });

  it('host death → the proxy re-elects ONCE (stale-lock reclaim) and continues as host; no dead state', async () => {
    const proxy = buildProxyRegistry({
      socketPath,
      promote: async () => {
        promoted = makeHarness(tmp);
        await promoted.initialize(); // wins the election: the dead host's lock was released/reclaimable
        return bindToolsToHarness(promoted);
      },
    });

    // Warm write over the live host, then KILL the host (socket + lock gone).
    await proxy.graph_mutate.handler({ commands: validSet('pre'), consumerId: 'client-2', baseVersion: 0 });
    await hostSock!.close();
    await host!.close();
    hostSock = null;
    host = null;

    // Next call: reconnect fails → ONE re-election → served locally as the new host.
    const after = (await proxy.graph_mutate.handler({
      commands: validSet('post'),
      consumerId: 'client-2',
      baseVersion: 1,
    })) as WriteResult;
    expect(after.success).toBe(true);
    expect(after.graphVersion).toBe(2); // durable log carried the version across the failover

    const read = (await proxy.graph_get_node.handler({ uid: 'REQ-shim-post' })) as { node: { uid: string } | null };
    expect(read.node?.uid).toBe('REQ-shim-post');
    expect(existsSync(join(tmp, '.graphcode', 'owner.lock'))).toBe(true); // the promoted proxy owns the store now
  });

  it('without a promote hook, a dead socket is a CLEAR HostGoneError (never a hang or silent null)', async () => {
    const proxy = buildProxyRegistry({ socketPath });
    await hostSock!.close();
    hostSock = null;

    await expect(proxy.graph_elements.handler({ limit: 1, format: 'json' })).rejects.toThrow(HostGoneError);
  });
});
