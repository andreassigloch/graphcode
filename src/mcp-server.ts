/**
 * mcp-server.ts — bind the MCP tool registry to an `@modelcontextprotocol/sdk`
 * server over **stdio** (CR-GC-111 / MOD-cli).
 *
 * Realizes:
 *   - REQ-mcp-tool-registry : every tool from `bindToolsToHarness` is exposed.
 *   - REQ-mcp-gate-symmetry : `graph_mutate` still delegates to harness.mutate()
 *     — the protocol layer adds NO logic, so MCP writes == in-process writes (L2).
 *   - REQ-single-transport  : exactly one transport = MCP-stdio. No HTTP/Express
 *     in the core; the live-viewer SSE/WS bridge is a separate host concern.
 *
 * Agent-agnostic: the same stdio server is what Claude Code, OpenCode, or any
 * MCP host launches via `graphcode mcp` (see src/cli.ts).
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ZodObject, ZodRawShape } from 'zod/v4';
import type { AuditLog, Graph } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { createHarness, type GraphCodeHarness } from './index.js';
import { bindToolsToHarness, type MCPTool, type MCPToolRegistry } from './mcp-tools.js';
import { registerAutoExport, type AutoExportHandle } from './auto-export.js';
import { StoreOwnershipError } from './store-lock.js';
import { SessionLifecycle } from './session-lifecycle.js';
import { superviseGve } from './gve.js';
import { startHostSocket, buildProxyRegistry, HOST_SOCK_BASENAME, type HostSocket } from './host-shim.js';
import { HostBridge } from './viewer/host.js';
import type { LiveUpdateEvent } from './emit.js';
import { readPackageVersion } from './package-version.js';

// Der Handshake nennt dieselbe Zahl wie Lock-Stempel und `status` — ein Leser für alle (CR-GC-376).
export { readPackageVersion };

// Identity advertised to MCP clients during the initialize handshake.
const SERVER_NAME = 'graphcode';

const SERVER_VERSION = readPackageVersion();

/**
 * Turn a bound `MCPToolRegistry` into a live `McpServer`. Each registry tool's
 * Zod `inputSchema` (a `z.object`) contributes its raw shape so clients see a
 * proper JSON-schema; the handler output is wrapped as MCP text content.
 */
export function bindRegistryToMcpServer(registry: MCPToolRegistry): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  for (const tool of Object.values(registry)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: rawShapeOf(tool) },
      async (args: unknown) => {
        // Re-validate against the tool's own schema (idempotent over the SDK's
        // raw-shape parse) so the handler always receives canonical, defaulted input.
        const result = await tool.handler(tool.inputSchema.parse(args));
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      },
    );
  }
  return server;
}

/** Bind a harness's tools to a fresh `McpServer`. */
export function buildMcpServer(harness: GraphCodeHarness, auditLog?: AuditLog): McpServer {
  return bindRegistryToMcpServer(bindToolsToHarness(harness, auditLog));
}

/**
 * Boot a HOST over the store this process just won the election for: harness on
 * disk Kuzu (seed-on-empty / drift warning), the bound tool registry, and the
 * local Unix socket (`.graphcode/host.sock`) that serves later sessions'
 * proxies (CR-GC-235). Returns the registry to bind to this session's stdio.
 */
