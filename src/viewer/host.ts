/**
 * host.ts — graphcode HOST process + READ-ONLY SSE bridge (MOD-host-bridge).
 *
 * The bridge exposes a strictly READ/live-view HTTP surface over the single
 * disk Kuzu store of a repo (REQ-single-kuzu-owner / FUNC-own-kuzu-host). Two
 * modes (CR-GC-237): OWN — `graphcode host` wins the election and owns the
 * harness itself; ATTACH — the elected MCP host injects ITS harness, so live
 * viewer and agent sessions coexist (the bridge follows the lock):
 *
 *   GET /health   real readiness probe — store reachable + gate functional +
 *                 ontology/rules/meta-model versions (FUNC-health-endpoint /
 *                 REQ-real-health-check). Not "lights on": it runs an actual
 *                 store query and a real rule-eval through the gate.
 *   GET /events   SSE stream — binds `createHarness`'s `onUpdateEvent` sink to
 *                 SSE writes, one `event: invalidate` frame per mutation
 *                 (FUNC-serve-sse / FUNC-broadcast-diff). Each frame carries a
 *                 monotonic `id:` so the broadcast is VERSIONED and clients can
 *                 resume via `Last-Event-ID` (REQ-versioned-broadcast).
 *   GET /elements         read-only node listing (slice, not a full dump).
 *   GET /subgraph/:root   read-only neighbourhood query.
 *   GET /context/:uid     read-only job slice (CR-GC-367) — the spec-closure an
 *                         agent must open to do THIS job, CR/MS filtered.
 *
 * READ-ONLY GUARANTEE (REQ-readonly-bridge): the request router dispatches ONLY
 * on `GET` and ONLY to the four read paths above. Any non-GET method (POST/PUT/
 * PATCH/DELETE) and any unknown path falls through to a blanket 404/405 — there
 * is no mutate/batch handler to reach, so the read-only property is STRUCTURAL,
 * not a config flag. The WRITE path is MCP-stdio only (src/mcp-server.ts — agents
 * mutate through the gate over stdio); this bridge never adds one.
 *
 * Deliberately NOT @sigloch/graph-api-express: that transport mounts POST /mutate
 * + /batch (which a read-only bridge MUST NOT expose) and pulls Express (a CJS
 * stack with dynamic `require`s that does not survive the ESM self-contained
 * bundle, REQ-self-contained-dist). The bridge is built on `node:http` only — zero
 * new runtime deps, and the route table is the whole attack surface.
 *
 * The core stays headless: HTTP lives ONLY in this file, never in harness.ts /
 * mcp-tools.ts.
 *
 * @author andreas@siglochconsulting
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ONTOLOGY_VERSION,
  RULES_VERSION,
  META_MODEL_VERSION,
  V3_RULES,
} from '@sigloch/contracts/se';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { FormatECodec, SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { buildJobSlice } from '../tools/read.js';
import { createHarness, type GraphCodeHarness } from '../index.js';
import { deriveMemberName } from '../mcp-server.js';
import type { LiveUpdateEvent } from '../emit.js';

/** A connected SSE client: its raw response stream. */
type SseClient = ServerResponse;

export interface HostBridgeOptions {
  /** Repo whose `.graphcode/kuzu` store this host owns (single owner). */
  repoRoot: string;
  /** Listen port. `0` (default) binds an ephemeral port — used by tests. */
  port?: number;
  /** Host scope; defaults to the repo-derived member identity if omitted. */
  scope?: HarnessConfig['scope'];
  /**
   * ATTACH mode (CR-GC-237): serve the HTTP surface over an already-elected
   * harness instead of owning a new one. The caller keeps the harness lifecycle
   * (`stop()` never closes it) and must feed mutations to `broadcast()` — the
   * injected harness's event sink was fixed at its own `createHarness` time.
   */
  harness?: GraphCodeHarness;
}

/** Live health payload for `GET /health` (REQ-real-health-check). */
export interface HealthPayload {
  status: 'ok' | 'degraded';
  /** Store reachable — proven by a real query, not a flag. */
  store: 'reachable' | 'unreachable';
  /** Gate functional — proven by a real rule-eval, not a flag. */
  gate: 'functional' | 'broken';
  /** Node count returned by the live store query. */
  nodeCount: number;
  /** SE schema versions the gate enforces (imported, never forked). */
  versions: {
    ontology: string;
    rules: string;
    metaModel: string;
    ruleCount: number;
  };
  /** Number of currently connected SSE clients. */
  sseClients: number;
}

/**
 * HostBridge — owns the harness (single Kuzu owner) and the read-only HTTP
 * surface. Construct, then `await start()`; `stop()` releases the server AND the
 * store.
 */
