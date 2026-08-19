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
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ZodObject, ZodRawShape } from 'zod/v4';
import type { AuditLog, Graph } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { createHarness, type GraphCodeHarness } from './index.js';
import { exportGraphJson } from './exporter.js';
import { bindToolsToHarness, type MCPTool, type MCPToolRegistry } from './mcp-tools.js';
import { registerAutoExport } from './auto-export.js';
import { StoreOwnershipError } from './store-lock.js';
import { SessionLifecycle } from './session-lifecycle.js';
import { startHostSocket, buildProxyRegistry, HOST_SOCK_BASENAME, type HostSocket } from './host-shim.js';
import { HostBridge } from './viewer/host.js';
import type { LiveUpdateEvent } from './emit.js';

// Identity advertised to MCP clients during the initialize handshake.
const SERVER_NAME = 'graphcode';

/**
 * The version, READ from package.json at startup — never a literal (CR-GC-270).
 *
 * A hardcoded constant has to be hand-carried on every release, and on 0.5.0 it
 * was not: the published package announced 0.4.1 in its handshake. Since `npx -y`
 * consumers always pull `latest`, the one place a user can read the running
 * version was the one place that lied.
 *
 * `readFileSync` rather than `import pkg from '../package.json'` on purpose: the
 * JSON import sits outside `rootDir` and breaks `tsc`, which is why the literal
 * existed in the first place. Reading at runtime sidesteps that without adding a
 * codegen step that could drift in its own right. `dist/mcp-server.js` and
 * `src/mcp-server.ts` both sit ONE level below the package root, so the relative
 * path holds in the published package and in the dev tree alike.
 *
 * Deliberately NO fallback: if package.json is unreadable, fail loudly instead of
 * announcing a guessed version — a version you cannot trust is the defect this
 * change removes.
 */
export function readPackageVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const version = (JSON.parse(raw) as { version?: string }).version;
  if (!version) throw new Error(`graphcode: no "version" field in ${pkgPath}`);
  return version;
}

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
  repoRoot: string,
  harness: GraphCodeHarness,
): Promise<{ registry: MCPToolRegistry; socket: HostSocket }> {
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
  } else {
    // Store already seeded → it is the runtime SSOT (REQ-graph-is-ssot). The
    // committed JSON is its generated export; under CR-GC-201 (gate-only writes)
    // the JSON can change ONLY via graph_export, so it must never drift ahead of
    // the store. We do NOT auto-reseed here (that would clobber un-exported gate
    // mutations) — we WARN, so a stale store or a pending export is visible
    // instead of silently served (the failure mode that froze the store at an
    // old snapshot). To adopt a newer committed JSON: stop the server, remove
    // .graphcode/kuzu*, restart (seed-on-empty re-imports it).
    try {
      const committed = readFileSync(join(repoRoot, 'docs/graph/graphcode.graph.json'), 'utf8');
      // Der CR-GC-300 graphVersion-Stamp ist Metadatum des Exports, kein Modell-
      // Inhalt — fuer den Drift-Vergleich strippen und kanonisch re-serialisieren.
      const committedCanonical = ((): string => {
        const parsed = JSON.parse(committed) as Record<string, unknown>;
        delete parsed.graphVersion;
        return JSON.stringify(parsed, null, 2) + '\n';
      })();
      if (exportGraphJson(harness.getGraph()) !== committedCanonical) {
        process.stderr.write(
          '[graphcode] WARN: Kuzu store differs from docs/graph/graphcode.graph.json — ' +
          'either run graph_export (store has un-exported mutations) or re-seed ' +
          '(committed JSON is newer: stop, rm .graphcode/kuzu*, restart).\n',
        );
      }
    } catch {
      // No committed JSON to compare against — nothing to warn about.
    }
  }
  const registry = bindToolsToHarness(harness);
  // Der Export folgt der Mutation (CR-GC-323) — entprellt + single-flight. NUR hier, im
  // gewählten Host: er allein besitzt den Store und schreibt. Ein Proxy oder eine
  // Test-Registry bindet dieselben Tools, darf davon aber nichts ins Repo schreiben.
  registerAutoExport(harness, registry.graph_export);
  // ONE write channel (CR-GC-235): the elected host also serves later sessions
  // over the local socket shim — an internal hop, not a second API surface.
  const socket = await startHostSocket(registry, join(harness.getStoreDir(), HOST_SOCK_BASENAME));
  // Der Handle wird gebraucht, nicht weggeworfen: beim Sessionende muss die Socket-Datei
  // weg, sonst zeigt sie auf einen toten Host (CR-GC-370).
  return { registry, socket };
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
      { onUpdateEvent: (event: LiveUpdateEvent) => bridge?.broadcast(event) },
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
    const { registry, socket } = await bootHost(repoRoot, harness);
    lifecycle.add({ name: 'host.sock', close: () => socket.close() });
    bootedGraph = harness.getGraph();
    bridge = await maybeStartBridge(repoRoot, harness);
    if (bridge) lifecycle.add({ name: 'http bridge', close: () => bridge!.stop() });
    const gve = await maybeStartGve(repoRoot);
    if (gve) lifecycle.add({ name: 'gve dashboard', close: () => killProcessGroup(gve) });
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
    process.stderr.write(`[graphcode] host: read-only bridge on http://127.0.0.1:${port} (/health /events /elements /subgraph)\n`);
    return bridge;
  } catch (err) {
    process.stderr.write(
      `[graphcode] WARN: bridge failed to bind port ${port} (${err instanceof Error ? err.message : String(err)}) — serving stdio only\n`,
    );
    return null;
  }
}