async function bootHost(
  harness: GraphCodeHarness,
): Promise<{ registry: MCPToolRegistry; socket: HostSocket; autoExport: AutoExportHandle }> {
  if (harness.getGraph().nodes.length === 0) {
    try {
      const seeded = await harness.seedFromJson();
      // REQ-with-test invariant (CR-GC-203 item 6): the seed bypasses the gate,
      // so surface — never silently swallow — any REQ that entered without a
      // verify-traced TEST. (We flag rather than reject so bootstrap can't
      // deadlock on accrued debt.)
      if (seeded.unverifiedReqs.length > 0) {
        process.stderr.write(
          `[graphcode] WARNING: ${seeded.unverifiedReqs.length} imported REQ(s) lack a verify-traced ` +
            `TEST (R-01): ${seeded.unverifiedReqs.join(', ')}. Author a concept-level TEST + verify trace.\n`,
        );
      }
    } catch {
      // No committed graph in this repo yet — serve the empty store.
    }
  }
  // CR-GC-392: KEIN Abgleich gegen die committete JSON mehr. Der Store IST die Quelle
  // (REQ-graph-is-ssot) — der Boot laedt ihn, fertig. Der fruehere Vergleich lud nichts
  // und entschied nichts; er warnte nur, und schon das legte nahe, die Datei koenne
  // mitreden. Sie kann es nicht: sie ist das Export-Artefakt fuer git, Diff und Viewer.
  // Dass sie zurueckfallen kann, ist kein Abgleichs-, sondern ein Vollstaendigkeitsproblem
  // des Exports — deshalb der flush() beim Shutdown weiter unten. Die JSON wird oben nur
  // noch fuer den EINEN Fall gelesen, in dem sie die Quelle ist: ein frischer Clone ohne
  // Store (seed-on-empty).
  const registry = bindToolsToHarness(harness);
  // Der Export folgt der Mutation (CR-GC-323) — entprellt + single-flight. NUR hier, im
  // gewählten Host: er allein besitzt den Store und schreibt. Ein Proxy oder eine
  // Test-Registry bindet dieselben Tools, darf davon aber nichts ins Repo schreiben.
  const autoExport = registerAutoExport(harness, registry.graph_export);
  // ONE write channel (CR-GC-235): the elected host also serves later sessions
  // over the local socket shim — an internal hop, not a second API surface.
  const socket = await startHostSocket(registry, join(harness.getStoreDir(), HOST_SOCK_BASENAME));
  // Der Handle wird gebraucht, nicht weggeworfen: beim Sessionende muss die Socket-Datei
  // weg, sonst zeigt sie auf einen toten Host (CR-GC-370).
  return { registry, socket, autoExport };
}

/**
 * Boot the MCP-stdio server for this repo — with the singleton ELECTION
 * (CR-GC-235): the O2 store lock decides. The winner becomes the HOST (owns
 * store + gate, serves stdio + the local socket); a loser no longer dies with
 * StoreOwnershipError but degrades to a thin stdio→socket PROXY over the same
 * tool surface — every write still through the ONE gate. Agents keep speaking
 * MCP-stdio either way (transport lock in letter + spirit).
 *
 * stdout is owned by the JSON-RPC transport — callers must keep it clean
 * (diagnostics go to stderr). On a fresh repo whose store has not been seeded
 * yet, the committed `docs/graph/*.graph.json` (if present) is loaded so the
 * agent immediately sees the model; cold-start through the gate is CR-122.
 */
