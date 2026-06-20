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
import type { AuditLog } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { createHarness, type GraphCodeHarness } from './index.js';
import { exportGraphJson } from './exporter.js';
import { bindToolsToHarness, type MCPTool, type MCPToolRegistry } from './mcp-tools.js';

// Identity advertised to MCP clients during the initialize handshake. Kept in
// sync with package.json by CR-121 (distribution); hardcoded here so the core
// has no JSON-import-outside-rootDir dependency.
const SERVER_NAME = 'graphcode';
const SERVER_VERSION = '0.1.0-carve-out';

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
 * Boot the harness over disk Kuzu and serve its tools on MCP-stdio until the
 * transport closes. This is the `graphcode mcp` entrypoint.
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
  const harness = await createHarness({
    repoRoot,
    scope: opts?.scope ?? { workspaceId: member, systemId: member },
  });
  await harness.initialize();
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
      if (exportGraphJson(harness.getGraph()) !== committed) {
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
  const server = buildMcpServer(harness);
  await server.connect(new StdioServerTransport());
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