/**
 * Auto-start the GVE live dashboard for the elected host: once the MCP server
 * owns the store, the viewer is one URL away without a manual launch. GVE is
 * the DEFAULT for a graphcode session; opt out via GRAPHCODE_NO_GVE=1 (e.g. in
 * `.mcp.json` env). GRAPHCODE_GVE_BIN overrides the launch command (space-split)
 * — needed when a local checkout must serve instead of the installed package.
 *
 * The viewer is a DEPENDENCY, started from `node_modules` (CR-GC-369) — not fetched
 * per session with `npx -y`. That cost the customer a second registry roundtrip on
 * top of `graphcode init`, failed offline, and pinned the viewer to whatever the
 * registry called `latest` rather than to a version this package was tested against.
 *
 * Guards, in order:
 *   - never under a test/CI runner (VITEST/CI) — suites must not spawn viewers;
 *   - a docs/views/dashboard.url whose instance serves THIS repo means some
 *     instance (manual or a previous session) already has it — never a second
 *     spawn; a stale file (crashed instance) OR one now answered by a FOREIGN
 *     repo's viewer falls through to a fresh spawn.
 *
 * Why identity, not reachability: every GVE defaults to the SAME
 * port (4317 — the viewer's config schema default, per repo overridable only by
 * its own config.json), and Vite bumps on conflict. So repo A can write
 * `:4317` into its dashboard.url, die, and repo B's viewer take that port —
 * after which A's probe was answered by B and A never started its own viewer.
 * The reported symptom was exactly that: `graphcode mcp` in repo A opened B's
 * dashboard. `GET <url>api/dashboard` names the REPO it serves,
 * and only that repo counts as already-serving. The path is compared physical
 * (realpath both sides): a symlinked launch path — /var vs /private/var on
 * macOS, a worktree reached through a link — must not read as a foreign repo.
 * An instance that answers without a `repoRoot` is a viewer older than that
 * field:
 * unidentifiable, therefore foreign, so this repo gets its own viewer.
 *
 * The spawned GVE writes/removes dashboard.url itself with its ACTUAL bound
 * port (dynamic on conflict) — that file, not this function, is how parallel
 * sessions discover the URL. Election losers never get here (electAndBoot
 * only), so N proxy sessions still mean ONE viewer. A spawn failure must never
 * kill the gate: warn on stderr, serve without a dashboard. The child dies
 * with this process (detached group, killed on 'exit'); stdout stays off fd 1
 * — that is the MCP JSON-RPC channel.
 */