export class HostBridge {
  private readonly opts: HostBridgeOptions;
  private harness: GraphCodeHarness | null = null;
  /** True when start() created the harness — only then does stop() close it. */
  private ownsHarness = false;
  private server: Server | null = null;
  private readonly clients = new Set<SseClient>();
  /** Monotonic broadcast version (REQ-versioned-broadcast). Never resets. */
  private seq = 0;

  constructor(opts: HostBridgeOptions) {
    this.opts = opts;
  }

  /**
   * Boot the harness over disk Kuzu (FUNC-own-kuzu-host), wire its update-event
   * sink to the SSE broadcast (FUNC-serve-sse), and start listening. Returns the
   * bound port (resolves the ephemeral port when `port: 0`).
   */
  async start(): Promise<number> {
    if (this.server) throw new Error('[HostBridge] already started');

    if (this.opts.harness) {
      // ATTACH mode (CR-GC-237): the elected host (e.g. the MCP-stdio winner)
      // already owns the store — serve HTTP over ITS harness. The caller wires
      // its onUpdateEvent sink to `broadcast()`; we never touch the lock.
      this.harness = this.opts.harness;
      this.ownsHarness = false;
    } else {
      // OWN mode: single Kuzu owner — createHarness opens exactly one store at
      // <repoRoot>/.graphcode/kuzu and threads the SSE broadcast as onUpdateEvent.
      // Default the scope to the repo-derived member identity (mirrors serveStdio).
      const member = deriveMemberName(this.opts.repoRoot);
      this.harness = await createHarness(
        {
          repoRoot: this.opts.repoRoot,
          scope: this.opts.scope ?? { workspaceId: member, systemId: member },
        },
        { onUpdateEvent: (event) => this.broadcast(event) },
      );
      await this.harness.initialize();
      this.ownsHarness = true;
    }

    const harness = this.harness;
    this.server = createServer((req, res) => {
      // All errors are caught here so a bad request never crashes the host.
      this.route(harness, req, res).catch((err: unknown) => {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      });
    });

    const port = this.opts.port ?? 0;
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      // Loopback ONLY (CR-GC-255): listen(port) without a host binds `::` — dual-stack,
      // all interfaces — so /elements, /subgraph and /health served the whole governed
      // model to the LAN without auth or an Origin check. Read-only stays structurally
      // true; the REACH was unintended. No config flag: a remote exposure needs auth +
      // Origin checking and is its own decision.
      this.server!.listen(port, '127.0.0.1', () => resolve());
    });
    return (this.server!.address() as AddressInfo).port;
  }

  /**
   * Close the HTTP server and end all SSE streams. Releases the store handle
   * ONLY in own mode — an attached harness belongs to the elected host.
   */
  async stop(): Promise<void> {
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (this.server) {
      const server = this.server;
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      this.server = null;
    }
    if (this.harness) {
      if (this.ownsHarness) await this.harness.close();
      this.harness = null;
    }
  }

  /** Bound port once started; throws otherwise. */
  get port(): number {
    if (!this.server) throw new Error('[HostBridge] not started');
    return (this.server.address() as AddressInfo).port;
  }

  /**
   * The owned harness (the single Kuzu owner). Exposed so an in-process driver
   * (e.g. a co-located write surface, or the conformance test driving a real
   * gate mutation whose event must surface on THIS host's SSE stream) reaches
   * the same instance whose onUpdateEvent feeds the broadcast. Read accessor —
   * the host never adds an HTTP write path.
   */
  getHarness(): GraphCodeHarness {
    if (!this.harness) throw new Error('[HostBridge] not started');
    return this.harness;
  }

  // -- internals ------------------------------------------------------------

  /**
   * The ENTIRE request surface. Dispatches only on `GET` + the four read paths;
   * everything else is 404/405. This switch IS the read-only guarantee
   * (REQ-readonly-bridge): there is no branch that writes to the gate.
   */
  private async route(harness: GraphCodeHarness, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // A non-GET method on ANY path is rejected up-front — no write verb is served.
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'method not allowed (read-only bridge)' });
      return;
    }

    if (path === '/health') {
      sendJson(res, 200, await this.health(harness));
      return;
    }

    if (path === '/events') {
      this.openSse(req, res);
      return;
    }

    if (path === '/elements') {
      const filter: { type?: string; search?: string } = {};
      const type = url.searchParams.get('type');
      const search = url.searchParams.get('search');
      if (type) filter.type = type;
      if (search) filter.search = search;
      sendJson(res, 200, await harness.listElements(filter));
      return;
    }

    // CR-GC-367: die Job-Scheibe, die der Task-Start-Hook in den Agenten-Kontext
    // schiebt. Read-only wie alles hier; die Scheibe rechnet `buildJobSlice`
    // (tools/read.ts) — der Bridge-Endpoint ist reine Zustellung, keine zweite
    // Definition dessen, was eine Scheibe ist.
    if (path.startsWith('/context/')) {
      const anchor = decodeURIComponent(path.slice('/context/'.length));
      if (!anchor) {
        sendJson(res, 404, { error: 'not found (read-only bridge)' });
        return;
      }
      try {
        const { slice, seeds, missingRefs } = buildJobSlice(harness.getGraph(), anchor);
        sendJson(res, 200, {
          anchor,
          seeds,
          missingRefs,
          nodeCount: slice.nodes.length,
          edgeCount: slice.edges.length,
          formatE: new FormatECodec(SE_DESCRIPTOR).serialize(slice),
        });
      } catch {
        // Unbekannter Anker ist kein Fehler des Aufrufers, sondern ein Nicht-Treffer:
        // der Hook darf daraufhin still nichts injizieren (nie ein Fuzzy-Fallback).
        sendJson(res, 404, { error: `unknown anchor '${anchor}'` });
      }
      return;
    }

    if (path.startsWith('/subgraph/')) {
      const root = decodeURIComponent(path.slice('/subgraph/'.length));
      if (!root) {
        sendJson(res, 404, { error: 'not found (read-only bridge)' });
        return;
      }
      const depth = Math.min(Math.max(Number(url.searchParams.get('depth') ?? 1), 1), 10);
      sendJson(res, 200, await harness.subgraph(root, depth, 'both'));
      return;
    }

    // Anything else (incl. /mutate, /batch on GET) is unreachable.
    sendJson(res, 404, { error: 'not found (read-only bridge)' });
  }

  /** Open an SSE stream and register it for broadcast (FUNC-serve-sse). */
  private openSse(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Acknowledge the resume cursor (Last-Event-ID) so the client sees we honour
    // the versioned protocol; the next real event carries the next seq.
    const lastId = req.headers['last-event-id'];
    res.write(`: connected${lastId ? ` (resumed from ${String(lastId)})` : ''}\n\n`);

    this.clients.add(res);
    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcast one LiveUpdateEvent to every connected SSE client with a fresh
   * monotonic id (FUNC-broadcast-diff). The id makes the stream VERSIONED:
   * clients track the last id and resume via Last-Event-ID (REQ-versioned-broadcast).
   *
   * Public because in ATTACH mode (CR-GC-237) the elected host owns the harness
   * and wires its own onUpdateEvent sink to this method; in own mode start()
   * wires it internally.
   */
  broadcast(event: LiveUpdateEvent): void {
    const id = ++this.seq;
    const frame = `id: ${id}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(frame);
  }

  /**
   * REAL health check (REQ-real-health-check). Probes the store with an actual
   * query and the gate with an actual rule-eval — a thrown error degrades the
   * corresponding field instead of crashing the endpoint.
   */
  private async health(harness: GraphCodeHarness): Promise<HealthPayload> {
    let store: HealthPayload['store'] = 'unreachable';
    let nodeCount = 0;
    try {
      const nodes = await harness.listElements({});
      nodeCount = nodes.length;
      store = 'reachable';
    } catch {
      store = 'unreachable';
    }

    let gate: HealthPayload['gate'] = 'broken';
    try {
      // A real rule-eval through the gate's engine — proves the gate is wired,
      // not just that the process is alive.
      harness.evaluateRules();
      gate = 'functional';
    } catch {
      gate = 'broken';
    }

    return {
      status: store === 'reachable' && gate === 'functional' ? 'ok' : 'degraded',
      store,
      gate,
      nodeCount,
      versions: {
        ontology: ONTOLOGY_VERSION,
        rules: RULES_VERSION,
        metaModel: META_MODEL_VERSION,
        ruleCount: V3_RULES.length,
      },
      sseClients: this.clients.size,
    };
  }
}

/** Write a JSON response with the given status. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * `graphcode host` entrypoint — start the read-only bridge for `repoRoot` and
 * keep it running until the process is killed. Diagnostics go to stderr so they
 * never collide with any consumer expecting clean stdout.
 */
export async function serveHost(opts: HostBridgeOptions): Promise<HostBridge> {
  const bridge = new HostBridge(opts);
  const port = await bridge.start();
  process.stderr.write(`[graphcode host] read-only bridge on http://127.0.0.1:${port}\n`);
  process.stderr.write(`[graphcode host]   GET /health   GET /events (SSE)   GET /elements   GET /subgraph/:root\n`);
  return bridge;
}
