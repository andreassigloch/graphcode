/**
 * host-shim.ts — ONE write channel per store: host-owned gate + thin socket proxy
 * (CR-GC-235, Phase A).
 *
 * Topology: every `graphcode mcp` start runs the singleton ELECTION via the O2
 * store lock (CR-GC-218 — the loser no longer dies, it degrades):
 *   - WINNER = host : owns store + gate, serves its own session via MCP-stdio AND
 *     this local Unix socket (`.graphcode/host.sock`) for later sessions.
 *   - LOSER  = client: a thin stdio→socket proxy — the SAME tool surface, every
 *     call forwarded to the host, every write through the ONE gate (O3 + OCC).
 *
 * Transport lock held in letter + spirit: agents still speak MCP-stdio; the
 * socket is an internal shim hop (newline-delimited JSON, one request per
 * connection), NOT a second API surface — no HTTP, no new outward protocol.
 *
 * Host death: the next tool call reconnects once; if the socket stays dead the
 * proxy attempts ONE re-election (`promote` — the CR-218 stale-lock reclaim makes
 * the dead host's lock winnable) and continues as host; otherwise it fails with a
 * clear error. A fresh `graphcode mcp` start after a host kill wins the election
 * the same way — no dead state.
 *
 * @author andreas@siglochconsulting
 */
import { createServer, type Server, type Socket } from 'node:net';
import { beginProxiedCall, endProxiedCall } from './tool-context.js';
import { rmSync } from 'node:fs';
import type { AuditLog } from '@sigloch/graph-api-core';
import {
  HOST_SOCK_BASENAME,
  callHost,
  type ShimRequest,
  type ShimResponse,
} from '@sigloch/graphcode-client';
import type { GraphCodeHarness } from './harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from './mcp-tools.js';

// The CLIENT half (socket name, wire types, `callHost`) lives in
// @sigloch/graphcode-client (CR-GC-264) so a consumer that only forwards tool
// calls does not install kuzu-wasm + the MCP SDK. Re-exported here so every
// existing `from './host-shim.js'` import keeps resolving — one definition.
export { HOST_SOCK_BASENAME, callHost };
export type { ShimRequest, ShimResponse };

/** A running host-side socket endpoint. */
export interface HostSocket {
  socketPath: string;
  close(): Promise<void>;
}

/**
 * Serve `registry` on a local Unix socket. Only the elected host (the lock
 * owner) calls this, so a leftover socket FILE from a crashed host is safely
 * removed before listen. Dispatch re-parses input against the tool's own Zod
 * schema — the proxy hop adds NO semantics (gate symmetry, CR-124 analog).
 */
export function startHostSocket(registry: MCPToolRegistry, socketPath: string): Promise<HostSocket> {
  rmSync(socketPath, { force: true }); // stale file from a killed host; we hold the lock
  const sockets = new Set<Socket>();

  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.trim()) void handleLine(line, socket);
      }
    });
    socket.on('error', () => socket.destroy()); // a dying client never kills the host
  });

  async function handleLine(line: string, socket: Socket): Promise<void> {
    let response: ShimResponse;
    let id = -1;
    try {
      const req = JSON.parse(line) as ShimRequest;
      id = req.id;
      const tool = registry[req.tool];
      if (!tool) throw new Error(`unknown tool '${req.tool}'`);
      // Serving another session (CR-GC-357): while this is in flight, no write in this
      // process may stamp OUR relayed prompt onto it — see beginProxiedCall.
      beginProxiedCall();
      try {
        const result = await tool.handler(tool.inputSchema.parse(req.input ?? {}));
        response = { id, ok: true, result };
      } finally {
        endProxiedCall();
      }
    } catch (err) {
      response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (!socket.destroyed) socket.write(JSON.stringify(response) + '\n');
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      resolve({
        socketPath,
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => {
              rmSync(socketPath, { force: true });
              done();
            });
          }),
      });
    });
  });
}

/** Thrown when the host socket is gone for good (after the reconnect attempt). */
export class HostGoneError extends Error {
  constructor(socketPath: string, cause: string) {
    super(
      `graphcode: the host process behind ${socketPath} is gone (${cause}). ` +
        `One reconnect + one re-election were attempted. Restart your session — ` +
        `the next \`graphcode mcp\` start wins the election and becomes the new host.`,
    );
    this.name = 'HostGoneError';
  }
}

function isDeadSocket(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE';
}

/**
 * The proxy's tool surface: the SAME registry shape (names, descriptions, Zod
 * input schemas) as the host binds — taken from `bindToolsToHarness` itself so
 * the surface can never drift — with every handler replaced by a socket forward.
 *
 * The template bind never touches the harness (handlers are closures, invoked
 * only on call), so an access-trapping stand-in guards that invariant at runtime.
 *
 * `promote` is the ONE re-election attempt on a dead socket: boot a real host
 * over the (now reclaimable) store and continue locally. Without `promote`, a
 * dead socket is a clear `HostGoneError`.
 */
export function buildProxyRegistry(opts: {
  socketPath: string;
  promote?: () => Promise<MCPToolRegistry>;
}): MCPToolRegistry {
  const unboundHarness = new Proxy(
    {},
    {
      get(_t, prop) {
        throw new Error(`proxy registry: harness.${String(prop)} accessed at bind time — the template must stay unbound`);
      },
    },
  ) as GraphCodeHarness;
  const unboundLog: AuditLog = {
    record: async () => {
      throw new Error('proxy registry: audit log accessed at bind time');
    },
    query: async () => {
      throw new Error('proxy registry: audit log accessed at bind time');
    },
  };
  const template = bindToolsToHarness(unboundHarness, unboundLog);

  // After a successful promotion the proxy IS the host — dispatch goes local.
  let local: MCPToolRegistry | null = null;

  async function dispatch(tool: string, input: unknown): Promise<unknown> {
    if (local) return local[tool].handler(input);
    try {
      // connectWithRetry inside callHost IS the reconnect attempt.
      return await callHost(opts.socketPath, tool, input);
    } catch (err) {
      if (!isDeadSocket(err)) throw err;
      if (!opts.promote) throw new HostGoneError(opts.socketPath, (err as Error).message);
      try {
        local = await opts.promote(); // re-election: CR-218 stale reclaim makes the lock winnable
      } catch (electionErr) {
        throw new HostGoneError(
          opts.socketPath,
          `${(err as Error).message}; re-election failed: ${(electionErr as Error).message}`,
        );
      }
      return local[tool].handler(input);
    }
  }

  return Object.fromEntries(
    Object.entries(template).map(([name, tool]) => [
      name,
      { ...tool, handler: (input: unknown) => dispatch(name, input) },
    ]),
  );
}