/**
 * A path in its physical form — the only form two processes can compare. A path
 * that cannot be resolved (a repo the viewer serves but this machine doesn't
 * have) stays as given: it will simply not match, which is the correct verdict.
 */
function physicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * Beendet den Viewer samt seiner Prozessgruppe (`detached: true` machte ihn zum
 * Gruppenfuehrer). Der Aufrufer ist der SessionLifecycle — der Host haengt keine
 * eigenen Signal-Handler mehr an, sonst gaebe es zwei Abraeumpfade nebeneinander.
 */
export function killProcessGroup(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Schon weg.
  }
}

/** The installed viewer's CLI entry — resolved from THIS package's dependency tree. */
function resolveGveEntry(): string {
  return createRequire(import.meta.url).resolve('@sigloch/graph-view-edit/bin/gve.mjs');
}

export async function maybeStartGve(
  repoRoot: string,
  deps: {
    spawnImpl?: typeof spawn;
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    resolveGve?: () => string;
  } = {},
): Promise<ChildProcess | null> {
  const env = deps.env ?? process.env;
  if (env.GRAPHCODE_NO_GVE || env.VITEST || env.CI) return null;
  const urlFile = join(repoRoot, 'docs', 'views', 'dashboard.url');
  if (existsSync(urlFile)) {
    const url = readFileSync(urlFile, 'utf8').trim();
    const mine = physicalPath(repoRoot);
    try {
      const res = await (deps.fetchImpl ?? fetch)(new URL('api/dashboard', url), {
        signal: AbortSignal.timeout(750),
      });
      const served = res.ok ? ((await res.json()) as { repoRoot?: unknown }).repoRoot : undefined;
      if (typeof served === 'string' && physicalPath(served) === mine) {
        process.stderr.write(`[graphcode] gve: dashboard already serving this repo at ${url}\n`);
        return null;
      }
      process.stderr.write(
        `[graphcode] gve: ${url} serves ${typeof served === 'string' ? served : 'another repo'}, ` +
          `not ${mine} — starting this repo's own dashboard\n`,
      );
    } catch {
      // Stale file from a crashed instance — fall through and spawn fresh.
    }
  }
  let bin: string;
  let args: string[];
  if (env.GRAPHCODE_GVE_BIN) {
    [bin, ...args] = env.GRAPHCODE_GVE_BIN.split(' ');
  } else {
    let entry: string;
    try {
      entry = (deps.resolveGve ?? resolveGveEntry)();
    } catch (err) {
      // No viewer installed (a stripped install, a broken hoist): warn and serve
      // without a dashboard. A missing viewer must never take the gate down.
      process.stderr.write(
        `[graphcode] WARN: gve not resolvable (${err instanceof Error ? err.message : String(err)}) — ` +
          'reinstall @sigloch/graphcode, set GRAPHCODE_GVE_BIN, or silence with GRAPHCODE_NO_GVE=1\n',
      );
      return null;
    }
    // process.execPath, not the shebang: the entry is run by the SAME node that
    // runs this host, independent of exec bits and of what `node` means on PATH.
    bin = process.execPath;
    args = [entry];
  }
  const child = (deps.spawnImpl ?? spawn)(bin, [...args, '--repo', repoRoot], {
    stdio: ['ignore', 2, 2],
    detached: true,
  });
  child.on('error', (err: Error) => {
    process.stderr.write(
      `[graphcode] WARN: gve failed to start (${err.message}) — set GRAPHCODE_GVE_BIN or silence with GRAPHCODE_NO_GVE=1\n`,
    );
  });
  process.stderr.write('[graphcode] gve: dashboard starting — URL lands in docs/views/dashboard.url\n');
  return child;
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