export async function serveStdio(opts?: {
  repoRoot?: string;
  scope?: HarnessConfig['scope'];
}): Promise<void> {
  const repoRoot = opts?.repoRoot ?? process.cwd();
  // Derive the member identity from the repo so graph_export et al. default to a
  // repo-specific name (e.g. auth-service.graph.json), not the generic 'graphcode'.
  const member = deriveMemberName(repoRoot);
  const scope = opts?.scope ?? { workspaceId: member, systemId: member };

  /**
   * One election attempt: win the lock and come up as a full host — incl. the
   * read-only HTTP bridge when GRAPHCODE_HOST_PORT is set (CR-GC-237: the
   * bridge follows the lock). Passed as `promote` too, so a client promoted
   * after a host death rebinds the same port (the dead owner freed it).
   */
  // CR-GC-306: the booted graph, stashed so the first-step hint can be printed
  // ONCE after the initial election. `electAndBoot` keeps its signature because it
  // doubles as `promote` below — and a mid-session re-election (the host died) must
  // not re-print "here is your first step" into a session already underway.
  let bootedGraph: Graph | null = null;
  // Ein Host lebt so lange wie seine Session: EIN Abraeumpfad fuer Signale UND das Ende
  // des stdio-Clients. Ohne ihn ueberlebt der Host sein Editor-Fenster, behaelt den Lock
  // und macht jede spaetere Session zum Proxy eines toten Editors (CR-GC-370).
  const lifecycle = new SessionLifecycle();
  lifecycle.installTriggers();

  async function electAndBoot(): Promise<MCPToolRegistry> {
    // The sink is wired BEFORE the bridge exists — a mutable indirection lets
    // the bridge attach to this harness after the election is won.
    let bridge: HostBridge | null = null;
    const harness = await createHarness(
      { repoRoot, scope },
      {
        onUpdateEvent: (event: LiveUpdateEvent) => bridge?.broadcast(event),
        // Der Store gehoert jetzt einem anderen Host (CR-GC-372). Weiterlaufen hiesse
        // zweiter Schreiber auf einem Kuzu-Store — also endet diese Session.
        onLockLost: () => {
          process.stderr.write('[graphcode] host: store lock taken over by another host — ending this session\n');
          void lifecycle.shutdown('store lock lost').then(() => process.exit(0));
        },
      },
    );
    await harness.initialize(); // the O2 lock IS the election (CR-GC-218)
    // CR-GC-329: einmalige Notiz, WELCHE Schwellen gelten. Fehlt die Config, wird das
    // gesagt statt verschwiegen — ein Konsument, der `policySource: 'default'` sieht,
    // weiss dann auch im Log, warum.
    const loaded = harness.getGraphcodeConfig();
    process.stderr.write(
      loaded.source === 'config'
        ? `[graphcode] metric policy: ${loaded.path}\n`
        : `[graphcode] metric policy: contracts DEFAULT_METRIC_POLICY (no ${loaded.path})\n`,
    );
    // Aufbaureihenfolge = Registrierungsreihenfolge; abgeraeumt wird rueckwaerts,
    // der Store-Lock also zuletzt (CR-GC-370).
    lifecycle.add({ name: 'store lock', close: () => harness.close() });
    const { registry, socket, autoExport } = await bootHost(harness);
    // Der Export folgt der Mutation entprellt (250 ms). Ohne diesen flush faellt das
    // Artefakt bei einem Shutdown innerhalb des Fensters einen Batch hinter den Store
    // zurueck — genau die Divergenz, die niemand mehr abgleicht (CR-GC-392). Registriert
    // NACH dem store lock, wird also VOR ihm geschlossen: der Export braucht den Store.
    lifecycle.add({ name: 'auto-export flush', close: () => autoExport.flush() });
    lifecycle.add({ name: 'host.sock', close: () => socket.close() });
    bootedGraph = harness.getGraph();
    bridge = await maybeStartBridge(repoRoot, harness);
    if (bridge) lifecycle.add({ name: 'http bridge', close: () => bridge!.stop() });
    // Beaufsichtigt, nicht nur gestartet: stirbt der Viewer mitten in der Session,
    // kommt er von selbst zurueck (CR-GC-371).
    const gve = await superviseGve(repoRoot);
    if (gve) lifecycle.add({ name: 'gve dashboard', close: () => gve.stop() });
    return registry;
  }

  let registry: MCPToolRegistry;
  try {
    registry = await electAndBoot();
    process.stderr.write('[graphcode] host: won the store election — serving stdio + host.sock\n');
    if (bootedGraph) process.stderr.write(firstStepHint(bootedGraph));
  } catch (err) {
    if (!(err instanceof StoreOwnershipError)) throw err;
    // Election lost → thin proxy to the live host. `promote` is the single
    // re-election attempt when the host dies mid-session (stale-lock reclaim).
    const socketPath = join(repoRoot, '.graphcode', HOST_SOCK_BASENAME);
    registry = buildProxyRegistry({ socketPath, promote: electAndBoot });
    process.stderr.write(
      `[graphcode] client: store owned by pid ${err.owner.pid} — proxying stdio to ${socketPath}\n`,
    );
  }
  const server = bindRegistryToMcpServer(registry);
  await server.connect(new StdioServerTransport());
}

/**
 * Start the read-only HTTP bridge over the elected host's harness — ATTACH mode
 * (CR-GC-237). Opt-in via GRAPHCODE_HOST_PORT (scaffolded into `.mcp.json` env
 * by `graphcode init`); unset → no bridge, behavior as before. A bind failure
 * (port taken) must NEVER kill the gate: warn on stderr and serve stdio only.
 * Exported for TEST-bridge-follows-lock; production callers: electAndBoot only.
 */
export async function maybeStartBridge(
  repoRoot: string,
  harness: GraphCodeHarness,
): Promise<HostBridge | null> {
  const raw = process.env.GRAPHCODE_HOST_PORT;
  if (!raw) return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    process.stderr.write(`[graphcode] WARN: GRAPHCODE_HOST_PORT="${raw}" is not a valid port — no bridge started\n`);
    return null;
  }
  const bridge = new HostBridge({ repoRoot, harness, port });
  try {
    await bridge.start();
    process.stderr.write(`[graphcode] host: read-only bridge on http://127.0.0.1:${port} (/health /events /elements /subgraph /context)\n`);
    return bridge;
  } catch (err) {
    process.stderr.write(
      `[graphcode] WARN: bridge failed to bind port ${port} (${err instanceof Error ? err.message : String(err)}) — serving stdio only\n`,
    );
    return null;
  }
}


/**
 * The ONE sentence to say next, printed on boot (CR-GC-306).
 *
 * Onboarding failed at the same point every time: the host comes up, prints an
 * election line, and leaves the reader with a tool reference. A substrate whose
 * entry point is a tool list gets read and put down. So name a single next action —
 * never a menu; a wall of options is the failure mode being avoided.
 *
 * Which sentence depends on whether an INTENT LAYER exists, not on whether the store
 * has rows: since CR-GC-302 every imported store carries a SYS anchor, and
 * `graphcode import-code` produces FUNC/MOD/FLOW with no UC or REQ at all. Telling
 * that repo to read `graph_readiness` would point it at a status report about
 * requirements it does not have. UC/REQ is the real test.
 *
 * Returns text only — the caller writes it to **stderr**, because stdout is the MCP
 * JSON-RPC transport and one stray byte on fd 1 corrupts the protocol stream.
 */
export function firstStepHint(graph: Graph): string {
  const hasIntent = graph.nodes.some((n) => n.type === 'UC' || n.type === 'REQ');
  const step = hasIntent
    ? 'graph_readiness — wo steht das Projekt und was ist der nächste Schritt?'
    : 'leg mit se:generate los: "<was das System tun soll, in einem Satz>"';
  return `[graphcode] Erster Schritt — sag deinem Agenten:\n[graphcode]   Lies GRAPHCODE.md, dann: ${step}\n`;
}

/** Extract the raw Zod shape a `z.object`/`z.looseObject` was built from. */
function rawShapeOf(tool: MCPTool): ZodRawShape {
  return (tool.inputSchema as unknown as ZodObject<ZodRawShape>).shape ?? {};
}

/**
 * Derive the family-member identity for the repo being served: the unscoped
 * `package.json` name (e.g. `@acme/auth-service` → `auth-service`), else the repo
 * directory name, else `graphcode`. Used as the harness scope so re-export and
 * other tools default to a repo-specific name instead of the generic fallback.
 */
export function deriveMemberName(repoRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name.trim()) {
      const unscoped = pkg.name.includes('/') ? pkg.name.slice(pkg.name.lastIndexOf('/') + 1) : pkg.name;
      const clean = unscoped.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+|-+$/g, '');
      if (clean) return clean;
    }
  } catch {
    // No/invalid package.json — fall through to the directory name.
  }
  return basename(repoRoot) || SERVER_NAME;
}
